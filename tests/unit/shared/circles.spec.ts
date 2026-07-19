import type { CircleGarden, Expedition, GardenElementKind } from 'types/circles';
import { describe, expect, it } from 'vitest';
import {
	aquaticVariantForSeed,
	backHillTopY,
	blobPoints,
	clamp01,
	contributorColor,
	contributorShare,
	creatureVariantForSeed,
	deriveMockGarden,
	emptyGardenScene,
	EXPEDITION_GOAL_META,
	EXPEDITION_GOAL_OPTIONS,
	EXPEDITION_GOALS,
	expeditionPercent,
	expeditionRemaining,
	expeditionTimeLeft,
	flowerVariantForSeed,
	GARDEN_ELEMENT_KINDS,
	GARDEN_ELEMENT_META,
	GARDEN_PRESETS,
	GARDEN_SEASONS,
	GARDEN_TIMES_OF_DAY,
	gardenToSceneState,
	hashSeed,
	hexToRgb,
	isNightTime,
	KUDOS_GIVER_NOTE,
	KUDOS_PHRASES,
	kudosPhraseMeta,
	layoutGarden,
	MAX_GARDEN_CREATURES,
	MAX_GARDEN_ELEMENTS,
	MAX_GARDEN_INTERACTION_EFFECTS,
	mixHex,
	moonIlluminatedFraction,
	moonPhaseForDate,
	moonPhaseName,
	mulberry32,
	nightFactorForTime,
	normalizeMoonPhase,
	orderedContributors,
	planAmbientCreatures,
	resolveGardenRender,
	RIVER_LEVEL_THRESHOLD,
	rockDetail,
	sceneRenderConfig,
	seasonForDate,
	shadeHex,
	timeOfDayForDate,
	treeFoliageForSeason,
	treeVariantForSeed,
	trunkHeightForSeed,
	weightedPick
} from '~/shared/utils/circles';

const zeroMix = (): Record<GardenElementKind, number> => ({
	tree: 0,
	flower: 0,
	water: 0,
	stone: 0,
	creature: 0,
	star: 0
});

function expedition(partial: Partial<Expedition> = {}): Expedition {
	return {
		id: 'exp1',
		owner_uid: 'owner',
		title: 'Test',
		goal: 'nature_minutes',
		target: 100,
		progress: 40,
		contributors: [],
		status: 'active',
		starts_at: new Date().toISOString(),
		ends_at: new Date(Date.now() + 86_400_000).toISOString(),
		...partial
	};
}

describe('mulberry32', () => {
	it('produces the same stream for the same seed', () => {
		const a = mulberry32(123);
		const b = mulberry32(123);
		expect([a(), a(), a()]).toEqual([b(), b(), b()]);
	});

	it('produces different streams for different seeds', () => {
		const a = mulberry32(1);
		const b = mulberry32(2);
		expect(a()).not.toBe(b());
	});

	it('stays within [0, 1)', () => {
		const rng = mulberry32(999);
		for (let i = 0; i < 50; i++) {
			const v = rng();
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});
});

describe('hashSeed', () => {
	it('is stable for the same inputs', () => {
		expect(hashSeed('a', 1, 'x')).toBe(hashSeed('a', 1, 'x'));
	});

	it('differs for different inputs', () => {
		expect(hashSeed('a', 1)).not.toBe(hashSeed('a', 2));
	});

	it('is always a non-negative integer', () => {
		const h = hashSeed('anything', 42, 'seed');
		expect(h).toBeGreaterThanOrEqual(0);
		expect(Number.isInteger(h)).toBe(true);
	});
});

describe('clamp01', () => {
	it('clamps below 0 and above 1', () => {
		expect(clamp01(-5)).toBe(0);
		expect(clamp01(5)).toBe(1);
	});

	it('passes through values in range', () => {
		expect(clamp01(0.5)).toBe(0.5);
	});

	it('maps NaN to 0', () => {
		expect(clamp01(Number.NaN)).toBe(0);
	});
});

describe('weightedPick', () => {
	it('falls back to flower when every weight is zero', () => {
		expect(weightedPick(mulberry32(1), zeroMix())).toBe('flower');
	});

	it('only ever returns the single non-zero kind', () => {
		const mix = { ...zeroMix(), water: 5 };
		const rng = mulberry32(7);
		for (let i = 0; i < 20; i++) expect(weightedPick(rng, mix)).toBe('water');
	});

	it('is deterministic for the same rng stream', () => {
		const mix = { ...zeroMix(), tree: 3, flower: 4, star: 2 };
		const seqA = Array.from({ length: 10 }, () => weightedPick(mulberry32(5), mix));
		const seqB = Array.from({ length: 10 }, () => weightedPick(mulberry32(5), mix));
		expect(seqA).toEqual(seqB);
	});
});

describe('deriveMockGarden', () => {
	it('clamps the level into 1..12', () => {
		expect(deriveMockGarden({ ...emptyGardenScene(), level: 99 }).level).toBe(12);
		expect(deriveMockGarden({ ...emptyGardenScene(), level: -3 }).level).toBe(1);
	});

	it('clamps the element count into 0..MAX_GARDEN_ELEMENTS', () => {
		expect(deriveMockGarden({ ...emptyGardenScene(), elementCount: 999 }).elements.length).toBe(
			MAX_GARDEN_ELEMENTS
		);
		expect(deriveMockGarden({ ...emptyGardenScene(), elementCount: -1 }).elements.length).toBe(0);
	});

	it('carries the animated perk flag through', () => {
		expect(deriveMockGarden({ ...emptyGardenScene(), animated: false }).animated).toBe(false);
	});

	it('never emits negative total minutes', () => {
		expect(deriveMockGarden({ ...emptyGardenScene(), totalMinutes: -50 }).total_minutes).toBe(0);
	});

	it('is deterministic for the same scene state', () => {
		const state = { ...emptyGardenScene(), seed: 4242 };
		const a = deriveMockGarden(state);
		const b = deriveMockGarden(state);
		expect(a.elements.map((e) => `${e.kind}:${e.seed}`)).toEqual(
			b.elements.map((e) => `${e.kind}:${e.seed}`)
		);
	});

	it('gives every element a bounded growth', () => {
		for (const el of deriveMockGarden({ ...emptyGardenScene(), elementCount: 30 }).elements) {
			expect(el.growth).toBeGreaterThanOrEqual(0);
			expect(el.growth).toBeLessThanOrEqual(1);
		}
	});
});

describe('gardenToSceneState', () => {
	it('round-trips the element count and mix totals', () => {
		const garden = deriveMockGarden({ ...emptyGardenScene(), elementCount: 24, seed: 11 });
		const back = gardenToSceneState(garden, 'Reloaded');
		const mixTotal = GARDEN_ELEMENT_KINDS.reduce((s, k) => s + back.mix[k], 0);
		expect(back.title).toBe('Reloaded');
		expect(back.elementCount).toBe(garden.elements.length);
		expect(mixTotal).toBe(garden.elements.length);
		expect(back.animated).toBe(garden.animated);
	});

	it('defaults a seed for an empty garden', () => {
		const garden: CircleGarden = {
			owner_uid: 'o',
			level: 1,
			total_minutes: 0,
			elements: [],
			animated: true,
			updated_at: new Date().toISOString()
		};
		expect(gardenToSceneState(garden).seed).toBe(1);
	});
});

describe('layoutGarden', () => {
	it('caps the laid elements at MAX_GARDEN_ELEMENTS', () => {
		const garden = deriveMockGarden({ ...emptyGardenScene(), elementCount: MAX_GARDEN_ELEMENTS });
		// force an over-cap element array to prove the slice guard
		garden.elements.push(...garden.elements.slice(0, 10));
		const laid = layoutGarden(garden, 400, 300);
		expect(laid.elements.length).toBeLessThanOrEqual(MAX_GARDEN_ELEMENTS);
	});

	it('places stars in the sky band above the ground', () => {
		const garden = deriveMockGarden({
			...emptyGardenScene(),
			elementCount: 20,
			mix: { ...zeroMix(), star: 10 }
		});
		const laid = layoutGarden(garden, 400, 300);
		const stars = laid.elements.filter((e) => e.kind === 'star');
		expect(stars.length).toBeGreaterThan(0);
		for (const s of stars) expect(s.y).toBeLessThan(laid.ground);
	});

	it('is deterministic for the same garden and size', () => {
		const garden = deriveMockGarden({ ...emptyGardenScene(), elementCount: 18, seed: 55 });
		const a = layoutGarden(garden, 500, 320);
		const b = layoutGarden(garden, 500, 320);
		expect(a.elements.map((e) => [e.x, e.y, e.size])).toEqual(
			b.elements.map((e) => [e.x, e.y, e.size])
		);
	});

	it('sorts stars to the back of the paint order', () => {
		const garden = deriveMockGarden({
			...emptyGardenScene(),
			elementCount: 16,
			mix: { tree: 4, flower: 3, water: 1, stone: 1, creature: 1, star: 6 }
		});
		const laid = layoutGarden(garden, 400, 300);
		const firstNonStar = laid.elements.findIndex((e) => e.kind !== 'star');
		const lastStar = laid.elements.map((e) => e.kind).lastIndexOf('star');
		if (firstNonStar !== -1 && lastStar !== -1) expect(lastStar).toBeLessThan(firstNonStar);
	});
});

describe('kudos metadata', () => {
	it('exposes exactly the six fixed phrases', () => {
		expect(KUDOS_PHRASES).toHaveLength(6);
		expect(KUDOS_PHRASES.map((p) => p.phrase)).toEqual([
			'nice_find',
			'go_you',
			'keep_going',
			'inspiring',
			'welcome_back',
			'trailblazer'
		]);
	});

	it('keeps every label in Title Case with an icon', () => {
		for (const p of KUDOS_PHRASES) {
			expect(p.label[0]).toBe(p.label[0]?.toUpperCase());
			expect(p.icon).toMatch(/^mdi:/);
		}
	});

	it('frames the giver benefit, not a tally', () => {
		expect(KUDOS_GIVER_NOTE.toLowerCase()).toContain('you');
	});

	it('resolves a phrase and falls back to the first for an unknown one', () => {
		expect(kudosPhraseMeta('inspiring').label).toBe('Inspiring');
		expect(kudosPhraseMeta('bogus' as never)).toBe(KUDOS_PHRASES[0]);
	});
});

describe('expedition helpers', () => {
	it('maps every goal to metadata and exposes matching options', () => {
		expect(EXPEDITION_GOALS).toHaveLength(3);
		expect(EXPEDITION_GOAL_OPTIONS).toHaveLength(3);
		for (const g of EXPEDITION_GOALS) {
			expect(EXPEDITION_GOAL_META[g].label.length).toBeGreaterThan(0);
			expect(EXPEDITION_GOAL_OPTIONS.find((o) => o.value === g)?.label).toBe(
				EXPEDITION_GOAL_META[g].label
			);
		}
	});

	it('uses the standalone trails goal set (no legacy trail_steps)', () => {
		expect(EXPEDITION_GOALS).toEqual(['nature_minutes', 'trails', 'quests']);
		expect(EXPEDITION_GOAL_META.trails.label).toBe('Trails Completed');
		expect(EXPEDITION_GOAL_META.trails.unit).toBe('trails');
		expect((EXPEDITION_GOAL_META as Record<string, unknown>).trail_steps).toBeUndefined();
	});

	it('computes a clamped percent', () => {
		expect(expeditionPercent(expedition({ progress: 40, target: 100 }))).toBeCloseTo(0.4);
		expect(expeditionPercent(expedition({ progress: 200, target: 100 }))).toBe(1);
		expect(expeditionPercent(expedition({ target: 0 }))).toBe(0);
	});

	it('computes non-negative remaining', () => {
		expect(expeditionRemaining(expedition({ progress: 40, target: 100 }))).toBe(60);
		expect(expeditionRemaining(expedition({ progress: 150, target: 100 }))).toBe(0);
	});

	it('computes a contributor share of the combined total', () => {
		const exp = expedition({
			contributors: [
				{ uid: 'a', username: 'A', contribution: 30 },
				{ uid: 'b', username: 'B', contribution: 10 }
			]
		});
		expect(contributorShare(exp, 'a')).toBeCloseTo(0.75);
		expect(contributorShare(exp, 'missing')).toBe(0);
	});

	it('orders contributors by contribution without mutating the source', () => {
		const contributors = [
			{ uid: 'a', username: 'A', contribution: 5 },
			{ uid: 'b', username: 'B', contribution: 20 }
		];
		const exp = expedition({ contributors });
		const ordered = orderedContributors(exp);
		expect(ordered.map((c) => c.uid)).toEqual(['b', 'a']);
		expect(contributors[0]!.uid).toBe('a');
	});

	it('reports time left and expiry', () => {
		const soon = expeditionTimeLeft(
			{ ends_at: new Date(Date.now() + 90_000_000).toISOString() },
			Date.now()
		);
		expect(soon.expired).toBe(false);
		expect(soon.days).toBe(1);

		const past = expeditionTimeLeft({ ends_at: new Date(Date.now() - 1000).toISOString() });
		expect(past.expired).toBe(true);

		const bad = expeditionTimeLeft({ ends_at: 'not-a-date' });
		expect(bad).toEqual({ expired: false, days: 0, hours: 0 });
	});

	it('gives a stable contributor color inside the palette', () => {
		const c1 = contributorColor('abc');
		const c2 = contributorColor('abc');
		expect(c1).toBe(c2);
		expect(c1).toMatch(/^#[0-9a-f]{6}$/i);
	});
});

describe('garden metadata + presets', () => {
	it('defines metadata for every element kind', () => {
		for (const kind of GARDEN_ELEMENT_KINDS) {
			expect(GARDEN_ELEMENT_META[kind].palette.length).toBeGreaterThan(0);
			expect(GARDEN_ELEMENT_META[kind].label.length).toBeGreaterThan(0);
		}
	});

	it('ships well-formed marketing presets', () => {
		expect(GARDEN_PRESETS.length).toBeGreaterThan(0);
		for (const p of GARDEN_PRESETS) {
			expect(p.name.length).toBeGreaterThan(0);
			expect(p.state.elementCount).toBeLessThanOrEqual(MAX_GARDEN_ELEMENTS);
		}
	});

	it('gives a sensible default scene', () => {
		const scene = emptyGardenScene();
		expect(scene.level).toBeGreaterThanOrEqual(1);
		expect(scene.elementCount).toBeLessThanOrEqual(MAX_GARDEN_ELEMENTS);
		// the light overrides default to auto so real gardens derive from the date
		expect(scene.season).toBe('auto');
		expect(scene.timeOfDay).toBe('auto');
		expect(scene.moonPhase).toBeNull();
	});
});

describe('hex color helpers', () => {
	it('reads full, shorthand, and garbage hex', () => {
		expect(hexToRgb('#38a169')).toEqual([56, 161, 105]);
		expect(hexToRgb('#abc')).toEqual([170, 187, 204]);
		expect(hexToRgb('nope')).toEqual([0, 0, 0]);
	});

	it('blends two colors and clamps t', () => {
		expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
		expect(mixHex('#000000', '#ffffff', 2)).toBe('#ffffff');
		expect(mixHex('#000000', '#ffffff', -1)).toBe('#000000');
	});

	it('lightens and darkens with channel clamping', () => {
		expect(shadeHex('#808080', 16)).toBe('#909090');
		expect(shadeHex('#000000', -50)).toBe('#000000');
		expect(shadeHex('#ffffff', 50)).toBe('#ffffff');
	});
});

describe('season + time of day derivation', () => {
	it('maps the month to a northern-hemisphere season', () => {
		expect(seasonForDate(new Date(2026, 0, 15))).toBe('winter');
		expect(seasonForDate(new Date(2026, 3, 15))).toBe('spring');
		expect(seasonForDate(new Date(2026, 6, 15))).toBe('summer');
		expect(seasonForDate(new Date(2026, 9, 15))).toBe('autumn');
		expect(seasonForDate(new Date(2026, 11, 15))).toBe('winter');
	});

	it('flips the season below the equator', () => {
		expect(seasonForDate(new Date(2026, 0, 15), -33)).toBe('summer');
		expect(seasonForDate(new Date(2026, 6, 15), -33)).toBe('winter');
	});

	it('maps the hour to a time of day', () => {
		expect(timeOfDayForDate(new Date(2026, 6, 15, 2))).toBe('night');
		expect(timeOfDayForDate(new Date(2026, 6, 15, 6))).toBe('dawn');
		expect(timeOfDayForDate(new Date(2026, 6, 15, 12))).toBe('day');
		expect(timeOfDayForDate(new Date(2026, 6, 15, 18))).toBe('dusk');
		expect(timeOfDayForDate(new Date(2026, 6, 15, 22))).toBe('night');
	});

	it('reports night and a monotone darkness factor', () => {
		expect(isNightTime('night')).toBe(true);
		expect(isNightTime('day')).toBe(false);
		expect(nightFactorForTime('day')).toBe(0);
		expect(nightFactorForTime('night')).toBe(1);
		expect(nightFactorForTime('dawn')).toBeLessThan(nightFactorForTime('dusk'));
	});
});

describe('moon phase calculator', () => {
	const epoch = new Date(Date.UTC(2000, 0, 6, 18, 14));

	it('is 0 at the reference new moon and stays in [0,1)', () => {
		expect(moonPhaseForDate(epoch)).toBe(0);
		for (let d = 0; d < 40; d++) {
			const p = moonPhaseForDate(new Date(epoch.getTime() + d * 86_400_000));
			expect(p).toBeGreaterThanOrEqual(0);
			expect(p).toBeLessThan(1);
		}
	});

	it('reaches full a half synodic month later', () => {
		const full = moonPhaseForDate(new Date(epoch.getTime() + 14.765 * 86_400_000));
		expect(full).toBeCloseTo(0.5, 1);
	});

	it('normalizes any phase into [0,1)', () => {
		expect(normalizeMoonPhase(1.25)).toBeCloseTo(0.25);
		expect(normalizeMoonPhase(-0.25)).toBeCloseTo(0.75);
		expect(normalizeMoonPhase(Number.NaN)).toBe(0);
	});

	it('names the eight principal phases', () => {
		expect(moonPhaseName(0)).toBe('New Moon');
		expect(moonPhaseName(0.25)).toBe('First Quarter');
		expect(moonPhaseName(0.5)).toBe('Full Moon');
		expect(moonPhaseName(0.75)).toBe('Last Quarter');
		expect(moonPhaseName(1)).toBe('New Moon');
	});

	it('computes the illuminated fraction', () => {
		expect(moonIlluminatedFraction(0)).toBeCloseTo(0);
		expect(moonIlluminatedFraction(0.25)).toBeCloseTo(0.5);
		expect(moonIlluminatedFraction(0.5)).toBeCloseTo(1);
		expect(moonIlluminatedFraction(0.75)).toBeCloseTo(0.5);
	});
});

describe('render config resolution', () => {
	it('lets explicit overrides win over the date', () => {
		const r = resolveGardenRender({ season: 'winter', timeOfDay: 'night', moonPhase: 0.5 });
		expect(r.season).toBe('winter');
		expect(r.timeOfDay).toBe('night');
		expect(r.moonPhase).toBe(0.5);
		expect(r.nightFactor).toBe(1);
	});

	it('derives everything from the date when no override is given', () => {
		const r = resolveGardenRender(null, new Date(2026, 0, 15, 2));
		expect(r.season).toBe('winter');
		expect(r.timeOfDay).toBe('night');
		expect(r.nightFactor).toBe(1);
	});

	it('normalizes an out-of-range moon override', () => {
		expect(resolveGardenRender({ moonPhase: 1.25 }).moonPhase).toBeCloseTo(0.25);
	});

	it('collapses auto studio knobs to undefined and passes explicit ones through', () => {
		expect(sceneRenderConfig(emptyGardenScene())).toEqual({
			season: undefined,
			timeOfDay: undefined,
			moonPhase: undefined
		});
		const explicit = sceneRenderConfig({
			...emptyGardenScene(),
			season: 'winter',
			timeOfDay: 'day',
			moonPhase: 0.3
		});
		expect(explicit.season).toBe('winter');
		expect(explicit.timeOfDay).toBe('day');
		expect(explicit.moonPhase).toBeCloseTo(0.3);
		expect(sceneRenderConfig({ ...emptyGardenScene(), moonPhase: 1.2 }).moonPhase).toBeCloseTo(0.2);
	});
});

describe('element variants', () => {
	it('assigns a stable tree variant and trunk height', () => {
		for (let s = 0; s < 40; s++) {
			expect(['round', 'tall', 'conifer']).toContain(treeVariantForSeed(s));
			expect(treeVariantForSeed(s)).toBe(treeVariantForSeed(s));
			const t = trunkHeightForSeed(s);
			expect(t).toBeGreaterThanOrEqual(0.6);
			expect(t).toBeLessThan(1.4);
		}
	});

	it('assigns a stable flower variant', () => {
		for (let s = 0; s < 40; s++) {
			expect(['bloom', 'grass', 'mushroom']).toContain(flowerVariantForSeed(s));
			expect(flowerVariantForSeed(s)).toBe(flowerVariantForSeed(s));
		}
	});

	it('gates fauna by time of day', () => {
		for (let s = 0; s < 60; s++) {
			const night = creatureVariantForSeed(s, 'night');
			expect(night).not.toBe('dragonfly');
			expect(night).not.toBe('butterfly');
			const day = creatureVariantForSeed(s, 'day');
			expect(day).not.toBe('firefly');
		}
	});

	it('bares the trees in winter and colors them otherwise', () => {
		expect(treeFoliageForSeason('winter', '#38a169', 1)).toBeNull();
		expect(treeFoliageForSeason('summer', '#38a169', 1)).toBe('#38a169');
		expect(treeFoliageForSeason('spring', '#38a169', 1)).toMatch(/^#[0-9a-f]{6}$/i);
		expect(treeFoliageForSeason('autumn', '#38a169', 1)).toMatch(/^#[0-9a-f]{6}$/i);
	});
});

describe('generative geometry: blobPoints', () => {
	it('returns `count` points and defaults to 14', () => {
		expect(blobPoints(1, 10, 10).length).toBe(14);
		expect(blobPoints(1, 10, 10, 20).length).toBe(20);
	});

	it('is deterministic for the same seed', () => {
		expect(blobPoints(42, 30, 20, 12)).toEqual(blobPoints(42, 30, 20, 12));
	});

	it('differs for different seeds', () => {
		expect(blobPoints(1, 30, 20, 12)).not.toEqual(blobPoints(2, 30, 20, 12));
	});

	it('keeps a scaled halo concentric with the base (same per-vertex ratios)', () => {
		const base = blobPoints(7, 20, 20, 12);
		const halo = blobPoints(7, 40, 40, 12); // 2x radii, same seed + count
		for (let i = 0; i < base.length; i++) {
			expect(halo[i]!.x).toBeCloseTo(base[i]!.x * 2, 6);
			expect(halo[i]!.y).toBeCloseTo(base[i]!.y * 2, 6);
		}
	});

	it('bounds every vertex radius within [minR, maxR] of the ellipse', () => {
		const rx = 25;
		const ry = 15;
		const minR = 0.78;
		const maxR = 1.18;
		for (const p of blobPoints(99, rx, ry, 16, minR, maxR)) {
			// normalized ellipse radius collapses cos/sin back out to just the seeded ratio
			const norm = Math.hypot(p.x / rx, p.y / ry);
			expect(norm).toBeGreaterThanOrEqual(minR - 1e-9);
			expect(norm).toBeLessThanOrEqual(maxR + 1e-9);
		}
	});
});

describe('generative geometry: rockDetail', () => {
	it('produces a 12-point outline, 1..2 cracks, and a lit facet', () => {
		for (let s = 0; s < 30; s++) {
			const rock = rockDetail(s, 20);
			expect(rock.outline.length).toBe(12);
			expect(rock.cracks.length).toBeGreaterThanOrEqual(1);
			expect(rock.cracks.length).toBeLessThanOrEqual(2);
			expect(rock.facet).toBeGreaterThanOrEqual(0.4);
			expect(rock.facet).toBeLessThanOrEqual(0.8);
		}
	});

	it('is deterministic for the same seed + size', () => {
		expect(rockDetail(7, 24)).toEqual(rockDetail(7, 24));
	});

	it('varies with the seed', () => {
		expect(rockDetail(1, 24)).not.toEqual(rockDetail(2, 24));
	});
});

describe('garden interaction cap', () => {
	it('caps tap-spawned interaction effects at a positive ceiling', () => {
		expect(MAX_GARDEN_INTERACTION_EFFECTS).toBeGreaterThan(0);
		expect(Number.isInteger(MAX_GARDEN_INTERACTION_EFFECTS)).toBe(true);
	});
});

describe('ambient creatures', () => {
	it('caps the flock and returns nothing for a zero count', () => {
		expect(planAmbientCreatures(1, 'day', 999)).toHaveLength(MAX_GARDEN_CREATURES);
		expect(planAmbientCreatures(1, 'day', 0)).toEqual([]);
	});

	it('gates variants by time of day', () => {
		for (const a of planAmbientCreatures(7, 'day', MAX_GARDEN_CREATURES))
			expect(a.variant).not.toBe('firefly');
		for (const a of planAmbientCreatures(7, 'night', MAX_GARDEN_CREATURES))
			expect(a.variant).not.toBe('dragonfly');
	});

	it('is deterministic for the same seed + time', () => {
		const a = planAmbientCreatures(42, 'night', 8).map((c) => `${c.variant}:${c.x}:${c.dir}`);
		const b = planAmbientCreatures(42, 'night', 8).map((c) => `${c.variant}:${c.x}:${c.dir}`);
		expect(a).toEqual(b);
	});
});

describe('layoutGarden overlap + river + variants', () => {
	const halfWidthOf = (kind: string, size: number): number =>
		kind === 'water' ? size : kind === 'tree' ? size * 0.55 : kind === 'stone' ? size : size * 0.5;

	it('turns water elements into aquatic decorations on the single river', () => {
		const garden = deriveMockGarden({
			...emptyGardenScene(),
			elementCount: 40,
			level: 8,
			seed: 4242,
			mix: { tree: 5, flower: 5, water: 4, stone: 3, creature: 1, star: 1 }
		});
		const laid = layoutGarden(garden, 800, 340);
		expect(laid.river).toBe(true);
		const waters = laid.elements.filter((e) => e.kind === 'water');
		expect(waters.length).toBeGreaterThan(0);
		const span = laid.height - laid.ground;
		const riverHalf = Math.max(8, span * 0.09) * (1 + Math.min(waters.length, 8) * 0.05);
		for (const w of waters) {
			// every water element is an aquatic decoration sitting on/at the river band
			expect(['lilypad', 'cattail', 'frog', 'beaver_dam']).toContain(w.variant);
			expect(Math.abs(w.y - laid.riverY)).toBeLessThanOrEqual(riverHalf * 1.2 + 2);
		}
	});

	it('carves a river past the growth threshold OR whenever there is water', () => {
		const dry = { tree: 5, flower: 5, water: 0, stone: 3, creature: 1, star: 1 };
		const under = layoutGarden(
			deriveMockGarden({ ...emptyGardenScene(), level: RIVER_LEVEL_THRESHOLD - 1, mix: dry }),
			400,
			300
		);
		const underWithWater = layoutGarden(
			deriveMockGarden({
				...emptyGardenScene(),
				level: RIVER_LEVEL_THRESHOLD - 1,
				mix: { ...dry, water: 3 }
			}),
			400,
			300
		);
		const over = layoutGarden(
			deriveMockGarden({ ...emptyGardenScene(), level: RIVER_LEVEL_THRESHOLD, mix: dry }),
			400,
			300
		);
		expect(under.river).toBe(false);
		expect(underWithWater.river).toBe(true);
		expect(over.river).toBe(true);
		expect(over.riverY).toBeGreaterThan(over.ground);
		expect(over.riverY).toBeLessThan(over.height);
	});

	it('tags every laid element with a variant and keeps far ones on the hill', () => {
		const garden = deriveMockGarden({
			...emptyGardenScene(),
			elementCount: 50,
			seed: 99,
			mix: { tree: 8, flower: 6, water: 1, stone: 2, creature: 2, star: 1 }
		});
		const laid = layoutGarden(garden, 500, 320);
		for (const el of laid.elements) {
			if (el.kind === 'tree') {
				expect(['round', 'tall', 'conifer']).toContain(el.variant);
				expect(el.trunk).toBeGreaterThan(0);
			}
			if (el.kind === 'flower') expect(['bloom', 'grass', 'mushroom']).toContain(el.variant);
			// far hill elements sit ON the back-hill surface (which rolls above + below the
			// horizon), never lifted off it
			if (el.far) {
				const surface = backHillTopY(el.x, laid.ground);
				expect(el.y).toBeGreaterThanOrEqual(surface - 1);
				expect(el.y).toBeLessThanOrEqual(surface + el.size * 0.12 + 1);
			}
		}
	});

	it('covers every season + time-of-day constant', () => {
		expect(GARDEN_SEASONS).toHaveLength(4);
		expect(GARDEN_TIMES_OF_DAY).toHaveLength(4);
	});
});

describe('backHillTopY (the drawn back-hill silhouette)', () => {
	it('matches ground - 8 + sin(x*0.012)*18 exactly', () => {
		const ground = 240;
		expect(backHillTopY(0, ground)).toBeCloseTo(ground - 8, 6);
		expect(backHillTopY(100, ground)).toBeCloseTo(ground - 8 + Math.sin(1.2) * 18, 6);
	});

	it('stays within +/- 18 of the ground-8 baseline (never far off the hill)', () => {
		const ground = 300;
		for (let x = 0; x <= 800; x += 37) {
			const y = backHillTopY(x, ground);
			expect(y).toBeGreaterThanOrEqual(ground - 8 - 18 - 1e-6);
			expect(y).toBeLessThanOrEqual(ground - 8 + 18 + 1e-6);
		}
	});
});

describe('aquaticVariantForSeed', () => {
	it('reserves a single beaver dam for the first element of a grown, water-rich river', () => {
		expect(aquaticVariantForSeed(1, 0, 3, 8)).toBe('beaver_dam');
		// not the first element
		expect(aquaticVariantForSeed(1, 1, 3, 8)).not.toBe('beaver_dam');
		// too few water elements
		expect(aquaticVariantForSeed(1, 0, 2, 8)).not.toBe('beaver_dam');
		// garden not grown enough
		expect(aquaticVariantForSeed(1, 0, 3, 7)).not.toBe('beaver_dam');
	});

	it('otherwise picks a lilypad, cattail, or frog deterministically', () => {
		for (let seed = 1; seed <= 50; seed++) {
			const v = aquaticVariantForSeed(seed, 1, 5, 5);
			expect(['lilypad', 'cattail', 'frog']).toContain(v);
			// deterministic per seed
			expect(aquaticVariantForSeed(seed, 1, 5, 5)).toBe(v);
		}
	});
});

// the constraints added after the screenshot feedback: nothing floats above the ground,
// aquatic decor stays inside the river, far elements sit ON the hill surface
describe('layoutGarden placement constraints', () => {
	const build = (over = {}) =>
		layoutGarden(
			deriveMockGarden({
				...emptyGardenScene(),
				elementCount: 70,
				level: 10,
				seed: 20260719,
				mix: { tree: 8, flower: 6, water: 5, stone: 3, creature: 4, star: 2 },
				...over
			}),
			800,
			360
		);

	it('sits far (back-hill) elements exactly on the hill surface, never floating', () => {
		const laid = build();
		const far = laid.elements.filter((e) => e.far);
		expect(far.length).toBeGreaterThan(0);
		for (const el of far) {
			const surface = backHillTopY(el.x, laid.ground);
			// base is on the surface plus a small embed (size*0.12), never lifted off it
			expect(el.y).toBeGreaterThanOrEqual(surface - 1);
			expect(el.y).toBeLessThanOrEqual(surface + el.size * 0.12 + 1);
		}
	});

	it('keeps flying creatures near the grass, never up in the empty sky', () => {
		const laid = build();
		const creatures = laid.elements.filter((e) => e.kind === 'creature');
		expect(creatures.length).toBeGreaterThan(0);
		for (const el of creatures) {
			// at most 44px above the horizon (hovering over the grass), never sky-high
			expect(el.y).toBeGreaterThanOrEqual(laid.ground - 44);
			expect(el.y).toBeLessThanOrEqual(laid.height);
		}
	});

	it('keeps aquatic decor inside the river band and sized to the river', () => {
		const laid = build();
		const span = laid.height - laid.ground;
		const waters = laid.elements.filter((e) => e.kind === 'water');
		const riverHalf = Math.max(8, span * 0.09) * (1 + Math.min(waters.length, 8) * 0.05);
		expect(waters.length).toBeGreaterThan(0);
		for (const w of waters) {
			expect(['lilypad', 'cattail', 'frog', 'beaver_dam']).toContain(w.variant);
			// within the river band vertically (banks at +/- 0.9*riverHalf)
			expect(Math.abs(w.y - laid.riverY)).toBeLessThanOrEqual(riverHalf * 0.9 + 1);
			// sized to the river (a dam spans it; the rest are smaller), never oversized
			expect(w.size).toBeLessThanOrEqual(riverHalf * 1.5 + 1e-6);
		}
	});

	it('bands ambient fauna: birds high, dragonflies mid, fireflies on the grass line', () => {
		const night = planAmbientCreatures(4242, 'night', 12);
		for (const a of night) {
			if (a.variant === 'bird') expect(a.y).toBeLessThanOrEqual(0.34 + 1e-9);
			if (a.variant === 'firefly') expect(a.y).toBeGreaterThanOrEqual(0.74 - 1e-9);
		}
		const day = planAmbientCreatures(99, 'day', 12);
		for (const a of day) {
			if (a.variant === 'dragonfly') {
				expect(a.y).toBeGreaterThanOrEqual(0.52 - 1e-9);
				expect(a.y).toBeLessThanOrEqual(0.72 + 1e-9);
			}
		}
	});
});
