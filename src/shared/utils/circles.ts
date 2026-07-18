import type {
	CircleGarden,
	Expedition,
	ExpeditionContributor,
	ExpeditionGoal,
	GardenElement,
	GardenElementKind,
	KudosPhrase
} from 'types/circles';

// hard caps so a huge circle can never blow up the canvas
export const MAX_GARDEN_ELEMENTS = 80;
export const MAX_GARDEN_PARTICLES = 40;

export const GARDEN_ELEMENT_KINDS: GardenElementKind[] = [
	'tree',
	'flower',
	'water',
	'stone',
	'creature',
	'star'
];

// per-kind palette + label; drives both the canvas colors and the studio legend
export interface GardenElementMeta {
	label: string;
	icon: string;
	palette: string[];
	accent: string;
}

export const GARDEN_ELEMENT_META: Record<GardenElementKind, GardenElementMeta> = {
	tree: {
		label: 'Trees',
		icon: 'mdi:tree',
		palette: ['#2f855a', '#38a169', '#276749', '#48bb78'],
		accent: '#8b5e34'
	},
	flower: {
		label: 'Flowers',
		icon: 'mdi:flower',
		palette: ['#ed64a6', '#f6ad55', '#faf089', '#b794f4', '#fc8181'],
		accent: '#276749'
	},
	water: {
		label: 'Water',
		icon: 'mdi:waves',
		palette: ['#4299e1', '#63b3ed', '#90cdf4', '#3182ce'],
		accent: '#bee3f8'
	},
	stone: {
		label: 'Stones',
		icon: 'mdi:circle-outline',
		palette: ['#a0aec0', '#718096', '#cbd5e0', '#4a5568'],
		accent: '#2d3748'
	},
	creature: {
		label: 'Creatures',
		icon: 'mdi:butterfly',
		palette: ['#f6ad55', '#fc8181', '#f687b3', '#faf089'],
		accent: '#2d3748'
	},
	star: {
		label: 'Stars',
		icon: 'mdi:star-four-points',
		palette: ['#faf089', '#fefcbf', '#fbd38d', '#e9d8fd'],
		accent: '#fffff0'
	}
};

// deterministic prng — same seed, same stream (mulberry32)
export function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// stable non-negative hash for a set of numbers / a string seed source
export function hashSeed(...parts: (number | string)[]): number {
	let h = 2166136261;
	for (const part of parts) {
		const s = String(part);
		for (let i = 0; i < s.length; i++) {
			h ^= s.charCodeAt(i);
			h = Math.imul(h, 16777619);
		}
	}
	return h >>> 0;
}

export function clamp01(n: number): number {
	if (Number.isNaN(n)) return 0;
	return Math.max(0, Math.min(1, n));
}

// weighted pick over the element kinds; falls back to flower on an empty mix
export function weightedPick(
	rng: () => number,
	weights: Record<GardenElementKind, number>
): GardenElementKind {
	const entries = GARDEN_ELEMENT_KINDS.map((k) => [k, Math.max(0, weights[k] || 0)] as const);
	const total = entries.reduce((sum, [, w]) => sum + w, 0);
	if (total <= 0) return 'flower';
	let roll = rng() * total;
	for (const [kind, w] of entries) {
		roll -= w;
		if (roll <= 0) return kind;
	}
	return entries[entries.length - 1]![0];
}

// studio knob state; deterministically expands into a CircleGarden
export interface GardenSceneState {
	title: string;
	level: number; // 1..12 overall growth
	totalMinutes: number; // combined outdoor minutes
	elementCount: number; // 0..MAX_GARDEN_ELEMENTS
	seed: number; // base seed for the whole scene
	animated: boolean; // perk: animated variants
	mix: Record<GardenElementKind, number>; // relative kind weights
}

export function emptyGardenScene(): GardenSceneState {
	return {
		title: 'Circle Garden',
		level: 5,
		totalMinutes: 640,
		elementCount: 42,
		seed: 20260718,
		animated: true,
		mix: { tree: 5, flower: 6, water: 2, stone: 3, creature: 2, star: 3 }
	};
}

// curated marketing presets so a recording can jump between distinct moods fast
export const GARDEN_PRESETS: { name: string; icon: string; state: GardenSceneState }[] = [
	{
		name: 'Spring Meadow',
		icon: 'mdi:flower-tulip',
		state: {
			title: 'Spring Meadow',
			level: 6,
			totalMinutes: 720,
			elementCount: 52,
			seed: 415,
			animated: true,
			mix: { tree: 3, flower: 9, water: 1, stone: 2, creature: 4, star: 0 }
		}
	},
	{
		name: 'Night Sky',
		icon: 'mdi:weather-night',
		state: {
			title: 'Night Sky',
			level: 8,
			totalMinutes: 1180,
			elementCount: 60,
			seed: 909,
			animated: true,
			mix: { tree: 4, flower: 1, water: 2, stone: 2, creature: 1, star: 10 }
		}
	},
	{
		name: 'Riverside',
		icon: 'mdi:waves',
		state: {
			title: 'Riverside',
			level: 7,
			totalMinutes: 980,
			elementCount: 48,
			seed: 333,
			animated: true,
			mix: { tree: 5, flower: 3, water: 8, stone: 4, creature: 2, star: 1 }
		}
	},
	{
		name: 'Autumn Grove',
		icon: 'mdi:leaf-maple',
		state: {
			title: 'Autumn Grove',
			level: 9,
			totalMinutes: 1520,
			elementCount: 66,
			seed: 771,
			animated: true,
			mix: { tree: 10, flower: 3, water: 1, stone: 3, creature: 2, star: 1 }
		}
	}
];

// expand studio knobs into the same CircleGarden shape cloud would return
export function deriveMockGarden(state: GardenSceneState, ownerUid = 'mock-owner'): CircleGarden {
	const level = Math.max(1, Math.min(12, Math.round(state.level)));
	const count = Math.max(0, Math.min(MAX_GARDEN_ELEMENTS, Math.round(state.elementCount)));
	const elements: GardenElement[] = [];
	for (let i = 0; i < count; i++) {
		const seed = hashSeed(state.seed, i, 'el');
		const rng = mulberry32(seed);
		const kind = weightedPick(rng, state.mix);
		// growth trends up with level but each element keeps its own maturity
		const growth = clamp01((level / 12) * (0.55 + 0.45 * rng()));
		elements.push({ kind, seed, growth });
	}
	return {
		owner_uid: ownerUid,
		level,
		total_minutes: Math.max(0, Math.round(state.totalMinutes)),
		elements,
		animated: state.animated,
		updated_at: new Date().toISOString()
	};
}

// re-derive studio knobs from an existing garden so a saved scene reloads cleanly
export function gardenToSceneState(
	garden: CircleGarden,
	title = 'Circle Garden'
): GardenSceneState {
	const mix: Record<GardenElementKind, number> = {
		tree: 0,
		flower: 0,
		water: 0,
		stone: 0,
		creature: 0,
		star: 0
	};
	for (const el of garden.elements) mix[el.kind] = (mix[el.kind] || 0) + 1;
	return {
		title,
		level: garden.level,
		totalMinutes: garden.total_minutes,
		elementCount: garden.elements.length,
		seed: garden.elements[0] ? garden.elements[0].seed % 100000 : 1,
		animated: garden.animated,
		mix
	};
}

// a single element placed on the scene; consumed by the canvas renderer
export interface LaidElement {
	kind: GardenElementKind;
	x: number;
	y: number;
	size: number;
	depth: number; // 0 far .. 2 near
	parallax: number; // px offset per parallax unit
	color: string;
	accent: string;
	growth: number;
	phase: number; // 0..2pi sway phase
	sway: number; // sway amplitude px
	seed: number;
}

export interface GardenLayout {
	width: number;
	height: number;
	ground: number; // y of the horizon line
	level: number;
	animated: boolean;
	elements: LaidElement[];
}

// deterministic layout: same garden + same size => identical positions.
// stars sit in the sky band, everything else along the ground with depth bands
export function layoutGarden(garden: CircleGarden, width: number, height: number): GardenLayout {
	const ground = Math.round(height * 0.72);
	const laid: LaidElement[] = [];
	const capped = garden.elements.slice(0, MAX_GARDEN_ELEMENTS);

	for (const el of capped) {
		const rng = mulberry32(el.seed);
		const meta = GARDEN_ELEMENT_META[el.kind];
		const color = meta.palette[Math.floor(rng() * meta.palette.length)] || meta.palette[0]!;
		const growth = clamp01(el.growth);

		if (el.kind === 'star') {
			laid.push({
				kind: 'star',
				x: rng() * width,
				y: rng() * (ground * 0.72),
				size: 3 + growth * 6,
				depth: 0,
				parallax: 2 + rng() * 4,
				color,
				accent: meta.accent,
				growth,
				phase: rng() * Math.PI * 2,
				sway: 0,
				seed: el.seed
			});
			continue;
		}

		// three depth bands stack from horizon toward the viewer
		const depth = rng() < 0.4 ? 0 : rng() < 0.72 ? 1 : 2;
		const bandDepth = depth / 2;
		const y = ground + bandDepth * (height - ground) * 0.82 + 4;
		const depthScale = 0.62 + bandDepth * 0.75;
		const base =
			el.kind === 'tree'
				? 46
				: el.kind === 'water'
					? 60
					: el.kind === 'flower'
						? 20
						: el.kind === 'stone'
							? 22
							: 16; // creature
		const size = base * depthScale * (0.4 + 0.6 * growth);

		laid.push({
			kind: el.kind,
			x: 6 + rng() * (width - 12),
			y: el.kind === 'creature' ? y - 30 - rng() * 60 : y,
			size,
			depth,
			parallax: (depth + 0.5) * (6 + rng() * 6),
			color,
			accent: meta.accent,
			growth,
			phase: rng() * Math.PI * 2,
			sway: el.kind === 'tree' || el.kind === 'flower' ? 1.5 + growth * 3 : 0,
			seed: el.seed
		});
	}

	// painter's order: sky/far first, near last (stars first so they sit behind)
	laid.sort((a, b) => {
		if (a.kind === 'star' && b.kind !== 'star') return -1;
		if (b.kind === 'star' && a.kind !== 'star') return 1;
		return a.depth - b.depth || a.y - b.y;
	});

	return { width, height, ground, level: garden.level, animated: garden.animated, elements: laid };
}

// -------- kudos (giver-benefit, fixed set, never a tally) --------

export interface KudosPhraseMeta {
	phrase: KudosPhrase;
	label: string; // Title Case button label
	icon: string;
	hint: string; // short sentence-case helper
}

// the one warm line shown to the sender; frames the value to the giver
// (encouraging others lifts the encourager — Curry 2018 / Aknin 2013)
export const KUDOS_GIVER_NOTE = 'Encouraging someone lifts you, too.';

export const KUDOS_PHRASES: KudosPhraseMeta[] = [
	{
		phrase: 'nice_find',
		label: 'Nice Find',
		icon: 'mdi:star-four-points-outline',
		hint: 'they spotted something great'
	},
	{
		phrase: 'go_you',
		label: 'Go You',
		icon: 'mdi:hand-clap',
		hint: 'a warm well done'
	},
	{
		phrase: 'keep_going',
		label: 'Keep Going',
		icon: 'mdi:run-fast',
		hint: 'a nudge to stay with it'
	},
	{
		phrase: 'inspiring',
		label: 'Inspiring',
		icon: 'mdi:white-balance-sunny',
		hint: 'they lifted you too'
	},
	{
		phrase: 'welcome_back',
		label: 'Welcome Back',
		icon: 'mdi:hand-wave-outline',
		hint: 'glad to see them again'
	},
	{
		phrase: 'trailblazer',
		label: 'Trailblazer',
		icon: 'mdi:pine-tree',
		hint: 'first ones out there'
	}
];

export function kudosPhraseMeta(phrase: KudosPhrase): KudosPhraseMeta {
	return KUDOS_PHRASES.find((p) => p.phrase === phrase) || KUDOS_PHRASES[0]!;
}

// -------- expedition (circle-vs-challenge, contribution not rank) --------

export const EXPEDITION_GOALS: ExpeditionGoal[] = ['nature_minutes', 'trail_steps', 'quests'];

export const EXPEDITION_GOAL_META: Record<
	ExpeditionGoal,
	{ label: string; unit: string; icon: string }
> = {
	nature_minutes: { label: 'Nature Minutes', unit: 'min', icon: 'mdi:timer-sand' },
	trail_steps: { label: 'Trail Steps', unit: 'steps', icon: 'mdi:shoe-print' },
	quests: { label: 'Quests', unit: 'quests', icon: 'mdi:flag-checkered' }
};

// ready-made {label,value} list for a goal select
export const EXPEDITION_GOAL_OPTIONS: { label: string; value: ExpeditionGoal }[] =
	EXPEDITION_GOALS.map((g) => ({ label: EXPEDITION_GOAL_META[g].label, value: g }));

export function expeditionPercent(exp: Pick<Expedition, 'progress' | 'target'>): number {
	if (!exp || exp.target <= 0) return 0;
	return clamp01(exp.progress / exp.target);
}

export function expeditionRemaining(exp: Pick<Expedition, 'progress' | 'target'>): number {
	if (!exp) return 0;
	return Math.max(0, exp.target - exp.progress);
}

// share of the combined total, framed as contribution (not a rank/position)
export function contributorShare(exp: Expedition, uid: string): number {
	const c = exp?.contributors?.find((x) => x.uid === uid);
	if (!c) return 0;
	const total = exp.contributors.reduce((s, x) => s + Math.max(0, x.contribution), 0);
	if (total <= 0) return 0;
	return clamp01(c.contribution / total);
}

// ordered by contribution for a calm co-op visual; no positions are ever shown
export function orderedContributors(exp: Expedition): ExpeditionContributor[] {
	return [...(exp?.contributors ?? [])].sort((a, b) => b.contribution - a.contribution);
}

export function expeditionTimeLeft(
	exp: Pick<Expedition, 'ends_at'>,
	now: number = Date.now()
): { expired: boolean; days: number; hours: number } {
	const end = exp?.ends_at ? Date.parse(exp.ends_at) : NaN;
	if (Number.isNaN(end)) return { expired: false, days: 0, hours: 0 };
	const ms = end - now;
	if (ms <= 0) return { expired: true, days: 0, hours: 0 };
	const days = Math.floor(ms / 86400000);
	const hours = Math.floor((ms % 86400000) / 3600000);
	return { expired: false, days, hours };
}

// stable warm color per contributor uid so the ring segments are consistent
const CONTRIBUTOR_COLORS = [
	'#38a169',
	'#4299e1',
	'#ed8936',
	'#9f7aea',
	'#ed64a6',
	'#48bb78',
	'#f6ad55'
];

export function contributorColor(uid: string): string {
	return CONTRIBUTOR_COLORS[hashSeed(uid) % CONTRIBUTOR_COLORS.length]!;
}
