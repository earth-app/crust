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
// layout, SSR-safe (drawing gated behind onMounted), reduced-motion aware, element capped
const props = withDefaults(
	defineProps<{
		garden: CircleGarden;
		height?: number | string;
		interactive?: boolean;
		caption?: string;
		showCaption?: boolean;
	}>(),
	{
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

const defaultCaption = computed(() => 'Your Circle Garden');

const ariaLabel = computed(() => {
	const counts = new Map<GardenElementKind, number>();
	for (const el of props.garden.elements) counts.set(el.kind, (counts.get(el.kind) ?? 0) + 1);
	const parts = GARDEN_ELEMENT_KINDS.filter((k) => counts.get(k)).map(
		(k) => `${counts.get(k)} ${GARDEN_ELEMENT_META[k].label.toLowerCase()}`
	);
	return `A shared circle garden at growth level ${props.garden.level}, with ${parts.join(', ') || 'young sprouts'}`;
});

// --- deterministic scene state (recomputed on size / data change) ---
let ctx: CanvasRenderingContext2D | null = null;
let raf = 0;
let dpr = 1;
let cssW = 0;
let cssH = 0;
let layout: GardenLayout | null = null;
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

// smoothed parallax toward the pointer target
const parallax = { x: 0, y: 0, tx: 0, ty: 0 };

const nightFactor = computed(() => {
	const total = Math.max(1, props.garden.elements.length);
	const stars = props.garden.elements.filter((e) => e.kind === 'star').length;
	return clamp01((stars / total - 0.15) * 2.2);
});

function hexToRgb(hex: string): [number, number, number] {
	const h = hex.replace('#', '');
	const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number): string {
	const [ar, ag, ab] = hexToRgb(a);
	const [br, bg, bb] = hexToRgb(b);
	const r = Math.round(ar + (br - ar) * t);
	const g = Math.round(ag + (bg - ag) * t);
	const bl = Math.round(ab + (bb - ab) * t);
	return `rgb(${r}, ${g}, ${bl})`;
}

function shade(hex: string, amount: number): string {
	const [r, g, b] = hexToRgb(hex);
	const adj = (v: number) => Math.max(0, Math.min(255, v + amount));
	return `rgb(${adj(r)}, ${adj(g)}, ${adj(b)})`;
}

function buildParticles() {
	particles = [];
	if (!layout || !props.garden.animated) return;
	// pollen / fireflies capped so a huge garden never blows up the loop
	const count = Math.min(MAX_GARDEN_PARTICLES, Math.round(6 + props.garden.level * 2.4));
	const rng = mulberry32(hashSeed(props.garden.level, props.garden.elements.length, 'particles'));
	for (let i = 0; i < count; i++) {
		particles.push({
			x: rng() * cssW,
			y: rng() * cssH,
			r: 0.8 + rng() * 1.8,
			speed: 4 + rng() * 10,
			drift: (rng() - 0.5) * 12,
			phase: rng() * Math.PI * 2,
			hue: nightFactor.value > 0.5 ? '#fef9c3' : '#ffffff'
		});
	}
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
	layout = layoutGarden(props.garden, cssW, cssH);
	buildParticles();
}

function drawSky(time: number) {
	if (!ctx) return;
	const nf = nightFactor.value;
	const top = mix('#a9dcf5', '#0a1836', nf);
	const horizon = mix('#fbe4c0', '#243056', nf);
	const grad = ctx.createLinearGradient(0, 0, 0, layout!.ground);
	grad.addColorStop(0, top);
	grad.addColorStop(1, horizon);
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, cssW, layout!.ground + 2);

	// celestial body (sun by day, moon by night) with a soft glow
	const cx = cssW * 0.78 - parallax.x * 8;
	const cy = layout!.ground * 0.32 - parallax.y * 4;
	const r = Math.max(16, cssW * 0.05);
	const glow = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 3);
	glow.addColorStop(0, nf > 0.5 ? 'rgba(226,232,240,0.55)' : 'rgba(255,236,179,0.7)');
	glow.addColorStop(1, 'rgba(255,255,255,0)');
	ctx.fillStyle = glow;
	ctx.beginPath();
	ctx.arc(cx, cy, r * 3, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = nf > 0.5 ? '#e2e8f0' : '#fff7d6';
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.fill();
}

function drawHills(time: number) {
	if (!ctx || !layout) return;
	const bands = [
		{ y: layout.ground - 8, amp: 18, color: mix('#8ec9a0', '#1e2f4d', nightFactor.value), px: 0.4 },
		{ y: layout.ground - 2, amp: 26, color: mix('#6fb587', '#16233c', nightFactor.value), px: 0.7 }
	];
	for (const band of bands) {
		const off = -parallax.x * band.px * 10;
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

function drawGround() {
	if (!ctx || !layout) return;
	const grad = ctx.createLinearGradient(0, layout.ground, 0, cssH);
	grad.addColorStop(0, mix('#5aa06a', '#233a2c', nightFactor.value));
	grad.addColorStop(1, mix('#3f7d4f', '#16261c', nightFactor.value));
	ctx.fillStyle = grad;
	ctx.fillRect(0, layout.ground, cssW, cssH - layout.ground);
}

function drawBlob(x: number, y: number, r: number, color: string) {
	if (!ctx) return;
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.fill();
}

function drawTree(el: LaidElement, g: number, sway: number) {
	if (!ctx) return;
	const h = el.size * (0.9 + 0.7 * g);
	const trunkW = Math.max(2, el.size * 0.14);
	ctx.save();
	ctx.translate(el.x, el.y);
	ctx.rotate(sway * 0.02);
	ctx.fillStyle = el.accent;
	ctx.beginPath();
	ctx.moveTo(-trunkW / 2, 0);
	ctx.lineTo(trunkW / 2, 0);
	ctx.lineTo(trunkW * 0.3, -h * 0.55);
	ctx.lineTo(-trunkW * 0.3, -h * 0.55);
	ctx.closePath();
	ctx.fill();
	const cy = -h * 0.62;
	const r = el.size * 0.6 * (0.55 + 0.45 * g);
	drawBlob(-r * 0.55, cy + r * 0.2, r * 0.8, shade(el.color, -18));
	drawBlob(r * 0.55, cy + r * 0.15, r * 0.85, shade(el.color, 12));
	drawBlob(0, cy - r * 0.5, r * 0.72, shade(el.color, 22));
	drawBlob(0, cy, r, el.color);
	ctx.restore();
}

function drawFlower(el: LaidElement, g: number, sway: number) {
	if (!ctx) return;
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
	for (let i = 0; i < petals; i++) {
		ctx.save();
		ctx.rotate((i / petals) * Math.PI * 2 + sway * 0.08);
		ctx.fillStyle = el.color;
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
	const hh = el.size * 0.4 * (0.6 + 0.4 * g);
	ctx.save();
	ctx.translate(el.x, el.y);
	const grad = ctx.createLinearGradient(0, -hh, 0, hh);
	grad.addColorStop(0, el.accent);
	grad.addColorStop(1, el.color);
	ctx.fillStyle = grad;
	ctx.beginPath();
	ctx.ellipse(0, 0, w, hh, 0, 0, Math.PI * 2);
	ctx.fill();
	if (lively) {
		ctx.strokeStyle = 'rgba(255,255,255,0.55)';
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
	ctx.save();
	ctx.translate(el.x, el.y);
	const grad = ctx.createLinearGradient(0, -s, 0, 0);
	grad.addColorStop(0, shade(el.color, 24));
	grad.addColorStop(1, el.color);
	ctx.fillStyle = grad;
	ctx.beginPath();
	ctx.ellipse(0, -s * 0.3, s, s * 0.6, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

function drawCreature(el: LaidElement, g: number, time: number, lively: boolean) {
	if (!ctx) return;
	const s = el.size * (0.6 + 0.5 * g);
	const flap = lively ? Math.sin(time * 0.008 + el.phase) * 0.45 + 0.55 : 0.7;
	const bob = lively ? Math.sin(time * 0.0016 + el.phase) * el.size * 0.5 : 0;
	ctx.save();
	ctx.translate(el.x, el.y + bob);
	ctx.rotate(lively ? Math.sin(time * 0.001 + el.phase) * 0.18 : 0);
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

function drawStar(el: LaidElement, time: number, lively: boolean) {
	if (!ctx) return;
	const tw = lively ? Math.sin(time * 0.003 + el.phase) * 0.5 + 0.5 : 0.8;
	const s = el.size;
	ctx.save();
	ctx.translate(el.x, el.y);
	ctx.globalAlpha = 0.35 + tw * 0.6;
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

	// ease parallax toward the pointer target
	parallax.x += (parallax.tx - parallax.x) * 0.06;
	parallax.y += (parallax.ty - parallax.y) * 0.06;

	ctx.clearRect(0, 0, cssW, cssH);
	drawSky(time);
	drawHills(time);
	drawGround();

	for (const el of layout.elements) {
		const g = clamp01(el.growth * bloom);
		const sway = motion ? Math.sin(time * 0.001 + el.phase) * el.sway : 0;
		const ox = motion && props.interactive ? -parallax.x * el.parallax : 0;
		const oy = motion && props.interactive ? -parallax.y * el.parallax * 0.4 : 0;
		const laid = ox || oy ? { ...el, x: el.x + ox, y: el.y + oy } : el;

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
				drawCreature(laid, g, time, lively);
				break;
			case 'star':
				drawStar(laid, time, lively);
				break;
		}
	}

	if (lively) {
		for (const p of particles) {
			p.y -= (p.speed / 60) * (1 + bloom);
			const px = p.x + Math.sin(time * 0.001 + p.phase) * p.drift;
			if (p.y < -4) {
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

function onPointer(e: PointerEvent) {
	if (!root.value || !props.interactive || reduced.value) return;
	const rect = root.value.getBoundingClientRect();
	parallax.tx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
	parallax.ty = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
}

function onLeave() {
	parallax.tx = 0;
	parallax.ty = 0;
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
	root.value?.addEventListener('pointermove', onPointer);
	root.value?.addEventListener('pointerleave', onLeave);
});

// reflect data changes (studio sliders, live refetch) without a jarring bloom reset
watch(
	() => props.garden,
	() => {
		if (import.meta.client && ctx) refresh();
	},
	{ deep: true }
);

onBeforeUnmount(() => {
	cancelAnimationFrame(raf);
	ro?.disconnect();
	root.value?.removeEventListener('pointermove', onPointer);
	root.value?.removeEventListener('pointerleave', onLeave);
});
</script>
