import type { CircleGarden, Expedition, GardenElementKind } from 'types/circles';
import { describe, expect, it } from 'vitest';
import {
	clamp01,
	contributorColor,
	contributorShare,
	deriveMockGarden,
	emptyGardenScene,
	EXPEDITION_GOAL_META,
	EXPEDITION_GOAL_OPTIONS,
	EXPEDITION_GOALS,
	expeditionPercent,
	expeditionRemaining,
	expeditionTimeLeft,
	GARDEN_ELEMENT_KINDS,
	GARDEN_ELEMENT_META,
	GARDEN_PRESETS,
	gardenToSceneState,
	hashSeed,
	KUDOS_GIVER_NOTE,
	KUDOS_PHRASES,
	kudosPhraseMeta,
	layoutGarden,
	MAX_GARDEN_ELEMENTS,
	mulberry32,
	orderedContributors,
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
	});
});
