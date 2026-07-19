import type { Trail, TrailJournalEntry, TrailPracticeMeta, TrailRarity } from 'types/trails';
import { TRAIL_MOODS, TRAIL_PRACTICES } from 'types/trails';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QUEST_RARITIES } from '~/shared/utils/marketing';
import {
	clearTrailPracticeMetaCache,
	journalTotalMinutes,
	registerTrailPracticeMeta,
	sortJournalByRecent,
	sortTrailsByRarity,
	TRAIL_MOOD_META,
	TRAIL_PRACTICE_META,
	TRAIL_RARITY_ORDER,
	trailMoodMeta,
	trailPracticeMeta,
	trailRarityRank,
	trailTargetMinutes
} from '~/shared/utils/trails';

// a standalone trail: one qualitative practice + a curiosity gap + an awe reveal (no steps/reward)
function trail(id: string, rarity: TrailRarity, title: string, extra: Partial<Trail> = {}): Trail {
	return {
		id,
		title,
		theme: 'nature',
		practice: 'sit_spot',
		description: '',
		icon: 'mdi:leaf',
		rarity,
		curiosity: 'What is older than it looks?',
		duration: 12,
		reflectionPrompt: 'What did you notice out there?',
		reveal: 'A small wonder.',
		...extra
	};
}

function entry(trailId: string, presenceMinutes: number, completedAt: string): TrailJournalEntry {
	return {
		trailId,
		title: `Trail ${trailId}`,
		practice: 'sit_spot',
		presenceMinutes,
		reflection: { at: completedAt },
		completedAt
	};
}

// #region rarity ordering (kept from the pre-rewrite feature)

describe('TRAIL_RARITY_ORDER', () => {
	it('matches the quest/badge rarity order exactly (no drift)', () => {
		expect(TRAIL_RARITY_ORDER).toEqual(['normal', 'rare', 'amazing', 'green']);
		expect(TRAIL_RARITY_ORDER).toEqual(QUEST_RARITIES);
	});
});

describe('trailRarityRank', () => {
	it('ranks known rarities by their canonical position', () => {
		expect(trailRarityRank('normal')).toBe(0);
		expect(trailRarityRank('rare')).toBe(1);
		expect(trailRarityRank('amazing')).toBe(2);
		expect(trailRarityRank('green')).toBe(3);
	});

	it('ranks unknown/missing rarities after the known set', () => {
		expect(trailRarityRank('mythic')).toBe(TRAIL_RARITY_ORDER.length);
		expect(trailRarityRank(undefined)).toBe(TRAIL_RARITY_ORDER.length);
		expect(trailRarityRank(null)).toBe(TRAIL_RARITY_ORDER.length);
	});
});

describe('sortTrailsByRarity', () => {
	it('sorts by rarity (normal -> green) then alphabetically by title', () => {
		const input = [
			trail('1', 'green', 'Zephyr'),
			trail('2', 'normal', 'Banyan'),
			trail('3', 'amazing', 'Cliffside'),
			trail('4', 'normal', 'Acorn'),
			trail('5', 'rare', 'Meadow')
		];
		expect(sortTrailsByRarity(input).map((t) => t.title)).toEqual([
			'Acorn', // normal
			'Banyan', // normal
			'Meadow', // rare
			'Cliffside', // amazing
			'Zephyr' // green
		]);
	});

	it('is a stable rarity-then-title order regardless of input order', () => {
		const a = [trail('1', 'rare', 'Willow'), trail('2', 'rare', 'Alder')];
		const b = [trail('2', 'rare', 'Alder'), trail('1', 'rare', 'Willow')];
		expect(sortTrailsByRarity(a).map((t) => t.id)).toEqual(sortTrailsByRarity(b).map((t) => t.id));
		expect(sortTrailsByRarity(a).map((t) => t.title)).toEqual(['Alder', 'Willow']);
	});

	it('does not mutate the source array', () => {
		const input = [trail('1', 'green', 'B'), trail('2', 'normal', 'A')];
		const copy = [...input];
		sortTrailsByRarity(input);
		expect(input).toEqual(copy);
	});

	it('handles an empty list', () => {
		expect(sortTrailsByRarity([])).toEqual([]);
	});
});

// #region practice metadata

describe('trailPracticeMeta', () => {
	it('returns the matching metadata for a known practice', () => {
		expect(trailPracticeMeta('photo_series').label).toBe('Photo Series');
		expect(trailPracticeMeta('wander').label).toBe('Slow Wander');
		expect(trailPracticeMeta('sit_spot')).toBe(TRAIL_PRACTICE_META.sit_spot);
	});

	it('falls back to sit_spot on garbage / missing input', () => {
		expect(trailPracticeMeta('nonsense' as never)).toBe(TRAIL_PRACTICE_META.sit_spot);
		expect(trailPracticeMeta(undefined)).toBe(TRAIL_PRACTICE_META.sit_spot);
		expect(trailPracticeMeta(null)).toBe(TRAIL_PRACTICE_META.sit_spot);
	});

	it('gives every practice a Title Case label, an mdi icon, and positive default minutes', () => {
		for (const p of TRAIL_PRACTICES) {
			const m = trailPracticeMeta(p);
			expect(m.label[0]).toBe(m.label[0]?.toUpperCase());
			expect(m.icon).toMatch(/^mdi:/);
			expect(m.defaultMinutes).toBeGreaterThan(0);
			expect(m.verb.length).toBeGreaterThan(0);
		}
	});
});

describe('trailTargetMinutes', () => {
	it('uses the trail duration when it is a positive number (rounded)', () => {
		expect(trailTargetMinutes({ duration: 20, practice: 'sit_spot' })).toBe(20);
		expect(trailTargetMinutes({ duration: 15.6, practice: 'sit_spot' })).toBe(16);
	});

	it('falls back to the practice default for a missing / non-positive duration', () => {
		expect(trailTargetMinutes({ duration: 0, practice: 'wander' })).toBe(
			TRAIL_PRACTICE_META.wander.defaultMinutes
		);
		expect(trailTargetMinutes({ duration: -3, practice: 'sound_map' })).toBe(
			TRAIL_PRACTICE_META.sound_map.defaultMinutes
		);
		expect(trailTargetMinutes({ duration: Number.NaN, practice: 'sky_watch' })).toBe(
			TRAIL_PRACTICE_META.sky_watch.defaultMinutes
		);
	});

	it('falls back to sit_spot minutes for an unknown practice with no duration', () => {
		expect(trailTargetMinutes({ duration: 0, practice: 'bogus' as never })).toBe(
			TRAIL_PRACTICE_META.sit_spot.defaultMinutes
		);
	});
});

// #region cloud-authored practiceMeta cache

describe('registerTrailPracticeMeta + cache', () => {
	// the cache is module-level; isolate every case so the fallback tests above stay clean
	beforeEach(() => clearTrailPracticeMetaCache());
	afterEach(() => clearTrailPracticeMetaCache());

	// a cloud-authored meta that deliberately differs from the static fallback for sit_spot
	const cloudSitSpot: TrailPracticeMeta = {
		practice: 'sit_spot',
		label: 'Cloud Sit Spot',
		icon: 'mdi:cloud',
		verb: 'settle',
		cue: 'Cloud-authored cue.',
		defaultMinutes: 21,
		photos: false
	};

	it('populates the cache from a trail with an embedded practiceMeta', () => {
		expect(trailPracticeMeta('sit_spot')).toBe(TRAIL_PRACTICE_META.sit_spot);
		registerTrailPracticeMeta({ practice: 'sit_spot', practiceMeta: cloudSitSpot });
		expect(trailPracticeMeta('sit_spot')).toBe(cloudSitSpot);
		expect(trailPracticeMeta('sit_spot').label).toBe('Cloud Sit Spot');
	});

	it('prefers the cached meta over the static fallback map', () => {
		registerTrailPracticeMeta({ practice: 'sit_spot', practiceMeta: cloudSitSpot });
		const resolved = trailPracticeMeta('sit_spot');
		expect(resolved).not.toBe(TRAIL_PRACTICE_META.sit_spot);
		expect(resolved.cue).toBe('Cloud-authored cue.');
	});

	it('leaves other practices on the fallback until they too are registered', () => {
		registerTrailPracticeMeta({ practice: 'sit_spot', practiceMeta: cloudSitSpot });
		// only sit_spot was registered; wander still resolves from the fallback map
		expect(trailPracticeMeta('wander')).toBe(TRAIL_PRACTICE_META.wander);
	});

	it('an unknown practice still falls back to sit_spot even with a filled cache', () => {
		registerTrailPracticeMeta({ practice: 'sit_spot', practiceMeta: cloudSitSpot });
		expect(trailPracticeMeta('bogus' as never)).toBe(TRAIL_PRACTICE_META.sit_spot);
		expect(trailPracticeMeta(undefined)).toBe(TRAIL_PRACTICE_META.sit_spot);
	});

	it('is a no-op for a trail with no embedded practiceMeta or a nullish trail', () => {
		registerTrailPracticeMeta({ practice: 'sit_spot' } as Pick<Trail, 'practice' | 'practiceMeta'>);
		registerTrailPracticeMeta(null);
		registerTrailPracticeMeta(undefined);
		expect(trailPracticeMeta('sit_spot')).toBe(TRAIL_PRACTICE_META.sit_spot);
	});

	it('trailTargetMinutes prefers the resolved (cached) meta default when duration is missing', () => {
		registerTrailPracticeMeta({ practice: 'sit_spot', practiceMeta: cloudSitSpot });
		expect(trailTargetMinutes({ duration: 0, practice: 'sit_spot' })).toBe(21);
	});

	it('clearTrailPracticeMetaCache restores the fallback resolution', () => {
		registerTrailPracticeMeta({ practice: 'sit_spot', practiceMeta: cloudSitSpot });
		expect(trailPracticeMeta('sit_spot')).toBe(cloudSitSpot);
		clearTrailPracticeMetaCache();
		expect(trailPracticeMeta('sit_spot')).toBe(TRAIL_PRACTICE_META.sit_spot);
	});
});

// #region mood metadata

describe('trailMoodMeta', () => {
	it('resolves a known mood to its metadata', () => {
		expect(trailMoodMeta('calm')).toEqual(TRAIL_MOOD_META.calm);
		expect(trailMoodMeta('awed')?.label).toBe('Awed');
	});

	it('returns null for an unknown / missing mood', () => {
		expect(trailMoodMeta('bogus' as never)).toBeNull();
		expect(trailMoodMeta(undefined)).toBeNull();
		expect(trailMoodMeta(null)).toBeNull();
	});

	it('gives every mood a Title Case label and an mdi icon', () => {
		for (const m of TRAIL_MOODS) {
			const meta = trailMoodMeta(m)!;
			expect(meta.label[0]).toBe(meta.label[0]?.toUpperCase());
			expect(meta.icon).toMatch(/^mdi:/);
		}
	});
});

// #region journal helpers

describe('journalTotalMinutes', () => {
	it('sums presence minutes across entries', () => {
		expect(journalTotalMinutes([entry('a', 12, 'x'), entry('b', 8, 'y')])).toBe(20);
	});

	it('floors negatives at zero and ignores non-numeric minutes', () => {
		expect(
			journalTotalMinutes([
				entry('a', -5, 'x'),
				entry('b', 10, 'y'),
				{ presenceMinutes: 'lots' } as unknown as TrailJournalEntry
			])
		).toBe(10);
	});

	it('is zero for empty / nullish input', () => {
		expect(journalTotalMinutes([])).toBe(0);
		expect(journalTotalMinutes(undefined as unknown as TrailJournalEntry[])).toBe(0);
	});
});

describe('sortJournalByRecent', () => {
	it('orders entries most-recent first', () => {
		const list = [
			entry('a', 10, '2026-07-10T00:00:00Z'),
			entry('b', 10, '2026-07-18T00:00:00Z'),
			entry('c', 10, '2026-07-14T00:00:00Z')
		];
		expect(sortJournalByRecent(list).map((e) => e.trailId)).toEqual(['b', 'c', 'a']);
	});

	it('does not mutate the source array', () => {
		const list = [entry('a', 10, '2026-07-10T00:00:00Z'), entry('b', 10, '2026-07-18T00:00:00Z')];
		const copy = [...list];
		sortJournalByRecent(list);
		expect(list).toEqual(copy);
	});

	it('handles empty / nullish input', () => {
		expect(sortJournalByRecent([])).toEqual([]);
		expect(sortJournalByRecent(undefined as unknown as TrailJournalEntry[])).toEqual([]);
	});
});
