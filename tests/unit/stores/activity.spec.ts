import { createPinia, setActivePinia } from 'pinia';
import { useActivityStore } from 'stores/activity';
import type { Activity } from 'types/activity';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return {
		...actual,
		makeAPIRequest: vi.fn(),
		makeClientAPIRequest: vi.fn()
	};
});

import { makeAPIRequest, makeClientAPIRequest } from 'utils';

function stubActivities(...ids: string[]): Activity[] {
	return ids.map((id) => ({ id }) as unknown as Activity);
}

const ids = (items: Activity[] | null) => (items ?? []).map((a) => a.id);

beforeEach(() => {
	setActivePinia(createPinia());
	vi.clearAllMocks();
});

describe('activity store get/has/three-state', () => {
	it('get returns undefined for an empty id', () => {
		const store = useActivityStore();
		expect(store.get('')).toBeUndefined();
	});

	it('get returns undefined for an unknown id', () => {
		const store = useActivityStore();
		expect(store.get('nope')).toBeUndefined();
	});

	it('get returns null for a confirmed-not-found id', () => {
		const store = useActivityStore();
		store.cache.set('gone', null);
		expect(store.get('gone')).toBeNull();
		expect(store.has('gone')).toBe(true);
	});

	it('isLoading is false for null/undefined/empty ids', () => {
		const store = useActivityStore();
		expect(store.isLoading(null)).toBe(false);
		expect(store.isLoading(undefined)).toBe(false);
		expect(store.isLoading('')).toBe(false);
	});
});

describe('activity store setActivities', () => {
	it('caches each activity keyed by id', () => {
		const store = useActivityStore();
		store.setActivities(stubActivities('a1', 'a2'));
		expect(store.has('a1')).toBe(true);
		expect(store.get('a2')?.id).toBe('a2');
		expect(store.cache.size).toBe(2);
	});
});

describe('activity store random cache', () => {
	it('keys on count', () => {
		const store = useActivityStore();
		store.setRandomCached(3, stubActivities('a', 'b'));
		store.setRandomCached(6, stubActivities('c'));
		expect(ids(store.getRandomCached(3))).toEqual(['a', 'b']);
		expect(ids(store.getRandomCached(6))).toEqual(['c']);
	});

	it('returns null for an uncached count', () => {
		const store = useActivityStore();
		store.setRandomCached(3, stubActivities('a'));
		expect(store.getRandomCached(5)).toBeNull();
	});

	describe('ttl', () => {
		beforeEach(() => vi.useFakeTimers());
		afterEach(() => vi.useRealTimers());

		it('serves within the 5-minute window and expires past it', () => {
			const store = useActivityStore();
			store.setRandomCached(3, stubActivities('fresh'));

			vi.advanceTimersByTime(4 * 60 * 1000);
			expect(ids(store.getRandomCached(3))).toEqual(['fresh']);

			vi.advanceTimersByTime(2 * 60 * 1000);
			expect(store.getRandomCached(3)).toBeNull();
		});
	});
});

describe('activity store LRU eviction', () => {
	// MAX_CACHE_SIZE is 200; setActivities runs evictOldestIfNeeded before each insert
	it('caps the cache at MAX_CACHE_SIZE, evicting oldest first', () => {
		const store = useActivityStore();
		const seed = stubActivities(...Array.from({ length: 200 }, (_, i) => `seed-${i}`));
		store.setActivities(seed);
		expect(store.cache.size).toBe(200);
		expect(store.has('seed-0')).toBe(true);

		// one more insert trips eviction of the oldest key
		store.setActivities(stubActivities('overflow'));
		expect(store.cache.size).toBe(200);
		expect(store.has('seed-0')).toBe(false);
		expect(store.has('overflow')).toBe(true);
	});
});

describe('activity store fetchActivity', () => {
	it('caches a valid payload', async () => {
		const store = useActivityStore();
		vi.mocked(makeAPIRequest).mockResolvedValue({
			success: true,
			data: { id: 'a1' }
		} as any);

		const result = await store.fetchActivity('a1');
		expect(result?.id).toBe('a1');
		expect(store.get('a1')?.id).toBe('a1');
		expect(store.isLoading('a1')).toBe(false);
	});

	it('caches null on a failed response', async () => {
		const store = useActivityStore();
		vi.mocked(makeAPIRequest).mockResolvedValue({
			success: false,
			message: 'boom'
		} as any);

		const result = await store.fetchActivity('a1');
		expect(result).toBeNull();
		expect(store.get('a1')).toBeNull();
	});

	it('caches null when the request throws', async () => {
		const store = useActivityStore();
		vi.mocked(makeAPIRequest).mockRejectedValue(new Error('network'));

		const result = await store.fetchActivity('a1');
		expect(result).toBeNull();
		expect(store.get('a1')).toBeNull();
		expect(store.isLoading('a1')).toBe(false);
	});

	it('returns null for an empty id without calling the network', async () => {
		const store = useActivityStore();
		const result = await store.fetchActivity('');
		expect(result).toBeNull();
		expect(makeAPIRequest).not.toHaveBeenCalled();
	});

	it('serves a cached hit without re-fetching', async () => {
		const store = useActivityStore();
		store.setActivities(stubActivities('a1'));
		const result = await store.fetchActivity('a1');
		expect(result?.id).toBe('a1');
		expect(makeAPIRequest).not.toHaveBeenCalled();
	});

	it('refetches when force is true', async () => {
		const store = useActivityStore();
		store.setActivities(stubActivities('a1'));
		vi.mocked(makeAPIRequest).mockResolvedValue({
			success: true,
			data: { id: 'a1', name: 'updated' }
		} as any);

		await store.fetchActivity('a1', true);
		expect(makeAPIRequest).toHaveBeenCalledTimes(1);
		expect((store.get('a1') as any).name).toBe('updated');
	});

	it('dedupes concurrent fetches into one network call', async () => {
		const store = useActivityStore();
		vi.mocked(makeAPIRequest).mockResolvedValue({
			success: true,
			data: { id: 'a1' }
		} as any);

		const [a, b] = await Promise.all([store.fetchActivity('a1'), store.fetchActivity('a1')]);
		expect(a?.id).toBe('a1');
		expect(b?.id).toBe('a1');
		expect(makeAPIRequest).toHaveBeenCalledTimes(1);
	});
});

describe('activity store fetchCount', () => {
	it('stores total from a valid response', async () => {
		const store = useActivityStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue({
			success: true,
			data: { items: ['x'], total: 42 }
		} as any);

		const total = await store.fetchCount();
		expect(total).toBe(42);
		expect(store.count).toBe(42);
	});

	it('resets count to undefined on a failed response', async () => {
		const store = useActivityStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue({
			success: false,
			message: 'nope'
		} as any);

		const total = await store.fetchCount();
		expect(total).toBeUndefined();
		expect(store.count).toBeUndefined();
	});

	it('resets count to undefined when the request throws', async () => {
		const store = useActivityStore();
		vi.mocked(makeClientAPIRequest).mockRejectedValue(new Error('x'));
		const total = await store.fetchCount();
		expect(total).toBeUndefined();
		expect(store.count).toBeUndefined();
	});
});

describe('activity store mutations', () => {
	it('createActivity caches the returned activity', async () => {
		const store = useActivityStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue({
			success: true,
			data: { id: 'created' }
		} as any);

		await store.createActivity({ id: 'created' } as Activity);
		expect(store.get('created')?.id).toBe('created');
	});

	it('updateActivity caches the updated activity', async () => {
		const store = useActivityStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue({
			success: true,
			data: { id: 'u1', name: 'new' }
		} as any);

		await store.updateActivity({ id: 'u1' } as Activity);
		expect((store.get('u1') as any).name).toBe('new');
	});

	it('deleteActivity removes the cache entry on success', async () => {
		const store = useActivityStore();
		store.setActivities(stubActivities('d1'));
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true } as any);

		await store.deleteActivity('d1');
		expect(store.has('d1')).toBe(false);
	});

	it('deleteActivity leaves the cache untouched on failure', async () => {
		const store = useActivityStore();
		store.setActivities(stubActivities('d1'));
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: false } as any);

		await store.deleteActivity('d1');
		expect(store.has('d1')).toBe(true);
	});
});

describe('activity store clear', () => {
	it('clears a single id', () => {
		const store = useActivityStore();
		store.setActivities(stubActivities('a1', 'a2'));
		store.clear('a1');
		expect(store.has('a1')).toBe(false);
		expect(store.has('a2')).toBe(true);
	});

	it('clears everything when called with no id', () => {
		const store = useActivityStore();
		store.setActivities(stubActivities('a1', 'a2'));
		store.clear();
		expect(store.cache.size).toBe(0);
	});
});
