import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from 'stores/auth';
import { useTrailmarkStore } from 'stores/trailmark';
import type { Trailmark } from 'types/trailmarks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, nextTick } from 'vue';

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

function mark(id: string, extra: Partial<Trailmark> = {}): Trailmark {
	return {
		id,
		author_uid: 'author',
		author_username: 'walker',
		geo: { lat: 41.88, lng: -87.63 },
		note: 'Look up at the sky here.',
		created_at: new Date().toISOString(),
		...extra
	} as Trailmark;
}

const ok = <T>(data: T) => ({ success: true as const, data });

beforeEach(() => {
	setActivePinia(createPinia());
	vi.clearAllMocks();
	useAuthStore().setSessionToken('token');
});

describe('trailmark store validation + upsert', () => {
	it('rejects malformed marks', () => {
		const store = useTrailmarkStore();
		store.upsert({ id: '', note: 'x', geo: { lat: 1, lng: 2 } } as unknown as Trailmark);
		store.upsert({ id: 'a', note: 1, geo: {} } as unknown as Trailmark);
		store.upsert({ id: 'b', note: 'x' } as unknown as Trailmark);
		expect(store.cache.size).toBe(0);
	});

	it('preserves a locally-known thank across a fresh upsert', () => {
		const store = useTrailmarkStore();
		store.upsert(mark('m1', { thanked_by_me: true }));
		store.upsert(mark('m1', { thanked_by_me: false }));
		expect(store.get('m1')?.thanked_by_me).toBe(true);
	});
});

describe('trailmark store fetchNearby', () => {
	it('caches nearby marks from a valid mantle2 response', async () => {
		const store = useTrailmarkStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok([mark('m1'), mark('m2')]) as any);
		const res = await store.fetchNearby({ lat: 41.88, lng: -87.63 }, false);
		expect(res.success).toBe(true);
		expect(store.get('m1')).toBeTruthy();
		expect(store.get('m2')).toBeTruthy();
		const url = vi.mocked(makeAPIRequest).mock.calls[0][1] as string;
		expect(url).toContain('/v2/trailmarks');
	});

	it('serves a cached bucket within the ttl without refetching', async () => {
		const store = useTrailmarkStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok([mark('m1')]) as any);
		await store.fetchNearby({ lat: 41.88, lng: -87.63 }, false);
		await store.fetchNearby({ lat: 41.88, lng: -87.63 }, false);
		expect(makeAPIRequest).toHaveBeenCalledTimes(1);
	});

	it('force bypasses the nearby cache', async () => {
		const store = useTrailmarkStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok([mark('m1')]) as any);
		await store.fetchNearby({ lat: 41.88, lng: -87.63 }, false);
		await store.fetchNearby({ lat: 41.88, lng: -87.63 }, true);
		expect(makeAPIRequest).toHaveBeenCalledTimes(2);
	});

	it('caps the radius at the 2km ceiling in the request url', async () => {
		const store = useTrailmarkStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok([]) as any);
		await store.fetchNearby({ lat: 1, lng: 2, radius: 999999 }, false);
		const url = vi.mocked(makeAPIRequest).mock.calls[0][1] as string;
		expect(url).toContain('radius=2000');
	});
});

describe('trailmark store createTrailmark', () => {
	it('caches the returned note, tracks it as mine, and clears the nearby cache', async () => {
		const store = useTrailmarkStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok([mark('existing')]) as any);
		await store.fetchNearby({ lat: 1, lng: 2 }, false);
		expect(store.nearbyCache.size).toBe(1);

		vi.mocked(makeClientAPIRequest).mockResolvedValue(ok(mark('new')) as any);
		const res = await store.createTrailmark({ geo: { lat: 1, lng: 2 }, note: 'hi' });
		expect(res.success).toBe(true);
		expect(store.get('new')).toBeTruthy();
		expect(store.mine).toContain('new');
		expect(store.nearbyCache.size).toBe(0);
	});

	it('returns a failure envelope when the server rejects the note', async () => {
		const store = useTrailmarkStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue({
			success: false,
			message: 'blocked'
		} as any);
		const res = await store.createTrailmark({ geo: { lat: 1, lng: 2 }, note: 'x' });
		expect(res.success).toBe(false);
	});
});

describe('trailmark store thankTrailmark', () => {
	it('marks the note thanked on success', async () => {
		const store = useTrailmarkStore();
		store.upsert(mark('m1'));
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true } as any);
		const res = await store.thankTrailmark('m1');
		expect(res.success).toBe(true);
		expect(store.hasThanked('m1')).toBe(true);
	});

	it('treats a 409 as an already-thanked success', async () => {
		const store = useTrailmarkStore();
		store.upsert(mark('m1'));
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: false, status: 409 } as any);
		const res = await store.thankTrailmark('m1');
		expect(res.success).toBe(true);
		expect((res as { alreadyThanked?: boolean }).alreadyThanked).toBe(true);
		expect(store.hasThanked('m1')).toBe(true);
	});

	it('surfaces a real failure', async () => {
		const store = useTrailmarkStore();
		store.upsert(mark('m1'));
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: false, status: 500 } as any);
		const res = await store.thankTrailmark('m1');
		expect(res.success).toBe(false);
		expect(store.hasThanked('m1')).toBe(false);
	});
});

describe('trailmark store zod shape-guard (malformed data)', () => {
	it('rejects non-object and garbage payloads via upsert', () => {
		const store = useTrailmarkStore();
		store.upsert(null as unknown as Trailmark);
		store.upsert(42 as unknown as Trailmark);
		store.upsert([] as unknown as Trailmark);
		store.upsert('note' as unknown as Trailmark);
		expect(store.cache.size).toBe(0);
	});

	it('rejects a mark whose geo lacks numeric lat/lng', () => {
		const store = useTrailmarkStore();
		store.upsert(mark('m1', { geo: {} as any }));
		store.upsert(mark('m2', { geo: { lat: 'x', lng: 'y' } as any }));
		expect(store.cache.size).toBe(0);
	});

	it('rejects a mark with a null note', () => {
		const store = useTrailmarkStore();
		store.upsert(mark('m1', { note: null as unknown as string }));
		expect(store.get('m1')).toBeUndefined();
	});

	it('filters malformed marks out of a nearby batch, keeping the good ones', async () => {
		const store = useTrailmarkStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(
			ok([mark('good'), { id: 'bad', note: 1, geo: {} }, null]) as any
		);
		const res = await store.fetchNearby({ lat: 1, lng: 2 }, false);
		expect(res.success).toBe(true);
		expect((res as { data?: Trailmark[] }).data?.map((m) => m.id)).toEqual(['good']);
		expect(store.get('bad')).toBeUndefined();
	});

	it('drops a malformed created note and surfaces a failure envelope', async () => {
		const store = useTrailmarkStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue(ok({ id: 'x', note: 5, geo: {} }) as any);
		const res = await store.createTrailmark({ geo: { lat: 1, lng: 2 }, note: 'hi' });
		expect(res.success).toBe(false);
		expect(store.mine.length).toBe(0);
	});
});

describe('trailmark store nearby cache + envelope', () => {
	it('unwraps an { items } envelope', async () => {
		const store = useTrailmarkStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok({ items: [mark('m1')] }) as any);
		const res = await store.fetchNearby({ lat: 1, lng: 2 }, false);
		expect(res.success).toBe(true);
		expect(store.get('m1')).toBeTruthy();
	});

	it('returns a failure envelope when the nearby request fails', async () => {
		const store = useTrailmarkStore();
		vi.mocked(makeAPIRequest).mockResolvedValue({ success: false, message: 'no gps' } as any);
		const res = await store.fetchNearby({ lat: 1, lng: 2 }, false);
		expect(res).toMatchObject({ success: false, message: 'no gps' });
	});

	it('buckets nearby by rounded coordinates so a nudge shares the cache', async () => {
		const store = useTrailmarkStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok([mark('m1')]) as any);
		await store.fetchNearby({ lat: 41.8801, lng: -87.6301 }, false);
		// within the same 3-decimal bucket -> served from cache, no second call
		await store.fetchNearby({ lat: 41.8804, lng: -87.6299 }, false);
		expect(makeAPIRequest).toHaveBeenCalledTimes(1);
	});
});

describe('trailmark store thank privacy + reactivity', () => {
	it('a computed over the cache reflects a thank flipping', async () => {
		const store = useTrailmarkStore();
		store.upsert(mark('m1'));
		const thanked = computed(() => store.get('m1')?.thanked_by_me === true);
		expect(thanked.value).toBe(false);
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true } as any);
		await store.thankTrailmark('m1');
		await nextTick();
		expect(thanked.value).toBe(true);
	});

	it('mine tracks authored notes reactively', async () => {
		const store = useTrailmarkStore();
		const mineCount = computed(() => store.mine.length);
		expect(mineCount.value).toBe(0);
		vi.mocked(makeClientAPIRequest).mockResolvedValue(ok(mark('new')) as any);
		await store.createTrailmark({ geo: { lat: 1, lng: 2 }, note: 'hi' });
		await nextTick();
		expect(mineCount.value).toBe(1);
	});

	it('thankTrailmark is a no-op envelope-wise when the note is unknown but still marks intent', async () => {
		const store = useTrailmarkStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true } as any);
		const res = await store.thankTrailmark('ghost');
		// server accepted; there is no cached mark to flip, but the call succeeds without throwing
		expect(res.success).toBe(true);
	});
});

describe('trailmark store fetchForPrompt / forPrompt', () => {
	it('loads a prompt bucket and exposes it via forPrompt', async () => {
		const store = useTrailmarkStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok([mark('m1'), mark('m2')]) as any);
		const res = await store.fetchForPrompt('p1');
		expect(res.success).toBe(true);
		expect(store.forPrompt('p1').map((m) => m.id)).toEqual(['m1', 'm2']);
		const url = vi.mocked(makeAPIRequest).mock.calls[0][1] as string;
		expect(url).toBe('/v2/prompts/p1/trailmarks');
	});

	it('unwraps an { items } envelope', async () => {
		const store = useTrailmarkStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok({ items: [mark('m1')] }) as any);
		await store.fetchForPrompt('p1');
		expect(store.forPrompt('p1').map((m) => m.id)).toEqual(['m1']);
	});

	it('filters malformed marks out of the prompt bucket', async () => {
		const store = useTrailmarkStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(
			ok([mark('good'), { id: 'bad', note: 1, geo: {} }, null]) as any
		);
		const res = await store.fetchForPrompt('p1');
		expect((res as { data?: Trailmark[] }).data?.map((m) => m.id)).toEqual(['good']);
		expect(store.forPrompt('p1').map((m) => m.id)).toEqual(['good']);
	});

	it('serves a cached bucket without refetching until forced', async () => {
		const store = useTrailmarkStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok([mark('m1')]) as any);
		await store.fetchForPrompt('p1');
		await store.fetchForPrompt('p1');
		expect(makeAPIRequest).toHaveBeenCalledTimes(1);
		await store.fetchForPrompt('p1', true);
		expect(makeAPIRequest).toHaveBeenCalledTimes(2);
	});

	it('short-circuits without a prompt id', async () => {
		const store = useTrailmarkStore();
		const res = await store.fetchForPrompt('');
		expect(res.success).toBe(false);
		expect(makeAPIRequest).not.toHaveBeenCalled();
	});

	it('returns a failure envelope when the prompt fetch fails', async () => {
		const store = useTrailmarkStore();
		vi.mocked(makeAPIRequest).mockResolvedValue({ success: false, message: 'nope' } as any);
		const res = await store.fetchForPrompt('p1');
		expect(res.success).toBe(false);
	});

	it('forPrompt returns an empty list for an unknown prompt', () => {
		const store = useTrailmarkStore();
		expect(store.forPrompt('nope')).toEqual([]);
	});
});

describe('trailmark store createTrailmark prompt link', () => {
	it('passes prompt_id through and invalidates the prompt bucket', async () => {
		const store = useTrailmarkStore();
		// seed a prompt bucket first
		vi.mocked(makeAPIRequest).mockResolvedValue(ok([mark('old')]) as any);
		await store.fetchForPrompt('p1');
		expect(store.promptCache.has('p1')).toBe(true);

		vi.mocked(makeClientAPIRequest).mockResolvedValue(ok(mark('new', { prompt_id: 'p1' })) as any);
		const res = await store.createTrailmark({
			geo: { lat: 1, lng: 2 },
			note: 'hi',
			prompt_id: 'p1'
		});
		expect(res.success).toBe(true);
		// prompt_id forwarded in the request body
		const body = vi.mocked(makeClientAPIRequest).mock.calls.at(-1)?.[2] as { body?: any };
		expect(body?.body?.prompt_id).toBe('p1');
		// bucket + util cache invalidated so the next read re-includes the new note
		expect(store.promptCache.has('p1')).toBe(false);
		expect(invalidateAPICache).toHaveBeenCalledWith('prompt-trailmarks-p1');
	});

	it('leaves the prompt cache alone for a non-prompt note', async () => {
		const store = useTrailmarkStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue(ok(mark('new')) as any);
		await store.createTrailmark({ geo: { lat: 1, lng: 2 }, note: 'hi' });
		expect(invalidateAPICache).not.toHaveBeenCalledWith('prompt-trailmarks-undefined');
	});
});

describe('trailmark store clear', () => {
	afterEach(() => vi.clearAllMocks());

	it('wipes cache, nearby buckets, prompt buckets and mine', () => {
		const store = useTrailmarkStore();
		store.upsert(mark('m1'));
		store.promptCache.set('p1', ['m1']);
		store.clear();
		expect(store.cache.size).toBe(0);
		expect(store.nearbyCache.size).toBe(0);
		expect(store.promptCache.size).toBe(0);
		expect(store.mine.length).toBe(0);
	});
});
