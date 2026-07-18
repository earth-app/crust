import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from 'stores/auth';
import { useTrailsStore } from 'stores/trails';
import type { NatureMinutes, Trail } from 'types/trails';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, nextTick } from 'vue';

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
		description: 'A short walk',
		icon: 'mdi:leaf',
		rarity: 'normal',
		steps: [
			{
				step: { type: 'take_photo_location', description: 'Photograph a tree', parameters: [] },
				clue: 'What is older than it looks?',
				reveal: 'That oak may be two centuries old.'
			}
		],
		reward: 10,
		...extra
	} as Trail;
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

	it('rejects trails missing id / title / steps', () => {
		const store = useTrailsStore();
		store.setTrails([
			{ id: '', title: 'x', steps: [] } as unknown as Trail,
			{ id: 'a', steps: [] } as unknown as Trail,
			{ id: 'b', title: 't' } as unknown as Trail
		]);
		expect(store.cache.size).toBe(0);
	});

	it('does not let setTrails clobber an already-cached trail', () => {
		const store = useTrailsStore();
		store.upsertTrail(trail('t1', { reward: 99 }));
		store.setTrails([trail('t1', { reward: 5 })]);
		expect(store.get('t1')?.reward).toBe(99);
	});

	it('still seeds trails not yet cached', () => {
		const store = useTrailsStore();
		store.upsertTrail(trail('t1'));
		store.setTrails([trail('t1'), trail('t2')]);
		expect(store.has('t2')).toBe(true);
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
		vi.mocked(makeAPIRequest).mockResolvedValue(ok(trail('t1', { reward: 42 })) as any);
		await store.fetchTrail('t1', true);
		expect(invalidateAPICache).toHaveBeenCalledWith('trail-t1');
		expect(store.get('t1')?.reward).toBe(42);
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

describe('trails store run state', () => {
	it('acceptTrail captures the pledge and seeds a reveal array', () => {
		const store = useTrailsStore();
		const t = trail('t1');
		const run = store.acceptTrail(t, { when: 'after lunch' });
		expect(run.pledge?.when).toBe('after lunch');
		expect(run.stepRevealed).toEqual([false]);
		expect(store.getRun('t1')?.currentStep).toBe(0);
	});

	it('revealStep unlocks a reveal and advances the pointer', () => {
		const store = useTrailsStore();
		store.acceptTrail(trail('t1'), { when: 'x' });
		store.revealStep('t1', 0);
		expect(store.getRun('t1')?.stepRevealed[0]).toBe(true);
		expect(store.getRun('t1')?.currentStep).toBe(1);
	});

	it('completeTrail marks the run complete and clearRun removes it', () => {
		const store = useTrailsStore();
		store.acceptTrail(trail('t1'), { when: 'x' });
		store.completeTrail('t1');
		expect(store.getRun('t1')?.completed).toBe(true);
		store.clearRun('t1');
		expect(store.getRun('t1')).toBeUndefined();
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
			kind: 'trail_step',
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
			kind: 'trail_step',
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

	it('rejects a trail whose steps is not an array', () => {
		const store = useTrailsStore();
		store.setTrails([{ id: 't1', title: 'x', steps: 'nope' } as unknown as Trail]);
		expect(store.has('t1')).toBe(false);
	});

	it('rejects a trail whose steps contain the wrong shape', () => {
		const store = useTrailsStore();
		store.setTrails([{ id: 't1', title: 'x', steps: [1, 2, 3] } as unknown as Trail]);
		expect(store.has('t1')).toBe(false);
	});

	it('rejects a trail with a null title', () => {
		const store = useTrailsStore();
		store.setTrails([{ id: 't1', title: null, steps: [] } as unknown as Trail]);
		expect(store.has('t1')).toBe(false);
	});

	it('keeps the good ones and drops the malformed in a mixed batch', () => {
		const store = useTrailsStore();
		store.setTrails([
			trail('good'),
			{ id: 'bad', title: 5, steps: [] } as unknown as Trail,
			null as unknown as Trail
		]);
		expect(store.has('good')).toBe(true);
		expect(store.has('bad')).toBe(false);
		expect(store.cache.size).toBe(1);
	});

	it('upsertTrail ignores a malformed trail', () => {
		const store = useTrailsStore();
		store.upsertTrail({ id: '', title: 'x', steps: [] } as unknown as Trail);
		expect(store.cache.size).toBe(0);
	});

	it('fetchTrail caches null on a 200-but-malformed body (definitive miss, not transient)', async () => {
		const store = useTrailsStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok({ id: 't1', title: 'x', steps: 'bad' }) as any);
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
			kind: 'trail_step',
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
		store.upsertTrail(trail('t1', { reward: 7 }));
		vi.mocked(makeAPIRequest).mockResolvedValue({ success: false, status: 500 } as any);
		await store.fetchTrail('t1', true);
		// transient failure must not clobber the cached entry with null
		expect(store.get('t1')?.reward).toBe(7);
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

	it('wipes cache, runs and nature minutes', () => {
		const store = useTrailsStore();
		store.upsertTrail(trail('t1'));
		store.acceptTrail(trail('t1'), { when: 'x' });
		store.natureMinutes = nature(10);
		store.clear();
		expect(store.cache.size).toBe(0);
		expect(store.getRun('t1')).toBeUndefined();
		expect(store.natureMinutes).toBeNull();
		expect(store.listLoaded).toBe(false);
	});
});
