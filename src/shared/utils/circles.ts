import type {
	CircleGarden,
	Expedition,
	ExpeditionContributor,
	ExpeditionGoal,
	GardenElement,
	GardenElementKind,
	GardenRenderConfig,
	GardenSeason,
	GardenTimeOfDay,
	KudosPhrase
} from 'types/circles';

// hard caps so a huge circle can never blow up the canvas
export const MAX_GARDEN_ELEMENTS = 80;
export const MAX_GARDEN_PARTICLES = 40;
// ambient birds/dragonflies/fireflies live apart from pollen particles
export const MAX_GARDEN_CREATURES = 12;
// tap-spawned leaf/splash/petal bursts; oldest is dropped past the cap
export const MAX_GARDEN_INTERACTION_EFFECTS = 20;
// the river only carves in once the shared garden is well grown
export const RIVER_LEVEL_THRESHOLD = 6;

export const GARDEN_SEASONS: GardenSeason[] = ['spring', 'summer', 'autumn', 'winter'];
export const GARDEN_TIMES_OF_DAY: GardenTimeOfDay[] = ['dawn', 'day', 'dusk', 'night'];

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

// #region hex color helpers (shared by layout + canvas painters)

export function hexToRgb(hex: string): [number, number, number] {
	const h = hex.replace('#', '');
	const full = h.length === 3 ? h.replace(/(.)/g, '$1$1') : h;
	const n = parseInt(full, 16);
	if (Number.isNaN(n)) return [0, 0, 0];
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex2(v: number): string {
	return Math.max(0, Math.min(255, Math.round(v)))
		.toString(16)
		.padStart(2, '0');
}

// linear blend a -> b by t (0..1), returned as #rrggbb
export function mixHex(a: string, b: string, t: number): string {
	const k = clamp01(t);
	const [ar, ag, ab] = hexToRgb(a);
	const [br, bg, bb] = hexToRgb(b);
	return `#${toHex2(ar + (br - ar) * k)}${toHex2(ag + (bg - ag) * k)}${toHex2(ab + (bb - ab) * k)}`;
}

// lighten (amount>0) or darken (amount<0) a hex by a fixed rgb delta
export function shadeHex(hex: string, amount: number): string {
	const [r, g, b] = hexToRgb(hex);
	return `#${toHex2(r + amount)}${toHex2(g + amount)}${toHex2(b + amount)}`;
}

// #endregion

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

// #region season / time-of-day / moon (deterministic, no backend)

// northern-hemisphere meteorological season from the month; a negative latitude flips it
export function seasonForDate(date: Date, latitude = 0): GardenSeason {
	const m = date.getMonth();
	const northern: GardenSeason =
		m <= 1 || m === 11 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn';
	if (latitude >= 0) return northern;
	const flip: Record<GardenSeason, GardenSeason> = {
		winter: 'summer',
		summer: 'winter',
		spring: 'autumn',
		autumn: 'spring'
	};
	return flip[northern];
}

export function timeOfDayForDate(date: Date): GardenTimeOfDay {
	const h = date.getHours();
	if (h < 5 || h >= 20) return 'night';
	if (h < 8) return 'dawn';
	if (h < 17) return 'day';
	return 'dusk';
}

export function isNightTime(t: GardenTimeOfDay): boolean {
	return t === 'night';
}

// 0 bright day .. 1 deep night; dawn/dusk sit in between for a warm gradient
export function nightFactorForTime(t: GardenTimeOfDay): number {
	switch (t) {
		case 'night':
			return 1;
		case 'dusk':
			return 0.68;
		case 'dawn':
			return 0.55;
		default:
			return 0;
	}
}

// reference new moon 2000-01-06 18:14 UTC + mean synodic month
const MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14);
const SYNODIC_MONTH_MS = 29.53058867 * 86400000;

// 0..1 lunar phase (0/1 new, 0.5 full) — deterministic from the timestamp
export function moonPhaseForDate(date: Date): number {
	const elapsed = date.getTime() - MOON_EPOCH;
	let phase = (elapsed % SYNODIC_MONTH_MS) / SYNODIC_MONTH_MS;
	if (phase < 0) phase += 1;
	return phase;
}

const MOON_PHASE_NAMES = [
	'New Moon',
	'Waxing Crescent',
	'First Quarter',
	'Waxing Gibbous',
	'Full Moon',
	'Waning Gibbous',
	'Last Quarter',
	'Waning Crescent'
];

// wrap any phase into [0,1)
export function normalizeMoonPhase(phase: number): number {
	if (Number.isNaN(phase)) return 0;
	return ((phase % 1) + 1) % 1;
}

export function moonPhaseName(phase: number): string {
	return MOON_PHASE_NAMES[Math.round(normalizeMoonPhase(phase) * 8) % 8]!;
}

// illuminated disc fraction (0 new .. 1 full); drives glow strength + the drawn shape
export function moonIlluminatedFraction(phase: number): number {
	return (1 - Math.cos(normalizeMoonPhase(phase) * 2 * Math.PI)) / 2;
}

export interface ResolvedGardenRender {
	season: GardenSeason;
	timeOfDay: GardenTimeOfDay;
	moonPhase: number;
	nightFactor: number;
	latitude: number;
}

// merge explicit overrides (studio) over date-derived defaults (real gardens)
export function resolveGardenRender(
	config: GardenRenderConfig | null | undefined,
	date: Date = new Date()
): ResolvedGardenRender {
	const latitude = config?.latitude ?? 0;
	const season = config?.season ?? seasonForDate(date, latitude);
	const timeOfDay = config?.timeOfDay ?? timeOfDayForDate(date);
	const moonPhase = normalizeMoonPhase(config?.moonPhase ?? moonPhaseForDate(date));
	return { season, timeOfDay, moonPhase, nightFactor: nightFactorForTime(timeOfDay), latitude };
}

// #endregion

// #region deterministic element variants (stable per seed)

export type TreeVariant = 'round' | 'tall' | 'conifer';
export type FlowerVariant = 'bloom' | 'grass' | 'mushroom';
export type CreatureVariant = 'butterfly' | 'bird' | 'firefly' | 'dragonfly';

// small stable float in [0,1) from a seed + salt, independent of any rng stream
function seedFloat(seed: number, salt: string): number {
	return mulberry32(hashSeed(seed, salt))();
}

export function treeVariantForSeed(seed: number): TreeVariant {
	const r = hashSeed(seed, 'tree-variant') % 3;
	return r === 0 ? 'tall' : r === 1 ? 'conifer' : 'round';
}

// 0.6..1.4 trunk-height multiplier so a grove is never uniform
export function trunkHeightForSeed(seed: number): number {
	return 0.6 + seedFloat(seed, 'trunk') * 0.8;
}

export function flowerVariantForSeed(seed: number): FlowerVariant {
	const r = hashSeed(seed, 'flower-variant') % 5;
	if (r === 0) return 'mushroom';
	if (r === 1 || r === 2) return 'grass';
	return 'bloom';
}

// time-of-day gates the fauna: fireflies only at night, dragonflies only by day
export function creatureVariantForSeed(seed: number, timeOfDay: GardenTimeOfDay): CreatureVariant {
	const night = isNightTime(timeOfDay);
	const r = hashSeed(seed, 'creature-variant') % 3;
	if (night) return r === 0 ? 'bird' : 'firefly';
	return r === 0 ? 'bird' : r === 1 ? 'dragonfly' : 'butterfly';
}

// seasonal tree foliage; winter returns null (bare branches, snow instead of leaves)
export function treeFoliageForSeason(
	season: GardenSeason,
	base: string,
	seed: number
): string | null {
	if (season === 'winter') return null;
	if (season === 'summer') return base;
	if (season === 'spring') return mixHex(base, '#d9f99d', 0.4); // lighter fresh green
	// autumn — warm palette pick, stable per seed
	const warm = ['#d97706', '#b45309', '#dc2626', '#ea580c', '#ca8a04'];
	return warm[hashSeed(seed, 'autumn') % warm.length]!;
}

// #endregion

// #region generative geometry (smooth blobs + detailed rocks, deterministic)

export interface Point {
	x: number;
	y: number;
}

// a closed ring of seeded points around an ellipse; smoothed into a blob by the caller.
// same seed -> same jitter, so a scaled call (halo) stays concentric with the base shape
export function blobPoints(
	seed: number,
	rx: number,
	ry: number,
	count = 14,
	minR = 0.78,
	maxR = 1.18
): Point[] {
	const rng = mulberry32(seed >>> 0);
	const ratios: number[] = [];
	for (let i = 0; i < count; i++) ratios.push(minR + rng() * (maxR - minR));
	const pts: Point[] = [];
	for (let i = 0; i < count; i++) {
		const a = (i / count) * Math.PI * 2;
		const r = ratios[i]!;
		pts.push({ x: Math.cos(a) * rx * r, y: Math.sin(a) * ry * r });
	}
	return pts;
}

export interface RockDetail {
	// warped silhouette, centered so the base rests near y=0
	outline: Point[];
	// a few surface cracks
	cracks: { x0: number; y0: number; x1: number; y1: number }[];
	// 0..1 strength of the lit top facet
	facet: number;
}

// a rock is a squashed, warped blob plus 1-2 seeded cracks and a lit facet — no two alike
export function rockDetail(seed: number, size: number): RockDetail {
	const rng = mulberry32(hashSeed(seed, 'rock'));
	const pts = 12;
	const cy = -size * 0.34;
	const outline: Point[] = [];
	for (let i = 0; i < pts; i++) {
		const a = (i / pts) * Math.PI * 2;
		const jr = 0.8 + rng() * 0.36;
		outline.push({ x: Math.cos(a) * size * jr, y: cy + Math.sin(a) * size * 0.55 * jr });
	}
	const cracks: { x0: number; y0: number; x1: number; y1: number }[] = [];
	const crackCount = 1 + (hashSeed(seed, 'cracks') % 2);
	for (let i = 0; i < crackCount; i++) {
		const cx = (rng() - 0.5) * size * 0.7;
		const top = cy - size * (0.1 + rng() * 0.32);
		const bend = (rng() - 0.5) * size * 0.36;
		cracks.push({ x0: cx, y0: top, x1: cx + bend, y1: cy + size * 0.2 });
	}
	return { outline, cracks, facet: 0.4 + rng() * 0.4 };
}

// #endregion

// #region ambient fauna (capped, deterministic, normalized 0..1)

export interface AmbientCreature {
	variant: Exclude<CreatureVariant, 'butterfly'>;
	x: number; // 0..1 start
	y: number; // 0..1 height band
	dir: 1 | -1; // horizontal direction
	speed: number; // normalized units / sec
	phase: number; // 0..2pi
	scale: number; // 0.6..1.2
	seed: number;
}

// birds any time (fly horizontally, either direction), fireflies at night, zig-zag
// dragonflies by day; capped so the render loop can never blow up
export function planAmbientCreatures(
	seed: number,
	timeOfDay: GardenTimeOfDay,
	count = 8
): AmbientCreature[] {
	const n = Math.max(0, Math.min(MAX_GARDEN_CREATURES, Math.floor(count)));
	const night = isNightTime(timeOfDay);
	const rng = mulberry32(hashSeed(seed, 'ambient', timeOfDay));
	const out: AmbientCreature[] = [];
	for (let i = 0; i < n; i++) {
		const roll = rng();
		const variant: AmbientCreature['variant'] = night
			? roll < 0.55
				? 'firefly'
				: 'bird'
			: roll < 0.4
				? 'bird'
				: 'dragonfly';
		const dir: 1 | -1 = rng() < 0.5 ? -1 : 1;
		// birds ride high in the sky; dragonflies mid; fireflies hug the grass (>=0.72 ground
		// line) so none of them float in the empty sky above the hill
		const y =
			variant === 'bird'
				? 0.1 + rng() * 0.24
				: variant === 'firefly'
					? 0.74 + rng() * 0.16
					: 0.52 + rng() * 0.2;
		const speed =
			variant === 'dragonfly'
				? 0.12 + rng() * 0.1
				: variant === 'bird'
					? 0.05 + rng() * 0.05
					: 0.015 + rng() * 0.02;
		out.push({
			variant,
			x: rng(),
			y,
			dir,
			speed,
			phase: rng() * Math.PI * 2,
			scale: 0.6 + rng() * 0.6,
			seed: hashSeed(seed, i, 'amb')
		});
	}
	return out;
}

// #endregion

// studio knob state; deterministically expands into a CircleGarden. the trailing
// season/time/moon fields are optional render overrides (undefined / 'auto' = derive
// from the current date) so existing saved scenes + presets stay valid
export interface GardenSceneState {
	title: string;
	level: number; // 1..12 overall growth
	totalMinutes: number; // combined outdoor minutes
	elementCount: number; // 0..MAX_GARDEN_ELEMENTS
	seed: number; // base seed for the whole scene
	animated: boolean; // perk: animated variants
	mix: Record<GardenElementKind, number>; // relative kind weights
	season?: GardenSeason | 'auto'; // 'auto' derives from the date
	timeOfDay?: GardenTimeOfDay | 'auto'; // 'auto' derives from the clock
	moonPhase?: number | null; // null/undefined = derive from the date
}

export function emptyGardenScene(): GardenSceneState {
	return {
		title: 'Circle Garden',
		level: 5,
		totalMinutes: 640,
		elementCount: 42,
		seed: 20260718,
		animated: true,
		mix: { tree: 5, flower: 6, water: 2, stone: 3, creature: 2, star: 3 },
		season: 'auto',
		timeOfDay: 'auto',
		moonPhase: null
	};
}

// map studio knobs to the optional render overrides Garden.vue accepts ('auto'/null
// collapse to undefined so the component falls back to date-derived values)
export function sceneRenderConfig(state: GardenSceneState): GardenRenderConfig {
	return {
		season: !state.season || state.season === 'auto' ? undefined : state.season,
		timeOfDay: !state.timeOfDay || state.timeOfDay === 'auto' ? undefined : state.timeOfDay,
		moonPhase: state.moonPhase == null ? undefined : normalizeMoonPhase(state.moonPhase)
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
	variant: string; // kind-specific sub-variant (tree/flower)
	far: boolean; // painted small + dim on the back hill band
	trunk: number; // 0..1.4 trunk-height factor (trees), 0 otherwise
}

export interface GardenLayout {
	width: number;
	height: number;
	ground: number; // y of the horizon line
	level: number;
	animated: boolean;
	river: boolean; // full left->right stream past the growth threshold
	riverY: number; // center y of the river band
	elements: LaidElement[];
}

interface XZone {
	x0: number;
	x1: number;
}

function overlapsZone(x: number, halfW: number, zones: XZone[]): boolean {
	return zones.some((z) => x + halfW > z.x0 && x - halfW < z.x1);
}

// widest free center within [halfW, width-halfW], avoiding the given zones
function freeGapCenter(width: number, halfW: number, zones: XZone[]): number {
	const lo = halfW;
	const hi = width - halfW;
	if (hi <= lo) return width / 2;
	const sorted = [...zones].sort((a, b) => a.x0 - b.x0);
	let cursor = lo;
	let best = (lo + hi) / 2;
	let bestGap = -1;
	for (const z of sorted) {
		const gapEnd = Math.min(z.x0, hi);
		if (gapEnd - cursor > bestGap) {
			bestGap = gapEnd - cursor;
			best = (cursor + gapEnd) / 2;
		}
		cursor = Math.max(cursor, Math.min(z.x1, hi));
		if (cursor >= hi) break;
	}
	if (hi - cursor > bestGap) best = (cursor + hi) / 2;
	return Math.max(lo, Math.min(hi, best));
}

// deterministic x avoiding the occupied zones; a private seeded stream keeps the
// attempts stable regardless of processing order
function placeX(seed: number, width: number, halfW: number, zones: XZone[]): number {
	if (width - 2 * halfW <= 0) return width / 2;
	const xr = mulberry32(hashSeed(seed, 'x'));
	for (let i = 0; i < 6; i++) {
		const x = halfW + xr() * (width - 2 * halfW);
		if (!overlapsZone(x, halfW, zones)) return x;
	}
	return freeGapCenter(width, halfW, zones);
}

// deterministic layout: same garden + same size => identical positions. stars sit in
// the sky band; water is placed first as ground-level, then land elements are placed
// off the water (no trees/stones/mushrooms on water); a subset rides the back hill
// the drawn back-hill silhouette y at x; shared by layout + painter so far elements sit
// ON the hill instead of floating above it (matches drawHills' back band)
export function backHillTopY(x: number, ground: number): number {
	return ground - 8 + Math.sin(x * 0.012) * 18;
}

export type AquaticVariant = 'lilypad' | 'cattail' | 'frog' | 'beaver_dam';

// water elements decorate the single river: mostly lilypads, cattails at the banks, the
// occasional frog, and one beaver dam on a well-grown, water-rich garden
export function aquaticVariantForSeed(
	seed: number,
	index: number,
	total: number,
	level: number
): AquaticVariant {
	if (index === 0 && total >= 3 && level >= 8) return 'beaver_dam';
	const r = hashSeed(seed, 'aquatic') % 10;
	if (r < 5) return 'lilypad';
	if (r < 8) return 'cattail';
	return 'frog';
}

export function layoutGarden(garden: CircleGarden, width: number, height: number): GardenLayout {
	const ground = Math.round(height * 0.72);
	const span = height - ground;
	const capped = garden.elements.slice(0, MAX_GARDEN_ELEMENTS);
	// the river is the SINGLE water body; every water element enriches it (lilypads,
	// cattails, frogs, a beaver dam) instead of spawning a separate pond
	const waterCount = capped.reduce((n, e) => n + (e.kind === 'water' ? 1 : 0), 0);
	const river = garden.level >= RIVER_LEVEL_THRESHOLD || waterCount > 0;
	const riverY = ground + span * 0.4;
	// more water budget => a wider, richer river
	const riverHalf = Math.max(8, span * 0.09) * (1 + Math.min(waterCount, 8) * 0.05);
	const stars: LaidElement[] = [];
	const farBand: LaidElement[] = [];
	const water: LaidElement[] = [];
	const trees: LaidElement[] = [];
	const stones: LaidElement[] = [];
	const flowers: LaidElement[] = [];
	const creatures: LaidElement[] = [];

	const treeXs: number[] = [];

	const baseSize = (kind: GardenElementKind): number =>
		kind === 'tree'
			? 46
			: kind === 'water'
				? 60
				: kind === 'flower'
					? 20
					: kind === 'stone'
						? 22
						: 16;
	const halfWidthOf = (kind: GardenElementKind, size: number): number =>
		kind === 'water' ? size : kind === 'tree' ? size * 0.55 : kind === 'stone' ? size : size * 0.5;

	// shared per-element scalars derived from salted seeds (order-independent)
	const bandOf = (seed: number): number => {
		const r = seedFloat(seed, 'band');
		return r < 0.4 ? 0 : r < 0.72 ? 1 : 2;
	};
	const groundY = (depth: number): number => ground + (depth / 2) * span * 0.82 + 4;
	const scaleOf = (depth: number): number => 0.62 + (depth / 2) * 0.75;
	const colorOf = (kind: GardenElementKind, seed: number): string => {
		const pal = GARDEN_ELEMENT_META[kind].palette;
		return pal[Math.floor(seedFloat(seed, 'color') * pal.length)] || pal[0]!;
	};
	// keep a ground element off the river ribbon by lifting it onto the near bank
	const dodgeRiver = (y: number): number =>
		river && Math.abs(y - riverY) < riverHalf ? riverY - riverHalf - 4 : y;

	for (const el of capped) {
		const seed = el.seed;
		const meta = GARDEN_ELEMENT_META[el.kind];
		const growth = clamp01(el.growth);
		const color = colorOf(el.kind, seed);

		if (el.kind === 'star') {
			stars.push({
				kind: 'star',
				x: seedFloat(seed, 'starX') * width,
				y: seedFloat(seed, 'starY') * (ground * 0.72),
				size: 3 + growth * 6,
				depth: 0,
				parallax: 2 + seedFloat(seed, 'starPlx') * 4,
				color,
				accent: meta.accent,
				growth,
				phase: seedFloat(seed, 'phase') * Math.PI * 2,
				sway: 0,
				seed,
				variant: '',
				far: false,
				trunk: 0
			});
			continue;
		}

		// a slice of trees/stones ride the far hill band, small + dim, behind everything
		const far = (el.kind === 'tree' || el.kind === 'stone') && seedFloat(seed, 'far') < 0.22;
		if (far) {
			const size = baseSize(el.kind) * 0.42 * (0.5 + 0.5 * growth);
			// sit far elements exactly ON the back-hill surface at their x (drawn after the
			// ground, so valley points read as grounded on the grass, never floating)
			const fx = 12 + seedFloat(seed, 'farX') * (width - 24);
			farBand.push({
				kind: el.kind,
				x: fx,
				y: backHillTopY(fx, ground) + size * 0.12,
				size,
				depth: 0,
				parallax: 1 + seedFloat(seed, 'plx') * 2,
				color,
				accent: meta.accent,
				growth,
				phase: seedFloat(seed, 'phase') * Math.PI * 2,
				sway: el.kind === 'tree' ? 1 + growth * 1.5 : 0,
				seed,
				variant: el.kind === 'tree' ? treeVariantForSeed(seed) : '',
				far: true,
				trunk: el.kind === 'tree' ? trunkHeightForSeed(seed) : 0
			});
			continue;
		}

		const depth = bandOf(seed);
		const size = baseSize(el.kind) * scaleOf(depth) * (0.4 + 0.6 * growth);
		const laid: LaidElement = {
			kind: el.kind,
			x: 0, // filled per-kind below
			y: groundY(depth),
			size,
			depth,
			parallax: (depth + 0.5) * (6 + seedFloat(seed, 'plx') * 6),
			color,
			accent: meta.accent,
			growth,
			phase: seedFloat(seed, 'phase') * Math.PI * 2,
			sway: el.kind === 'tree' || el.kind === 'flower' ? 1.5 + growth * 3 : 0,
			seed,
			variant:
				el.kind === 'tree'
					? treeVariantForSeed(seed)
					: el.kind === 'flower'
						? flowerVariantForSeed(seed)
						: '',
			trunk: el.kind === 'tree' ? trunkHeightForSeed(seed) : 0,
			far: false
		};

		if (el.kind === 'water') water.push(laid);
		else if (el.kind === 'tree') trees.push(laid);
		else if (el.kind === 'stone') stones.push(laid);
		else if (el.kind === 'flower') flowers.push(laid);
		else creatures.push(laid);
	}

	// water elements are aquatic decorations ALONG the single river (lilypads/frogs float
	// on it, cattails cluster at the bank, one beaver dam crosses it) - never separate ponds
	water.forEach((w, i) => {
		w.variant = aquaticVariantForSeed(w.seed, i, water.length, garden.level);
		// size scales with the RIVER (not the element's own growth) so aquatic decor always
		// fits within the river band and never outgrows it
		w.size = riverHalf * (0.55 + 0.4 * clamp01(w.growth));
		if (w.variant === 'cattail') {
			w.x = 16 + seedFloat(w.seed, 'ax') * (width - 32);
			const side = hashSeed(w.seed, 'bank') % 2 === 0 ? -1 : 1;
			w.y = riverY + side * riverHalf * 0.9;
		} else if (w.variant === 'beaver_dam') {
			w.x = width * (0.3 + seedFloat(w.seed, 'dam') * 0.4);
			w.y = riverY;
			w.size = riverHalf * 1.5;
		} else {
			w.x = 16 + seedFloat(w.seed, 'ax') * (width - 32);
			w.y = riverY + (seedFloat(w.seed, 'ay') - 0.5) * riverHalf * 0.9;
		}
	});

	// trees + stones spread out so they never pile up (extra gap around trees) + dodge the river
	const occupied: XZone[] = [];
	for (const t of [...trees, ...stones]) {
		const halfW = halfWidthOf(t.kind, t.size) * (t.kind === 'tree' ? 1.5 : 1.1);
		t.x = placeX(t.seed, width, halfW, occupied);
		t.y = dodgeRiver(t.y);
		occupied.push({ x0: t.x - halfW, x1: t.x + halfW });
		if (t.kind === 'tree') treeXs.push(t.x);
	}

	// mushrooms tuck up against the nearest tree (shade); other flowers scatter off the trees
	for (const f of flowers) {
		const halfW = halfWidthOf('flower', f.size);
		if (f.variant === 'mushroom' && treeXs.length) {
			const anchor = treeXs[hashSeed(f.seed, 'nearest') % treeXs.length]!;
			const off = (seedFloat(f.seed, 'moff') - 0.5) * 44;
			f.x = Math.max(halfW, Math.min(width - halfW, anchor + off));
		} else {
			if (f.variant === 'mushroom') f.variant = 'grass'; // no tree to shade under
			f.x = placeX(f.seed, width, halfW, occupied);
		}
		f.y = dodgeRiver(f.y);
	}

	// creatures hover just above the grass, never up in the empty sky above the hill
	for (const c of creatures) {
		c.x = 6 + seedFloat(c.seed, 'x') * (width - 12);
		c.y = Math.max(ground - 44, c.y - 4 - seedFloat(c.seed, 'fly') * 34);
	}

	const elements = [...stars, ...farBand, ...water, ...trees, ...stones, ...flowers, ...creatures];
	// painter's order: sky first, far hill next, then ground back-to-front
	const rank = (e: LaidElement): number => (e.kind === 'star' ? 0 : e.far ? 1 : 2);
	elements.sort((a, b) => rank(a) - rank(b) || a.depth - b.depth || a.y - b.y);

	return {
		width,
		height,
		ground,
		level: garden.level,
		animated: garden.animated,
		river,
		riverY,
		elements
	};
}

// #region kudos (giver-benefit, fixed set, never a tally)

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

// #endregion

export const EXPEDITION_GOALS: ExpeditionGoal[] = ['nature_minutes', 'trails', 'quests'];

export const EXPEDITION_GOAL_META: Record<
	ExpeditionGoal,
	{ label: string; unit: string; icon: string }
> = {
	nature_minutes: { label: 'Nature Minutes', unit: 'min', icon: 'mdi:timer-sand' },
	trails: { label: 'Trails Completed', unit: 'trails', icon: 'mdi:map-marker-path' },
	quests: { label: 'Quests Completed', unit: 'quests', icon: 'mdi:flag-checkered' }
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
