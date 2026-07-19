import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from 'stores/auth';
import { useTrailsStore } from 'stores/trails';
import type {
	NatureMinutes,
	Trail,
	TrailJournalEntry,
	TrailPracticeMeta,
	TrailReflection
} from 'types/trails';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, nextTick } from 'vue';
import {
	clearTrailPracticeMetaCache,
	TRAIL_PRACTICE_META,
	trailPracticeMeta
} from '~/shared/utils/trails';

// only the wire calls are stubbed; valid()/classifyItemFetch stay real
vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return {
		...actual,
		makeAPIRequest: vi.fn(),
		makeClientAPIRequest: vi.fn(),
		invalidateAPICache: vi.fn()
	};
});

import { invalidateAPICache, makeAPIRequest, makeClientAPIRequest } from 'utils';

function trail(id: string, extra: Partial<Trail> = {}): Trail {
	return {
		id,
		title: `Trail ${id}`,
		theme: 'nature',
		practice: 'sit_spot',
		description: 'A quiet sit.',
		icon: 'mdi:leaf',
		rarity: 'normal',
		curiosity: 'What settles when you do?',
		duration: 12,
		reflectionPrompt: 'What did you notice?',
		reveal: 'A small wonder.',
		...extra
	} as Trail;
}

function reflection(extra: Partial<TrailReflection> = {}): TrailReflection {
	return { at: new Date().toISOString(), ...extra };
}

function journalEntry(trailId: string, extra: Partial<TrailJournalEntry> = {}): TrailJournalEntry {
	return {
		trailId,
		title: `Trail ${trailId}`,
		practice: 'sit_spot',
		presenceMinutes: 12,
		reflection: reflection(),
		completedAt: new Date().toISOString(),
		...extra
	};
}

function nature(minutes: number): NatureMinutes {
	return {
		week: '2026-W29',
		minutes,
		target: 120,
		best: minutes,
		sources: [],
		updated_at: new Date().toISOString()
	};
}

const ok = <T>(data: T) => ({ success: true as const, data });

beforeEach(() => {
	setActivePinia(createPinia());
	vi.clearAllMocks();
	useAuthStore().setSessionToken('token');
});

describe('trails store validation guard', () => {
	it('accepts a well-formed trail via setTrails', () => {
		const store = useTrailsStore();
		store.setTrails([trail('t1')]);
		expect(store.has('t1')).toBe(true);
		expect(store.get('t1')?.id).toBe('t1');
	});

	it('rejects trails missing id / practice / curiosity / reveal', () => {
		const store = useTrailsStore();
		store.setTrails([
			{ id: '', title: 'x', practice: 'sit_spot', curiosity: 'c', reveal: 'r' } as unknown as Trail,
			{ id: 'a', title: 't', curiosity: 'c', reveal: 'r' } as unknown as Trail, // no practice
			{ id: 'b', title: 't', practice: 'sit_spot', reveal: 'r' } as unknown as Trail // no curiosity
		]);
		expect(store.cache.size).toBe(0);
	});

	it('does not let setTrails clobber an already-cached trail', () => {
		const store = useTrailsStore();
		store.upsertTrail(trail('t1', { duration: 99 }));
		store.setTrails([trail('t1', { duration: 5 })]);
		expect(store.get('t1')?.duration).toBe(99);
	});

	it('still seeds trails not yet cached', () => {
		const store = useTrailsStore();
		store.upsertTrail(trail('t1'));
		store.setTrails([trail('t1'), trail('t2')]);
		expect(store.has('t2')).toBe(true);
	});
});

describe('trails store fills the cloud practiceMeta cache', () => {
	// module-level cache; isolate so these don't bleed into other suites
	beforeEach(() => clearTrailPracticeMetaCache());
	afterEach(() => clearTrailPracticeMetaCache());

	const cloudMeta: TrailPracticeMeta = {
		practice: 'sit_spot',
		label: 'Cloud Sit Spot',
		icon: 'mdi:cloud',
		verb: 'settle',
		cue: 'Cloud-authored cue.',
		defaultMinutes: 21,
		photos: false
	};

	it('setTrails registers each valid trail practiceMeta from the response', () => {
		const store = useTrailsStore();
		expect(trailPracticeMeta('sit_spot')).toBe(TRAIL_PRACTICE_META.sit_spot);
		store.setTrails([trail('t1', { practiceMeta: cloudMeta } as Partial<Trail>)]);
		expect(trailPracticeMeta('sit_spot')).toBe(cloudMeta);
	});

	it('upsertTrail registers the embedded practiceMeta too', () => {
		const store = useTrailsStore();
		store.upsertTrail(trail('t1', { practiceMeta: cloudMeta } as Partial<Trail>));
		expect(trailPracticeMeta('sit_spot').label).toBe('Cloud Sit Spot');
	});

	it('a trail without an embedded practiceMeta leaves the fallback in place', () => {
		const store = useTrailsStore();
		store.setTrails([trail('t1')]);
		expect(trailPracticeMeta('sit_spot')).toBe(TRAIL_PRACTICE_META.sit_spot);
	});
});

describe('trails store get/has three-state', () => {
	it('get returns undefined for empty/unknown ids', () => {
		const store = useTrailsStore();
		expect(store.get('')).toBeUndefined();
		expect(store.get('nope')).toBeUndefined();
	});

	it('get returns null for a confirmed-not-found id', () => {
		const store = useTrailsStore();
		store.cache.set('gone', null);
		expect(store.get('gone')).toBeNull();
		expect(store.has('gone')).toBe(true);
	});

	it('list drops null entries', () => {
		const store = useTrailsStore();
		store.upsertTrail(trail('t1'));
		store.cache.set('gone', null);
		expect(store.list().map((t) => t.id)).toEqual(['t1']);
	});
});

describe('trails store fetchTrails', () => {
	it('caches a list from a valid mantle2 response', async () => {
		const store = useTrailsStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok([trail('a'), trail('b')]) as any);

		const res = await store.fetchTrails({});
		expect(res.success).toBe(true);
		expect(store.listLoaded).toBe(true);
		expect(
			store
				.list()
				.map((t) => t.id)
				.sort()
		).toEqual(['a', 'b']);
	});

	it('hits the mantle2 trails path and forwards theme/premium query', async () => {
		const store = useTrailsStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok({ items: [trail('a')] }) as any);

		await store.fetchTrails({ theme: 'nature', premium: true });
		expect(store.has('a')).toBe(true);
		const url = vi.mocked(makeAPIRequest).mock.calls[0][1] as string;
		expect(url).toContain('/v2/users/trails');
		expect(url).toContain('theme=nature');
		expect(url).toContain('premium=true');
	});

	it('returns a failure envelope when the request fails', async () => {
		const store = useTrailsStore();
		vi.mocked(makeAPIRequest).mockResolvedValue({ success: false, message: 'boom' } as any);
		const res = await store.fetchTrails({});
		expect(res.success).toBe(false);
	});
});

describe('trails store fetchTrail', () => {
	it('caches a valid single trail from the mantle2 path', async () => {
		const store = useTrailsStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok(trail('t1')) as any);
		const result = await store.fetchTrail('t1', false);
		expect(result?.id).toBe('t1');
		expect(store.get('t1')?.id).toBe('t1');
		const url = vi.mocked(makeAPIRequest).mock.calls[0][1] as string;
		expect(url).toBe('/v2/users/trails/t1');
	});

	it('caches null on an explicit 404 and treats it as not-found', async () => {
		const store = useTrailsStore();
		vi.mocked(makeAPIRequest).mockResolvedValue({ success: false, status: 404 } as any);
		const result = await store.fetchTrail('t1', false);
		expect(result).toBeNull();
		expect(store.has('t1')).toBe(true);
		expect(store.get('t1')).toBeNull();
	});

	it('serves a cached hit without refetching', async () => {
		const store = useTrailsStore();
		store.upsertTrail(trail('t1'));
		const result = await store.fetchTrail('t1', false);
		expect(result?.id).toBe('t1');
		expect(makeAPIRequest).not.toHaveBeenCalled();
	});

	it('force invalidates the shared apiCache and refetches', async () => {
		const store = useTrailsStore();
		store.upsertTrail(trail('t1'));
		vi.mocked(makeAPIRequest).mockResolvedValue(ok(trail('t1', { duration: 42 })) as any);
		await store.fetchTrail('t1', true);
		expect(invalidateAPICache).toHaveBeenCalledWith('trail-t1');
		expect(store.get('t1')?.duration).toBe(42);
	});

	it('dedupes concurrent fetches into one network call', async () => {
		const store = useTrailsStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok(trail('t1')) as any);
		const [a, b] = await Promise.all([
			store.fetchTrail('t1', false),
			store.fetchTrail('t1', false)
		]);
		expect(a?.id).toBe('t1');
		expect(b?.id).toBe('t1');
		expect(makeAPIRequest).toHaveBeenCalledTimes(1);
	});
});

// #region run lifecycle (start -> presence -> reflect, all standalone)

describe('trails store run lifecycle', () => {
	it('startRun records the pledge locally and fires the start POST', async () => {
		const store = useTrailsStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue(ok(undefined) as any);
		const run = await store.startRun(trail('t1'), { when: 'after lunch', where: 'the park' });
		expect(run.trailId).toBe('t1');
		expect(run.pledge?.when).toBe('after lunch');
		expect(run.presenceMinutes).toBe(0);
		expect(run.completed).toBe(false);
		expect(store.getRun('t1')?.pledge?.where).toBe('the park');
		const url = vi.mocked(makeClientAPIRequest).mock.calls[0][0] as string;
		expect(url).toBe('/v2/users/current/trails/t1/start');
	});

	it('startRun keeps the local run even when the start POST fails', async () => {
		const store = useTrailsStore();
		vi.mocked(makeClientAPIRequest).mockRejectedValue(new Error('offline'));
		const run = await store.startRun(trail('t1'));
		expect(store.getRun('t1')).toBeTruthy();
		expect(run.completed).toBe(false);
	});

	it('addPresence accumulates unhurried minutes and floors negative contributions', async () => {
		const store = useTrailsStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue(ok(undefined) as any);
		await store.startRun(trail('t1'));
		store.addPresence('t1', 10);
		store.addPresence('t1', 5);
		expect(store.getRun('t1')?.presenceMinutes).toBe(15);
		store.addPresence('t1', -100);
		expect(store.getRun('t1')?.presenceMinutes).toBe(15);
	});

	it('addPresence is a no-op for an unknown run', () => {
		const store = useTrailsStore();
		store.addPresence('ghost', 10);
		expect(store.getRun('ghost')).toBeUndefined();
	});

	it('completeRun writes the journal + ring from the server echo', async () => {
		const store = useTrailsStore();
		store.upsertTrail(trail('t1'));
		const echo = { entry: journalEntry('t1', { presenceMinutes: 12 }), natureMinutes: nature(60) };
		vi.mocked(makeClientAPIRequest).mockResolvedValue(ok(echo) as any);
		await store.startRun(trail('t1'));

		const res = await store.completeRun('t1', reflection(), 12);
		expect(res.success).toBe(true);
		expect(res.data?.trailId).toBe('t1');
		expect(store.journal[0]?.trailId).toBe('t1');
		expect(store.natureMinutes?.minutes).toBe(60);
		expect(store.getRun('t1')?.completed).toBe(true);
		expect(invalidateAPICache).toHaveBeenCalledWith('trail-journal');
		expect(invalidateAPICache).toHaveBeenCalledWith('nature-minutes-current');
		const url = vi.mocked(makeClientAPIRequest).mock.calls.at(-1)?.[0] as string;
		expect(url).toBe('/v2/users/current/trails/t1/complete');
	});

	it('completeRun synthesizes an entry and bumps the ring when the server does not echo', async () => {
		const store = useTrailsStore();
		store.upsertTrail(trail('t1', { title: 'Sky Sit', practice: 'sky_watch' }));
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true } as any);
		await store.startRun(trail('t1'));

		const res = await store.completeRun('t1', reflection({ note: 'lovely' }), 18);
		expect(res.success).toBe(true);
		expect(res.data?.title).toBe('Sky Sit');
		expect(res.data?.practice).toBe('sky_watch');
		expect(res.data?.presenceMinutes).toBe(18);
		expect(store.journal[0]?.reflection.note).toBe('lovely');
		expect(store.natureMinutes?.minutes).toBe(18);
		// the optimistic credit is tagged as a trail source
		expect(store.natureMinutes?.sources.at(-1)?.kind).toBe('trail');
	});

	it('completeRun ignores a malformed server echo and falls back optimistically', async () => {
		const store = useTrailsStore();
		store.upsertTrail(trail('t1'));
		vi.mocked(makeClientAPIRequest).mockResolvedValue(
			ok({ entry: { trailId: 5, bad: true }, natureMinutes: { minutes: 'lots' } }) as any
		);
		const res = await store.completeRun('t1', reflection(), 9);
		expect(res.success).toBe(true);
		// bad entry dropped -> synthesized fallback entry
		expect(res.data?.trailId).toBe('t1');
		expect(res.data?.presenceMinutes).toBe(9);
		// bad nature shape dropped -> optimistic bump only
		expect(store.natureMinutes?.minutes).toBe(9);
	});

	it('completeRun defaults to the run presence minutes when none is passed', async () => {
		const store = useTrailsStore();
		store.upsertTrail(trail('t1'));
		vi.mocked(makeClientAPIRequest).mockResolvedValue(ok(undefined) as any);
		await store.startRun(trail('t1'));
		store.addPresence('t1', 14);
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true } as any);
		const res = await store.completeRun('t1', reflection());
		expect(res.data?.presenceMinutes).toBe(14);
		expect(store.natureMinutes?.minutes).toBe(14);
	});

	it('clearRun removes the active run', async () => {
		const store = useTrailsStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue(ok(undefined) as any);
		await store.startRun(trail('t1'));
		store.clearRun('t1');
		expect(store.getRun('t1')).toBeUndefined();
	});
});

// #region journal

describe('trails store fetchJournal', () => {
	it('loads and stores a valid journal', async () => {
		const store = useTrailsStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(
			ok([journalEntry('t1'), journalEntry('t2')]) as any
		);
		const res = await store.fetchJournal();
		expect(res.success).toBe(true);
		expect(store.journal.map((e) => e.trailId)).toEqual(['t1', 't2']);
		expect(store.journalLoaded).toBe(true);
		const url = vi.mocked(makeAPIRequest).mock.calls[0][1] as string;
		expect(url).toBe('/v2/users/current/trail-journal');
	});

	it('unwraps an { items } envelope', async () => {
		const store = useTrailsStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok({ items: [journalEntry('t1')] }) as any);
		await store.fetchJournal();
		expect(store.journal.length).toBe(1);
	});

	it('filters malformed entries out via zod', async () => {
		const store = useTrailsStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(
			ok([journalEntry('good'), { trailId: '', bad: true }, null, 42]) as any
		);
		const res = await store.fetchJournal();
		expect(res.success).toBe(true);
		expect(store.journal.map((e) => e.trailId)).toEqual(['good']);
	});

	it('handles an empty journal', async () => {
		const store = useTrailsStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok([]) as any);
		const res = await store.fetchJournal();
		expect(res.success).toBe(true);
		expect(store.journal).toEqual([]);
		expect(store.journalLoaded).toBe(true);
	});

	it('serves the cached journal until forced, then refetches', async () => {
		const store = useTrailsStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok([journalEntry('t1')]) as any);
		await store.fetchJournal();
		await store.fetchJournal(); // journalLoaded -> served from state, no network
		expect(makeAPIRequest).toHaveBeenCalledTimes(1);
		await store.fetchJournal(true);
		expect(makeAPIRequest).toHaveBeenCalledTimes(2);
		expect(invalidateAPICache).toHaveBeenCalledWith('trail-journal');
	});

	it('returns a failure envelope when the journal request fails', async () => {
		const store = useTrailsStore();
		vi.mocked(makeAPIRequest).mockResolvedValue({ success: false, message: 'down' } as any);
		const res = await store.fetchJournal();
		expect(res.success).toBe(false);
	});
});

describe('trails store nature minutes', () => {
	it('fetchNatureMinutes stores a valid week', async () => {
		const store = useTrailsStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok(nature(30)) as any);
		const res = await store.fetchNatureMinutes('u1');
		expect(res.success).toBe(true);
		expect(store.natureMinutes?.minutes).toBe(30);
	});

	it('fetchNatureMinutes falls back to an empty week on failure', async () => {
		const store = useTrailsStore();
		vi.mocked(makeAPIRequest).mockResolvedValue({ success: false, message: 'x' } as any);
		const res = await store.fetchNatureMinutes('u1');
		expect(res.success).toBe(false);
		expect(store.natureMinutes?.minutes).toBe(0);
		expect(store.natureMinutes?.target).toBe(120);
	});

	it('fetchNatureMinutes short-circuits without a uid', async () => {
		const store = useTrailsStore();
		const res = await store.fetchNatureMinutes('');
		expect(res.success).toBe(false);
		expect(makeAPIRequest).not.toHaveBeenCalled();
	});

	it('creditNatureMinutes stores the server total when echoed', async () => {
		const store = useTrailsStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue(ok(nature(45)) as any);
		const res = await store.creditNatureMinutes('u1', {
			kind: 'trail',
			minutes: 15,
			at: new Date().toISOString()
		});
		expect(res.success).toBe(true);
		expect(store.natureMinutes?.minutes).toBe(45);
		expect(invalidateAPICache).toHaveBeenCalledWith('nature-minutes-u1');
	});

	it('creditNatureMinutes optimistically bumps when the total is not echoed', async () => {
		const store = useTrailsStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: false } as any);
		await store.creditNatureMinutes('u1', {
			kind: 'trail',
			minutes: 20,
			at: new Date().toISOString()
		});
		expect(store.natureMinutes?.minutes).toBe(20);
		expect(store.natureMinutes?.best).toBe(20);
	});
});

describe('trails store zod shape-guard (malformed data)', () => {
	it('rejects non-object garbage payloads via setTrails', () => {
		const store = useTrailsStore();
		store.setTrails([
			null as unknown as Trail,
			42 as unknown as Trail,
			'trail' as unknown as Trail,
			[] as unknown as Trail,
			{} as unknown as Trail
		]);
		expect(store.cache.size).toBe(0);
	});

	it('rejects a trail whose practice is empty', () => {
		const store = useTrailsStore();
		store.setTrails([trail('t1', { practice: '' as any })]);
		expect(store.has('t1')).toBe(false);
	});

	it('rejects a trail with a null title', () => {
		const store = useTrailsStore();
		store.setTrails([
			{
				id: 't1',
				title: null,
				practice: 'sit_spot',
				curiosity: 'c',
				reveal: 'r'
			} as unknown as Trail
		]);
		expect(store.has('t1')).toBe(false);
	});

	it('keeps the good ones and drops the malformed in a mixed batch', () => {
		const store = useTrailsStore();
		store.setTrails([
			trail('good'),
			{
				id: 'bad',
				title: 5,
				practice: 'sit_spot',
				curiosity: 'c',
				reveal: 'r'
			} as unknown as Trail,
			null as unknown as Trail
		]);
		expect(store.has('good')).toBe(true);
		expect(store.has('bad')).toBe(false);
		expect(store.cache.size).toBe(1);
	});

	it('upsertTrail ignores a malformed trail', () => {
		const store = useTrailsStore();
		store.upsertTrail({ id: '', title: 'x', practice: 'sit_spot' } as unknown as Trail);
		expect(store.cache.size).toBe(0);
	});

	it('fetchTrail caches null on a 200-but-malformed body (definitive miss, not transient)', async () => {
		const store = useTrailsStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok({ id: 't1', title: 'x' }) as any);
		const result = await store.fetchTrail('t1', false);
		expect(result).toBeNull();
		expect(store.has('t1')).toBe(true);
		expect(store.get('t1')).toBeNull();
	});

	it('fetchNatureMinutes rejects a malformed week and falls back to an empty week', async () => {
		const store = useTrailsStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok({ minutes: 'lots', week: 3 }) as any);
		const res = await store.fetchNatureMinutes('u1');
		expect(res.success).toBe(false);
		expect(store.natureMinutes?.minutes).toBe(0);
	});

	it('creditNatureMinutes ignores a malformed server total and bumps optimistically', async () => {
		const store = useTrailsStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue(ok({ minutes: null }) as any);
		const res = await store.creditNatureMinutes('u1', {
			kind: 'trail',
			minutes: 12,
			at: new Date().toISOString()
		});
		// bad server shape is dropped; the ring still moves via the optimistic path
		expect(res.success).toBe(true);
		expect(store.natureMinutes?.minutes).toBe(12);
	});
});

describe('trails store transient vs not-found (classifyItemFetch)', () => {
	it('keeps the last-good trail on a transient (5xx, no data) failure', async () => {
		const store = useTrailsStore();
		store.upsertTrail(trail('t1', { duration: 7 }));
		vi.mocked(makeAPIRequest).mockResolvedValue({ success: false, status: 500 } as any);
		await store.fetchTrail('t1', true);
		// transient failure must not clobber the cached entry with null
		expect(store.get('t1')?.duration).toBe(7);
	});

	it('caches null only when there is no last-good entry and the failure is definitive', async () => {
		const store = useTrailsStore();
		vi.mocked(makeAPIRequest).mockResolvedValue({ success: false, status: 404 } as any);
		const result = await store.fetchTrail('t9', false);
		expect(result).toBeNull();
		expect(store.get('t9')).toBeNull();
	});

	it('caches null when the request throws and nothing was cached', async () => {
		const store = useTrailsStore();
		vi.mocked(makeAPIRequest).mockRejectedValue(new Error('network'));
		const result = await store.fetchTrail('t1', false);
		expect(result).toBeNull();
		expect(store.get('t1')).toBeNull();
		expect(store.cache.get('t1')).toBeNull();
	});
});

describe('trails store envelope + reactivity', () => {
	it('fetchTrails returns a {success,data} envelope on the happy path', async () => {
		const store = useTrailsStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok([trail('a')]) as any);
		const res = await store.fetchTrails({});
		expect(res).toMatchObject({ success: true });
		expect((res as { data?: Trail[] }).data?.map((t) => t.id)).toEqual(['a']);
	});

	it('fetchTrails returns a {success:false,message} envelope on failure', async () => {
		const store = useTrailsStore();
		vi.mocked(makeAPIRequest).mockResolvedValue({ success: false, message: 'down' } as any);
		const res = await store.fetchTrails({});
		expect(res).toMatchObject({ success: false, message: 'down' });
	});

	it('a computed over list() recomputes when the cache changes', async () => {
		const store = useTrailsStore();
		const count = computed(() => store.list().length);
		expect(count.value).toBe(0);
		store.upsertTrail(trail('t1'));
		await nextTick();
		expect(count.value).toBe(1);
		store.clear();
		await nextTick();
		expect(count.value).toBe(0);
	});

	it('journal is reactive to a completed run', async () => {
		const store = useTrailsStore();
		const size = computed(() => store.journal.length);
		expect(size.value).toBe(0);
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true } as any);
		await store.completeRun('t1', reflection(), 5);
		await nextTick();
		expect(size.value).toBe(1);
	});

	it('natureMinutes is reactive to a credit', async () => {
		const store = useTrailsStore();
		const minutes = computed(() => store.natureMinutes?.minutes ?? 0);
		expect(minutes.value).toBe(0);
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: false } as any);
		await store.creditNatureMinutes('u1', { kind: 'manual', minutes: 25, at: 'now' });
		await nextTick();
		expect(minutes.value).toBe(25);
	});
});

describe('trails store clear', () => {
	afterEach(() => vi.clearAllMocks());

	it('wipes cache, runs, journal and nature minutes', async () => {
		const store = useTrailsStore();
		store.upsertTrail(trail('t1'));
		vi.mocked(makeClientAPIRequest).mockResolvedValue(ok(undefined) as any);
		await store.startRun(trail('t1'));
		store.natureMinutes = nature(10);
		store.journal = [journalEntry('t1')];
		store.clear();
		expect(store.cache.size).toBe(0);
		expect(store.getRun('t1')).toBeUndefined();
		expect(store.natureMinutes).toBeNull();
		expect(store.journal).toEqual([]);
		expect(store.journalLoaded).toBe(false);
		expect(store.listLoaded).toBe(false);
	});
});
