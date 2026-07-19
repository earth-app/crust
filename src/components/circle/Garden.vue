<template>
	<div
		ref="root"
		class="garden-root relative w-full overflow-hidden rounded-2xl"
		:style="{ height: resolvedHeight }"
	>
		<canvas
			ref="canvas"
			class="block h-full w-full"
			role="img"
			:aria-label="ariaLabel"
		/>
		<div
			v-if="showCaption"
			class="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3"
		>
			<span
				class="rounded-full bg-black/35 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm"
				>{{ caption || defaultCaption }}</span
			>
			<span
				v-if="garden.animated && !reduced"
				class="rounded-full bg-white/20 px-2 py-1 text-[10px] font-semibold tracking-wide text-white uppercase backdrop-blur-sm"
				>Living</span
			>
		</div>
	</div>
</template>

<script setup lang="ts">
// generative canvas garden grown from a CircleGarden projection; deterministic seeded
// layout, SSR-safe (drawing gated behind onMounted), reduced-motion aware, element +
// particle + creature capped. season / time-of-day / moon are derived client-side from
// the current date, or overridden via the optional render prop (marketing studio)
const props = withDefaults(
	defineProps<{
		garden: CircleGarden;
		render?: GardenRenderConfig | null;
		height?: number | string;
		interactive?: boolean;
		caption?: string;
		showCaption?: boolean;
	}>(),
	{
		render: null,
		height: 320,
		interactive: true,
		caption: '',
		showCaption: true
	}
);

const root = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const reduced = ref(false);

const resolvedHeight = computed(() =>
	typeof props.height === 'number' ? `${props.height}px` : props.height
);

const defaultCaption = computed(() => 'Your Shared Garden');

const ariaLabel = computed(() => {
	const counts = new Map<GardenElementKind, number>();
	for (const el of props.garden.elements) counts.set(el.kind, (counts.get(el.kind) ?? 0) + 1);
	const parts = GARDEN_ELEMENT_KINDS.filter((k) => counts.get(k)).map(
		(k) => `${counts.get(k)} ${GARDEN_ELEMENT_META[k].label.toLowerCase()}`
	);
	return `A shared garden at growth level ${props.garden.level}, with ${parts.join(', ') || 'young sprouts'}`;
});

// #region scene state (recomputed on size / data change)
let ctx: CanvasRenderingContext2D | null = null;
let raf = 0;
let dpr = 1;
let cssW = 0;
let cssH = 0;
let layout: GardenLayout | null = null;
let sr: ResolvedGardenRender = resolveGardenRender(null);
let ambient: AmbientCreature[] = [];
let particles: {
	x: number;
	y: number;
	r: number;
	speed: number;
	drift: number;
	phase: number;
	hue: string;
}[] = [];
let ro: ResizeObserver | null = null;
let startTime = 0;

// tap/hold interaction state (replaces the old pointer parallax warp)
type GardenEffect =
	| { kind: 'leaves'; x: number; y: number; start: number; seed: number; color: string }
	| { kind: 'splash'; x: number; y: number; start: number }
	| { kind: 'petals'; x: number; y: number; start: number; seed: number; color: string };
let effects: GardenEffect[] = [];
// the creature pinned under a press-and-hold, and where the finger holds it
let heldId: string | null = null;
const heldPos = { x: 0, y: 0 };
// live on-screen creature positions this frame, for pointer hit-testing
const creaturePos = new Map<string, { x: number; y: number; r: number }>();
interface HitZone {
	type: 'tree' | 'water' | 'flower';
	x: number;
	y: number;
	r: number;
	el: LaidElement;
}
let hitZones: HitZone[] = [];

function sceneSeed(): number {
	return hashSeed(props.garden.level, props.garden.elements.length, 'scene');
}

// stable [0,1) from a seed + salt, for tiny per-element cosmetic jitter
function seedFloatLocal(seed: number, salt: string): number {
	return mulberry32(hashSeed(seed, salt))();
}

function buildParticles() {
	particles = [];
	if (!layout || !props.garden.animated) return;
	const winter = sr.season === 'winter';
	// pollen (or winter snow) capped so a huge garden never blows up the loop
	const count = Math.min(MAX_GARDEN_PARTICLES, Math.round(6 + props.garden.level * 2.4));
	const rng = mulberry32(hashSeed(props.garden.level, props.garden.elements.length, 'particles'));
	for (let i = 0; i < count; i++) {
		particles.push({
			x: rng() * cssW,
			y: rng() * cssH,
			r: winter ? 1 + rng() * 2.2 : 0.8 + rng() * 1.8,
			speed: 4 + rng() * 10,
			drift: (rng() - 0.5) * 12,
			phase: rng() * Math.PI * 2,
			hue: winter ? '#ffffff' : sr.nightFactor > 0.5 ? '#fef9c3' : '#ffffff'
		});
	}
}

function buildAmbient() {
	ambient = [];
	if (!layout) return;
	// living perk gets a full flock; free gardens still get a calm few
	const count = props.garden.animated ? 8 : 3;
	ambient = planAmbientCreatures(sceneSeed(), sr.timeOfDay, count);
}

function relayout() {
	if (!canvas.value || !root.value) return;
	cssW = root.value.clientWidth || 320;
	cssH = root.value.clientHeight || 320;
	dpr = Math.min(2, window.devicePixelRatio || 1);
	canvas.value.width = Math.round(cssW * dpr);
	canvas.value.height = Math.round(cssH * dpr);
	ctx = canvas.value.getContext('2d');
	if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	sr = resolveGardenRender(props.render, new Date());
	layout = layoutGarden(props.garden, cssW, cssH);
	buildParticles();
	buildAmbient();
	buildHitZones();
	heldId = null;
	creaturePos.clear();
}

// static tap targets (trees drop leaves, water splashes, blooms shed petals)
function buildHitZones() {
	hitZones = [];
	if (!layout) return;
	for (const el of layout.elements) {
		if (el.far) continue;
		if (el.kind === 'tree') {
			const trunkH = el.size * 1.3 * (el.trunk || 1);
			hitZones.push({ type: 'tree', x: el.x, y: el.y - trunkH * 0.7, r: el.size * 0.85, el });
		} else if (el.kind === 'water') {
			hitZones.push({ type: 'water', x: el.x, y: el.y, r: el.size, el });
		} else if (el.kind === 'flower' && el.variant !== 'mushroom' && el.variant !== 'grass') {
			hitZones.push({ type: 'flower', x: el.x, y: el.y - el.size * 0.7, r: el.size * 0.6, el });
		}
	}
}

// a closed blob curve through midpoints (smooth edges for ponds + rocks)
function traceSmoothClosed(pts: Point[]): void {
	if (!ctx || pts.length < 3) return;
	const n = pts.length;
	const mx = (a: Point, b: Point) => (a.x + b.x) / 2;
	const my = (a: Point, b: Point) => (a.y + b.y) / 2;
	ctx.beginPath();
	ctx.moveTo(mx(pts[n - 1]!, pts[0]!), my(pts[n - 1]!, pts[0]!));
	for (let i = 0; i < n; i++) {
		const cur = pts[i]!;
		const next = pts[(i + 1) % n]!;
		ctx.quadraticCurveTo(cur.x, cur.y, mx(cur, next), my(cur, next));
	}
	ctx.closePath();
}
// #endregion

// #region sky + terrain painters
function drawSky() {
	if (!ctx || !layout) return;
	const nf = sr.nightFactor;
	let top = mixHex('#a9dcf5', '#0a1836', nf);
	let horizon = mixHex('#fbe4c0', '#243056', nf);
	if (sr.timeOfDay === 'dusk') horizon = mixHex(horizon, '#f59e42', 0.28);
	else if (sr.timeOfDay === 'dawn') horizon = mixHex(horizon, '#fca5a5', 0.24);
	if (sr.season === 'winter') top = mixHex(top, '#cfe3f2', 0.12);
	const grad = ctx.createLinearGradient(0, 0, 0, layout.ground);
	grad.addColorStop(0, top);
	grad.addColorStop(1, horizon);
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, cssW, layout.ground + 2);
}

function drawSun(cx: number, cy: number, r: number) {
	if (!ctx) return;
	const warm = sr.timeOfDay === 'dawn' || sr.timeOfDay === 'dusk';
	const core = warm ? '#ffd18a' : '#fff7d6';
	const glow = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 3);
	glow.addColorStop(0, warm ? 'rgba(255,176,102,0.7)' : 'rgba(255,236,179,0.7)');
	glow.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.fillStyle = glow;
	ctx.beginPath();
	ctx.arc(cx, cy, r * 3, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = core;
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.fill();
}

// moon terminator drawn as a sampled polygon (lit limb + terminator ellipse) so the
// crescent<->gibbous transition is exact with no canvas arc-flag pitfalls
function drawMoon(cx: number, cy: number, r: number, phase: number) {
	if (!ctx) return;
	const lit = '#f5f3ea';
	const dark = mixHex('#111a30', '#1b2542', 0.5);
	ctx.save();
	ctx.translate(cx, cy);
	const glow = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 3);
	glow.addColorStop(0, `rgba(226,232,240,${0.2 + moonIlluminatedFraction(phase) * 0.45})`);
	glow.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.fillStyle = glow;
	ctx.beginPath();
	ctx.arc(0, 0, r * 3, 0, Math.PI * 2);
	ctx.fill();
	// dark base disc
	ctx.fillStyle = dark;
	ctx.beginPath();
	ctx.arc(0, 0, r, 0, Math.PI * 2);
	ctx.fill();
	// lit region
	const side = phase < 0.5 ? 1 : -1;
	const tx = r * Math.cos(phase * 2 * Math.PI);
	const N = 24;
	ctx.fillStyle = lit;
	ctx.beginPath();
	for (let i = 0; i <= N; i++) {
		const a = -Math.PI / 2 + (i / N) * Math.PI;
		const x = side * r * Math.cos(a);
		const y = r * Math.sin(a);
		if (i === 0) ctx.moveTo(x, y);
		else ctx.lineTo(x, y);
	}
	for (let i = N; i >= 0; i--) {
		const a = -Math.PI / 2 + (i / N) * Math.PI;
		ctx.lineTo(side * tx * Math.cos(a), r * Math.sin(a));
	}
	ctx.closePath();
	ctx.fill();
	ctx.restore();
}

function drawCelestial() {
	if (!ctx || !layout) return;
	const cx = cssW * 0.78;
	const cy = layout.ground * 0.32;
	const r = Math.max(16, cssW * 0.05);
	if (sr.timeOfDay === 'night') drawMoon(cx, cy, r, sr.moonPhase);
	else drawSun(cx, cy, r);
}

function seasonHill(base: string): string {
	if (sr.season === 'autumn') return mixHex(base, '#a9843f', 0.22);
	if (sr.season === 'winter') return mixHex(base, '#e2eef6', 0.55);
	if (sr.season === 'spring') return mixHex(base, '#bce8a8', 0.18);
	return base;
}

function drawHills() {
	if (!ctx || !layout) return;
	const nf = sr.nightFactor;
	const bands = [
		{ y: layout.ground - 8, amp: 18, color: mixHex(seasonHill('#8ec9a0'), '#1e2f4d', nf), px: 0.4 },
		{ y: layout.ground - 2, amp: 26, color: mixHex(seasonHill('#6fb587'), '#16233c', nf), px: 0.7 }
	];
	for (const band of bands) {
		const off = 0;
		ctx.fillStyle = band.color;
		ctx.beginPath();
		ctx.moveTo(-20, cssH);
		for (let x = -20; x <= cssW + 20; x += 24) {
			const y = band.y + Math.sin((x + off) * 0.012) * band.amp;
			ctx.lineTo(x + off, y);
		}
		ctx.lineTo(cssW + 20, cssH);
		ctx.closePath();
		ctx.fill();
	}
}

function seasonGround(): [string, string] {
	switch (sr.season) {
		case 'spring':
			return ['#6bbf7a', '#4a8f5a'];
		case 'autumn':
			return ['#8a8a45', '#63682f'];
		case 'winter':
			return ['#e8eef2', '#c7d2da'];
		default:
			return ['#5aa06a', '#3f7d4f'];
	}
}

function drawGround() {
	if (!ctx || !layout) return;
	const nf = sr.nightFactor;
	const [g0, g1] = seasonGround();
	const grad = ctx.createLinearGradient(0, layout.ground, 0, cssH);
	grad.addColorStop(0, mixHex(g0, '#233a2c', nf));
	grad.addColorStop(1, mixHex(g1, '#16261c', nf));
	ctx.fillStyle = grad;
	ctx.fillRect(0, layout.ground, cssW, cssH - layout.ground);
}

function drawRiver(time: number, lively: boolean) {
	if (!ctx || !layout || !layout.river) return;
	const nf = sr.nightFactor;
	const y = layout.riverY;
	const h = Math.max(10, (cssH - layout.ground) * 0.12);
	ctx.save();
	const grad = ctx.createLinearGradient(0, y - h, 0, y + h);
	grad.addColorStop(0, mixHex('#63b3ed', '#1e3a5f', nf));
	grad.addColorStop(1, mixHex('#3182ce', '#132a44', nf));
	ctx.fillStyle = grad;
	// smooth banks: quadratic curves through midpoints, no hard corners
	const top: Point[] = [];
	const bot: Point[] = [];
	for (let x = -20; x <= cssW + 20; x += 26)
		top.push({ x, y: y - h + Math.sin(x * 0.02 + 0.6) * 4 });
	for (let x = cssW + 20; x >= -20; x -= 26) bot.push({ x, y: y + h + Math.sin(x * 0.02) * 5 });
	ctx.beginPath();
	ctx.moveTo(top[0]!.x, top[0]!.y);
	for (let i = 1; i < top.length - 1; i++) {
		const m = { x: (top[i]!.x + top[i + 1]!.x) / 2, y: (top[i]!.y + top[i + 1]!.y) / 2 };
		ctx.quadraticCurveTo(top[i]!.x, top[i]!.y, m.x, m.y);
	}
	ctx.lineTo(top[top.length - 1]!.x, top[top.length - 1]!.y);
	ctx.lineTo(bot[0]!.x, bot[0]!.y);
	for (let i = 1; i < bot.length - 1; i++) {
		const m = { x: (bot[i]!.x + bot[i + 1]!.x) / 2, y: (bot[i]!.y + bot[i + 1]!.y) / 2 };
		ctx.quadraticCurveTo(bot[i]!.x, bot[i]!.y, m.x, m.y);
	}
	ctx.lineTo(bot[bot.length - 1]!.x, bot[bot.length - 1]!.y);
	ctx.closePath();
	ctx.fill();
	// flowing highlights drift left->right when the scene is alive
	if (lively) {
		ctx.strokeStyle = 'rgba(255,255,255,0.4)';
		ctx.lineWidth = 1.4;
		for (let k = 0; k < 3; k++) {
			const phase = (time * 0.00008 + k * 0.33) % 1;
			const hx = phase * (cssW + 40) - 20;
			ctx.beginPath();
			ctx.moveTo(hx, y - h * 0.3);
			ctx.quadraticCurveTo(hx + 20, y, hx + 40, y + h * 0.2);
			ctx.stroke();
		}
	}
	ctx.restore();
}
// #endregion

// #region element painters
function drawBlob(x: number, y: number, r: number, color: string) {
	if (!ctx) return;
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.fill();
}

function drawTree(el: LaidElement, g: number, sway: number) {
	if (!ctx) return;
	const trunkH = el.size * (0.9 + 0.7 * g) * (el.trunk || 1);
	const trunkW = Math.max(2, el.size * 0.14);
	ctx.save();
	ctx.translate(el.x, el.y);
	ctx.rotate(sway * 0.02);
	ctx.fillStyle = el.accent;
	ctx.beginPath();
	ctx.moveTo(-trunkW / 2, 0);
	ctx.lineTo(trunkW / 2, 0);
	ctx.lineTo(trunkW * 0.3, -trunkH);
	ctx.lineTo(-trunkW * 0.3, -trunkH);
	ctx.closePath();
	ctx.fill();
	// visible branches (skip on conifers)
	if (el.variant !== 'conifer') {
		ctx.strokeStyle = el.accent;
		ctx.lineWidth = Math.max(1, trunkW * 0.42);
		ctx.lineCap = 'round';
		for (let i = 0; i < 3; i++) {
			const by = -trunkH * (0.5 + 0.16 * i);
			const dir = i % 2 === 0 ? 1 : -1;
			ctx.beginPath();
			ctx.moveTo(0, by);
			ctx.lineTo(dir * el.size * 0.32, by - el.size * 0.16);
			ctx.stroke();
		}
	}
	const cy = -trunkH - el.size * 0.1;
	const foliage = treeFoliageForSeason(sr.season, el.color, el.seed);
	const r = el.size * 0.6 * (0.55 + 0.45 * g);
	if (foliage && el.variant === 'conifer') {
		for (let i = 0; i < 3; i++) {
			const ty = cy + i * r * 0.5;
			const tw = r * (1 - i * 0.22);
			ctx.fillStyle = shadeHex(foliage, 8 - i * 6);
			ctx.beginPath();
			ctx.moveTo(0, ty - r * 0.9);
			ctx.lineTo(tw, ty + r * 0.2);
			ctx.lineTo(-tw, ty + r * 0.2);
			ctx.closePath();
			ctx.fill();
		}
	} else if (foliage) {
		drawBlob(-r * 0.55, cy + r * 0.2, r * 0.8, shadeHex(foliage, -18));
		drawBlob(r * 0.55, cy + r * 0.15, r * 0.85, shadeHex(foliage, 12));
		drawBlob(0, cy - r * 0.5, r * 0.72, shadeHex(foliage, 22));
		drawBlob(0, cy, r, foliage);
	} else {
		// winter bare crown — a spray of thin branches, no leaves
		ctx.strokeStyle = shadeHex(el.accent, 12);
		ctx.lineWidth = Math.max(1, trunkW * 0.3);
		const spread = el.size * 0.5 * (0.6 + 0.4 * g);
		for (let i = 0; i < 5; i++) {
			const ang = -Math.PI / 2 + (i - 2) * 0.5;
			ctx.beginPath();
			ctx.moveTo(0, cy + r * 0.3);
			ctx.lineTo(Math.cos(ang) * spread, cy + r * 0.3 + Math.sin(ang) * spread);
			ctx.stroke();
		}
	}
	// winter snow rests on the crown / bare branches
	if (sr.season === 'winter') {
		ctx.fillStyle = 'rgba(255,255,255,0.85)';
		ctx.beginPath();
		ctx.ellipse(0, cy - (foliage ? r * 0.6 : 0), r * 0.66, r * 0.26, 0, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
}

function drawGrass(el: LaidElement, g: number, sway: number) {
	if (!ctx) return;
	const h = el.size * (0.9 + 0.6 * g);
	const col =
		sr.season === 'autumn'
			? '#b7791f'
			: sr.season === 'winter'
				? '#cbd5e0'
				: shadeHex(el.accent, 26);
	ctx.save();
	ctx.translate(el.x, el.y);
	ctx.strokeStyle = col;
	ctx.lineCap = 'round';
	const blades = 5;
	for (let i = 0; i < blades; i++) {
		const off = (i - (blades - 1) / 2) * el.size * 0.14;
		const lean = sway * 0.5 + off * 0.06;
		ctx.lineWidth = Math.max(1, el.size * 0.06);
		ctx.beginPath();
		ctx.moveTo(off, 0);
		ctx.quadraticCurveTo(off + lean, -h * 0.6, off + lean * 1.6, -h);
		ctx.stroke();
	}
	ctx.restore();
}

function drawMushroom(el: LaidElement, g: number) {
	if (!ctx) return;
	const s = el.size * (0.7 + 0.5 * g);
	const caps = ['#c0392b', '#b7791f', '#8b5e34'];
	const cap = caps[hashSeed(el.seed, 'cap') % caps.length]!;
	ctx.save();
	ctx.translate(el.x, el.y);
	ctx.fillStyle = '#f3ede1';
	ctx.fillRect(-s * 0.12, -s * 0.5, s * 0.24, s * 0.5);
	ctx.fillStyle = cap;
	ctx.beginPath();
	ctx.ellipse(0, -s * 0.5, s * 0.42, s * 0.3, 0, Math.PI, 0);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = 'rgba(255,255,255,0.85)';
	for (let i = 0; i < 3; i++) {
		const dx = (seedFloatLocal(el.seed, `spot${i}`) - 0.5) * s * 0.5;
		ctx.beginPath();
		ctx.arc(dx, -s * 0.56, s * 0.05, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
}

function drawFlower(el: LaidElement, g: number, sway: number) {
	if (!ctx) return;
	if (el.variant === 'grass') return drawGrass(el, g, sway);
	if (el.variant === 'mushroom') return drawMushroom(el, g);
	// dormant blooms in winter fall back to a dry tuft
	if (sr.season === 'winter') return drawGrass(el, g, sway);
	const h = el.size * (0.8 + 0.6 * g);
	ctx.save();
	ctx.translate(el.x, el.y);
	ctx.rotate(sway * 0.04);
	ctx.strokeStyle = el.accent;
	ctx.lineWidth = Math.max(1.2, el.size * 0.07);
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.quadraticCurveTo(el.size * 0.12, -h * 0.5, 0, -h);
	ctx.stroke();
	ctx.translate(0, -h);
	const pr = el.size * 0.38 * (0.5 + 0.5 * g);
	const petals = 5;
	const petalColor = sr.season === 'autumn' ? mixHex(el.color, '#dd6b20', 0.3) : el.color;
	for (let i = 0; i < petals; i++) {
		ctx.save();
		ctx.rotate((i / petals) * Math.PI * 2 + sway * 0.08);
		ctx.fillStyle = petalColor;
		ctx.beginPath();
		ctx.ellipse(0, -pr, pr * 0.55, pr, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	}
	ctx.fillStyle = '#faf089';
	ctx.beginPath();
	ctx.arc(0, 0, pr * 0.5, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

function drawWater(el: LaidElement, g: number, time: number, lively: boolean) {
	if (!ctx) return;
	const w = el.size * (1 + 0.6 * g);
	const hh = el.size * 0.42 * (0.6 + 0.4 * g);
	const seed = hashSeed(el.seed, 'pond');
	ctx.save();
	ctx.translate(el.x, el.y);
	// soft feathered halo so ponds near the river read as one smooth body
	ctx.save();
	ctx.globalAlpha = 0.42;
	ctx.fillStyle = mixHex(el.accent, '#dbeafe', 0.5);
	traceSmoothClosed(blobPoints(seed, w * 1.1, hh * 1.16));
	ctx.fill();
	ctx.restore();
	// smooth pond body (seeded blob, no sharp edges)
	const grad = ctx.createLinearGradient(0, -hh, 0, hh);
	grad.addColorStop(0, mixHex(el.accent, '#1e3a5f', sr.nightFactor));
	grad.addColorStop(1, mixHex(el.color, '#132a44', sr.nightFactor));
	ctx.fillStyle = grad;
	traceSmoothClosed(blobPoints(seed, w, hh));
	ctx.fill();
	// faint rim light on the near edge
	ctx.strokeStyle = `rgba(255,255,255,${0.12 + (1 - sr.nightFactor) * 0.12})`;
	ctx.lineWidth = 1;
	traceSmoothClosed(blobPoints(seed, w * 0.9, hh * 0.84));
	ctx.stroke();
	if (sr.season === 'winter') {
		ctx.fillStyle = 'rgba(226,240,253,0.42)';
		traceSmoothClosed(blobPoints(seed, w, hh));
		ctx.fill();
	}
	if (lively && sr.season !== 'winter') {
		ctx.strokeStyle = 'rgba(255,255,255,0.5)';
		ctx.lineWidth = 1;
		for (let i = 1; i <= 2; i++) {
			const rp = (time * 0.00045 + i * 0.5) % 1;
			ctx.globalAlpha = (1 - rp) * 0.5;
			ctx.beginPath();
			ctx.ellipse(0, 0, w * rp, hh * rp, 0, 0, Math.PI * 2);
			ctx.stroke();
		}
		ctx.globalAlpha = 1;
	}
	ctx.restore();
}

function drawStone(el: LaidElement, g: number) {
	if (!ctx) return;
	const s = el.size * (0.6 + 0.5 * g);
	const rd = rockDetail(el.seed, s);
	ctx.save();
	ctx.translate(el.x, el.y);
	// warped body (no two rocks alike)
	const grad = ctx.createLinearGradient(0, -s, 0, s * 0.2);
	grad.addColorStop(0, shadeHex(el.color, 26));
	grad.addColorStop(1, shadeHex(el.color, -12));
	ctx.fillStyle = grad;
	traceSmoothClosed(rd.outline);
	ctx.fill();
	// lit top facet, clipped to the body
	ctx.save();
	traceSmoothClosed(rd.outline);
	ctx.clip();
	ctx.globalAlpha = rd.facet * 0.5;
	ctx.fillStyle = shadeHex(el.color, 40);
	ctx.beginPath();
	ctx.ellipse(-s * 0.2, -s * 0.62, s * 0.7, s * 0.34, -0.3, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
	// seeded cracks
	ctx.strokeStyle = shadeHex(el.color, -34);
	ctx.lineWidth = Math.max(1, s * 0.045);
	ctx.lineCap = 'round';
	for (const c of rd.cracks) {
		ctx.beginPath();
		ctx.moveTo(c.x0, c.y0);
		ctx.quadraticCurveTo((c.x0 + c.x1) / 2 + s * 0.05, (c.y0 + c.y1) / 2, c.x1, c.y1);
		ctx.stroke();
	}
	if (sr.season === 'winter') {
		ctx.fillStyle = 'rgba(255,255,255,0.82)';
		ctx.beginPath();
		ctx.ellipse(0, -s * 0.62, s * 0.72, s * 0.22, 0, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
}

function drawStar(el: LaidElement, time: number, lively: boolean) {
	if (!ctx) return;
	// stars only read against a dark sky; fade them out toward daytime
	const vis = clamp01(sr.nightFactor * 1.4);
	if (vis <= 0.02) return;
	const tw = lively ? Math.sin(time * 0.003 + el.phase) * 0.5 + 0.5 : 0.8;
	const s = el.size;
	ctx.save();
	ctx.translate(el.x, el.y);
	ctx.globalAlpha = (0.35 + tw * 0.6) * vis;
	ctx.fillStyle = el.color;
	ctx.beginPath();
	ctx.moveTo(0, -s);
	ctx.quadraticCurveTo(0, 0, s, 0);
	ctx.quadraticCurveTo(0, 0, 0, s);
	ctx.quadraticCurveTo(0, 0, -s, 0);
	ctx.quadraticCurveTo(0, 0, 0, -s);
	ctx.fill();
	ctx.globalAlpha = 1;
	ctx.restore();
}
// #endregion

// #region creatures (element-driven + ambient)
function drawBird(x: number, y: number, s: number, time: number, lively: boolean, phase: number) {
	if (!ctx) return;
	const flap = lively ? Math.sin(time * 0.012 + phase) * 0.5 + 0.5 : 0.6;
	ctx.save();
	ctx.translate(x, y);
	ctx.strokeStyle = sr.nightFactor > 0.5 ? '#0b1220' : '#334155';
	ctx.lineWidth = Math.max(1.4, s * 0.16);
	ctx.lineCap = 'round';
	const wing = s * 0.9;
	const rise = wing * (0.28 + flap * 0.5);
	ctx.beginPath();
	ctx.moveTo(-wing, 0);
	ctx.quadraticCurveTo(-wing * 0.3, -rise, 0, -rise * 0.2);
	ctx.quadraticCurveTo(wing * 0.3, -rise, wing, 0);
	ctx.stroke();
	ctx.restore();
}

function drawDragonfly(
	x: number,
	y: number,
	s: number,
	time: number,
	lively: boolean,
	phase: number,
	dir: number
) {
	if (!ctx) return;
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(dir < 0 ? -1 : 1, 1);
	ctx.strokeStyle = '#0f766e';
	ctx.lineWidth = Math.max(1.5, s * 0.16);
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(-s * 0.6, 0);
	ctx.lineTo(s * 0.6, 0);
	ctx.stroke();
	const wf = lively ? Math.sin(time * 0.05 + phase) * 0.4 + 0.7 : 0.8;
	ctx.fillStyle = 'rgba(94,234,212,0.5)';
	for (const wx of [-1, 1]) {
		for (const wy of [-1, 1]) {
			ctx.beginPath();
			ctx.ellipse(wx * s * 0.1, wy * s * 0.02, s * 0.5 * wf, s * 0.16, wx * 0.3, 0, Math.PI * 2);
			ctx.fill();
		}
	}
	ctx.restore();
}

function drawFirefly(
	x: number,
	y: number,
	s: number,
	time: number,
	lively: boolean,
	phase: number
) {
	if (!ctx) return;
	const tw = lively ? Math.sin(time * 0.005 + phase) * 0.5 + 0.5 : 0.7;
	const r = Math.max(1.5, s * 0.2);
	ctx.save();
	ctx.translate(x, y);
	const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 4);
	glow.addColorStop(0, `rgba(250,240,120,${0.4 + tw * 0.5})`);
	glow.addColorStop(1, 'rgba(250,240,120,0)');
	ctx.fillStyle = glow;
	ctx.beginPath();
	ctx.arc(0, 0, r * 4, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = `rgba(255,250,200,${0.6 + tw * 0.4})`;
	ctx.beginPath();
	ctx.arc(0, 0, r, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

function drawButterfly(el: LaidElement, time: number, lively: boolean, cx?: number, cy?: number) {
	if (!ctx) return;
	const s = el.size * (0.6 + 0.5 * el.growth);
	const flap = lively ? Math.sin(time * 0.008 + el.phase) * 0.45 + 0.55 : 0.7;
	const pinned = cx !== undefined && cy !== undefined;
	const bob = lively && !pinned ? Math.sin(time * 0.0016 + el.phase) * el.size * 0.5 : 0;
	ctx.save();
	ctx.translate(pinned ? cx! : el.x, (pinned ? cy! : el.y) + bob);
	ctx.rotate(lively && !pinned ? Math.sin(time * 0.001 + el.phase) * 0.18 : 0);
	ctx.fillStyle = el.color;
	ctx.globalAlpha = 0.92;
	ctx.beginPath();
	ctx.ellipse(-s * 0.42 * flap, -s * 0.2, s * 0.5 * flap, s * 0.42, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.beginPath();
	ctx.ellipse(s * 0.42 * flap, -s * 0.2, s * 0.5 * flap, s * 0.42, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.globalAlpha = 1;
	ctx.fillStyle = el.accent;
	ctx.fillRect(-s * 0.06, -s * 0.5, s * 0.12, s * 0.62);
	ctx.restore();
}

// element creatures pick a variant from seed + time-of-day; birds/dragonflies travel
// horizontally (wrapping), fireflies wander, butterflies flutter in place
function drawCreatureElement(el: LaidElement, time: number, lively: boolean) {
	if (!ctx) return;
	const id = 'el-' + el.seed;
	const variant = creatureVariantForSeed(el.seed, sr.timeOfDay);
	const s = el.size * (0.7 + 0.5 * el.growth);
	const dir = hashSeed(el.seed, 'dir') % 2 === 0 ? 1 : -1;
	const held = heldId === id;
	// a held creature stops traveling and rests where the finger holds it
	const drift = lively && !held;
	let x: number;
	let y: number;
	if (variant === 'bird') {
		const span = cssW + 80;
		x = ((((el.x + (drift ? time * 0.04 * dir : 0)) % span) + span) % span) - 40;
		y = el.y + (lively ? Math.sin(time * 0.002 + el.phase) * 4 : 0);
	} else if (variant === 'dragonfly') {
		const span = cssW + 40;
		x = ((((el.x + (drift ? time * 0.08 * dir : 0)) % span) + span) % span) - 20;
		y = el.y + (lively ? Math.sin(time * 0.02 + el.phase) * 10 : 0);
	} else if (variant === 'firefly') {
		x = el.x + (drift ? Math.sin(time * 0.0016 + el.phase) * 20 : 0);
		y = el.y + (drift ? Math.cos(time * 0.0021 + el.phase) * 14 : 0);
	} else {
		x = el.x;
		y = el.y;
	}
	if (held) {
		x = heldPos.x;
		y = heldPos.y;
	}
	creaturePos.set(id, { x, y, r: Math.max(16, s) });
	if (variant === 'bird') drawBird(x, y, s, time, lively, el.phase);
	else if (variant === 'dragonfly') drawDragonfly(x, y, s, time, lively, el.phase, dir);
	else if (variant === 'firefly') drawFirefly(x, y, s, time, lively, el.phase);
	else if (held) drawButterfly(el, time, lively, x, y);
	else drawButterfly(el, time, lively);
}

function drawAmbient(time: number, lively: boolean) {
	if (!ctx) return;
	const span = cssW + 80;
	for (const a of ambient) {
		const id = 'amb-' + a.seed;
		const held = heldId === id;
		const travel = lively && !held ? time * 0.001 * a.speed * a.dir : 0;
		const nx = (((a.x + travel) % 1) + 1) % 1;
		let x = nx * span - 40;
		const baseY = a.y * cssH;
		const s = 12 * a.scale;
		let y: number;
		if (a.variant === 'bird') y = baseY + (lively ? Math.sin(time * 0.002 + a.phase) * 5 : 0);
		else if (a.variant === 'dragonfly')
			y = baseY + (lively ? Math.sin(time * 0.02 + a.phase) * 12 : 0);
		else y = baseY + (lively ? Math.cos(time * 0.0021 + a.phase) * 10 : 0);
		if (held) {
			x = heldPos.x;
			y = heldPos.y;
		}
		creaturePos.set(id, { x, y, r: Math.max(16, s) });
		if (a.variant === 'bird') drawBird(x, y, s, time, lively, a.phase);
		else if (a.variant === 'dragonfly') drawDragonfly(x, y, s, time, lively, a.phase, a.dir);
		else drawFirefly(x, y, s * 0.8, time, lively, a.phase);
	}
}

// tap-spawned bursts; each returns whether it is still alive this frame
function drawLeaves(fx: Extract<GardenEffect, { kind: 'leaves' }>, elapsed: number): boolean {
	if (!ctx || elapsed > 1600) return false;
	const t = elapsed / 1600;
	const rng = mulberry32(fx.seed);
	ctx.save();
	for (let i = 0; i < 6; i++) {
		const dx = (rng() - 0.5) * 40;
		const sway = Math.sin(elapsed * 0.006 + i) * 10;
		const fall = t * (36 + rng() * 44);
		ctx.globalAlpha = (1 - t) * 0.9;
		ctx.fillStyle = fx.color;
		ctx.save();
		ctx.translate(fx.x + dx + sway, fx.y + fall);
		ctx.rotate((rng() - 0.5) * 6 + elapsed * 0.004);
		ctx.beginPath();
		ctx.ellipse(0, 0, 4, 2, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	}
	ctx.globalAlpha = 1;
	ctx.restore();
	return true;
}

function drawSplash(fx: Extract<GardenEffect, { kind: 'splash' }>, elapsed: number): boolean {
	if (!ctx || elapsed > 700) return false;
	const t = elapsed / 700;
	ctx.save();
	ctx.strokeStyle = `rgba(255,255,255,${(1 - t) * 0.7})`;
	ctx.lineWidth = 1.5;
	for (let i = 0; i < 2; i++) {
		const rr = (t + i * 0.15) * 26;
		ctx.beginPath();
		ctx.ellipse(fx.x, fx.y, rr, rr * 0.45, 0, 0, Math.PI * 2);
		ctx.stroke();
	}
	ctx.fillStyle = `rgba(210,235,255,${(1 - t) * 0.8})`;
	for (let i = 0; i < 5; i++) {
		const a = (i / 5) * Math.PI - Math.PI;
		const dr = t * 20;
		const dy = -Math.sin(t * Math.PI) * 12;
		ctx.beginPath();
		ctx.arc(fx.x + Math.cos(a) * dr, fx.y + dy + Math.sin(a) * dr * 0.4, 1.6, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
	return true;
}

function drawPetals(fx: Extract<GardenEffect, { kind: 'petals' }>, elapsed: number): boolean {
	if (!ctx || elapsed > 1200) return false;
	const t = elapsed / 1200;
	const rng = mulberry32(fx.seed);
	ctx.save();
	for (let i = 0; i < 5; i++) {
		const a = (i / 5) * Math.PI * 2 + rng() * 0.6;
		const dist = t * (14 + rng() * 12);
		ctx.globalAlpha = (1 - t) * 0.85;
		ctx.fillStyle = fx.color;
		ctx.save();
		ctx.translate(fx.x + Math.cos(a) * dist, fx.y - t * 16 + Math.sin(a) * dist * 0.6);
		ctx.rotate(a + elapsed * 0.003);
		ctx.beginPath();
		ctx.ellipse(0, 0, 3.2, 1.6, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	}
	ctx.globalAlpha = 1;
	ctx.restore();
	return true;
}

function drawEffects(now: number): void {
	if (!ctx || !effects.length) return;
	const keep: GardenEffect[] = [];
	for (const fx of effects) {
		const elapsed = now - fx.start;
		const alive =
			fx.kind === 'leaves'
				? drawLeaves(fx, elapsed)
				: fx.kind === 'splash'
					? drawSplash(fx, elapsed)
					: drawPetals(fx, elapsed);
		if (alive) keep.push(fx);
	}
	effects = keep;
}
// #endregion

// #region render loop
function easeOut(t: number): number {
	return 1 - Math.pow(1 - t, 3);
}

function render(now: number) {
	if (!ctx || !layout) return;
	if (!startTime) startTime = now;
	const time = now - startTime;

	const motion = !reduced.value;
	const lively = motion && props.garden.animated;
	const bloom = motion ? easeOut(Math.min(1, time / 1400)) : 1;
	const winter = sr.season === 'winter';

	ctx.clearRect(0, 0, cssW, cssH);
	drawSky();
	drawCelestial();
	drawHills();
	drawGround();
	drawRiver(time, lively);

	for (const el of layout.elements) {
		const g = clamp01(el.growth * bloom);
		const sway = motion ? Math.sin(time * 0.001 + el.phase) * el.sway : 0;
		const laid = el;

		// far hill elements paint small + dim for depth
		if (laid.far) {
			ctx.save();
			ctx.globalAlpha = 0.55;
			const dim = {
				...laid,
				color: mixHex(laid.color, mixHex('#8ec9a0', '#1e2f4d', sr.nightFactor), 0.5)
			};
			if (laid.kind === 'tree') drawTree(dim, g, sway);
			else drawStone(dim, g);
			ctx.restore();
			continue;
		}

		switch (laid.kind) {
			case 'tree':
				drawTree(laid, g, sway);
				break;
			case 'flower':
				drawFlower(laid, g, sway);
				break;
			case 'water':
				drawWater(laid, g, time, lively);
				break;
			case 'stone':
				drawStone(laid, g);
				break;
			case 'creature':
				drawCreatureElement(laid, time, lively);
				break;
			case 'star':
				drawStar(laid, time, lively);
				break;
		}
	}

	drawAmbient(time, lively);
	drawEffects(now);

	if (lively) {
		for (const p of particles) {
			if (winter) p.y += (p.speed / 60) * (1 + bloom);
			else p.y -= (p.speed / 60) * (1 + bloom);
			const px = p.x + Math.sin(time * 0.001 + p.phase) * p.drift;
			if (winter && p.y > cssH + 4) {
				p.y = -4;
				p.x = Math.random() * cssW;
			} else if (!winter && p.y < -4) {
				p.y = cssH + 4;
				p.x = Math.random() * cssW;
			}
			ctx.globalAlpha = 0.35 + (Math.sin(time * 0.004 + p.phase) * 0.5 + 0.5) * 0.5;
			ctx.fillStyle = p.hue;
			ctx.beginPath();
			ctx.arc(px, p.y, p.r, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}

	if (motion) raf = requestAnimationFrame(render);
}
// #endregion

// #region interaction + lifecycle
function localXY(e: PointerEvent): { x: number; y: number } {
	const rect = root.value!.getBoundingClientRect();
	return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

// tap a tree for falling leaves, water for a splash, a bloom for petals
function spawnEffect(z: HitZone, x: number, y: number): void {
	if (effects.length >= MAX_GARDEN_INTERACTION_EFFECTS) effects.shift();
	const start = performance.now();
	if (z.type === 'tree') {
		const color =
			treeFoliageForSeason(sr.season, z.el.color, z.el.seed) ?? shadeHex(z.el.accent, 20);
		effects.push({
			kind: 'leaves',
			x: z.x,
			y: z.y,
			start,
			seed: hashSeed(z.el.seed, effects.length, 'fx'),
			color
		});
	} else if (z.type === 'water') {
		effects.push({ kind: 'splash', x, y, start });
	} else {
		effects.push({
			kind: 'petals',
			x: z.x,
			y: z.y,
			start,
			seed: hashSeed(z.el.seed, effects.length, 'fx'),
			color: z.el.color
		});
	}
}

function onPointerDown(e: PointerEvent) {
	if (!root.value || !props.interactive || reduced.value) return;
	const { x, y } = localXY(e);
	// creatures sit on top and own the press-and-hold gesture
	let best: { id: string; d: number } | null = null;
	for (const [id, p] of creaturePos) {
		const d = Math.hypot(p.x - x, p.y - y);
		if (d < Math.max(20, p.r + 12) && (!best || d < best.d)) best = { id, d };
	}
	if (best) {
		heldId = best.id;
		const p = creaturePos.get(best.id)!;
		heldPos.x = p.x;
		heldPos.y = p.y;
		root.value.setPointerCapture?.(e.pointerId);
		return;
	}
	// otherwise the nearest static element responds
	let zone: HitZone | null = null;
	let zd = Infinity;
	for (const z of hitZones) {
		const d = Math.hypot(z.x - x, z.y - y);
		if (d < z.r && d < zd) {
			zone = z;
			zd = d;
		}
	}
	if (zone) spawnEffect(zone, x, y);
}

function onPointerMove(e: PointerEvent) {
	if (!heldId || !root.value) return;
	const { x, y } = localXY(e);
	heldPos.x = x;
	heldPos.y = y;
}

function onPointerUp() {
	heldId = null;
}

// full (re)start: plays the one-time bloom from zero (mount / explicit replay)
function start() {
	relayout();
	if (!ctx) return;
	startTime = 0;
	cancelAnimationFrame(raf);
	if (reduced.value) {
		// draw a single settled frame; no loop
		render(performance.now());
	} else {
		raf = requestAnimationFrame(render);
	}
}

// light refresh: re-layout for new size / data without resetting the bloom, so live
// slider drags and refetches update smoothly instead of flashing back to seedlings
function refresh() {
	relayout();
	if (!ctx) return;
	if (reduced.value) render(performance.now());
}

onMounted(() => {
	if (!import.meta.client) return;
	reduced.value = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
	start();

	if (typeof ResizeObserver !== 'undefined' && root.value) {
		ro = new ResizeObserver(() => refresh());
		ro.observe(root.value);
	}
	root.value?.addEventListener('pointerdown', onPointerDown);
	root.value?.addEventListener('pointermove', onPointerMove);
	root.value?.addEventListener('pointerup', onPointerUp);
	root.value?.addEventListener('pointercancel', onPointerUp);
	root.value?.addEventListener('pointerleave', onPointerUp);
});

// reflect data / render-config changes (studio sliders, live refetch) without a jarring
// bloom reset
watch(
	[() => props.garden, () => props.render],
	() => {
		if (import.meta.client && ctx) refresh();
	},
	{ deep: true }
);

onBeforeUnmount(() => {
	cancelAnimationFrame(raf);
	ro?.disconnect();
	root.value?.removeEventListener('pointerdown', onPointerDown);
	root.value?.removeEventListener('pointermove', onPointerMove);
	root.value?.removeEventListener('pointerup', onPointerUp);
	root.value?.removeEventListener('pointercancel', onPointerUp);
	root.value?.removeEventListener('pointerleave', onPointerUp);
});
// #endregion
</script>
