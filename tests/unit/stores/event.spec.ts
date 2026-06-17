import { createPinia, setActivePinia } from 'pinia';
import { useEventStore } from 'stores/event';
import type { Event } from 'types/event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// network helpers are imported at module load from the utils alias; spread the real
// module so pure helpers (valid, shuffle, etc.) stay intact and only stub the wire calls
vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return {
		...actual,
		makeAPIRequest: vi.fn(),
		makeClientAPIRequest: vi.fn(),
		makeServerRequest: vi.fn(),
		paginatedAPIRequest: vi.fn()
	};
});

import { makeAPIRequest, makeClientAPIRequest, paginatedAPIRequest } from 'utils';

// minimal well-formed event: id + host with an id is all isValidEvent checks
function makeEvent(id: string, extra: Partial<Event> = {}): Event {
	return { id, host: { id: `host-${id}` }, ...extra } as unknown as Event;
}

// opaque stub for the random cache (no validation on that path)
function stubEvents(...ids: string[]): Event[] {
	return ids.map((id) => ({ id }) as unknown as Event);
}

const ids = (items: Event[] | null) => (items ?? []).map((e) => e.id);

beforeEach(() => {
	setActivePinia(createPinia());
	vi.clearAllMocks();
});

describe('event store validation guard', () => {
	it('accepts a well-formed event via setEvents', () => {
		const store = useEventStore();
		store.setEvents([makeEvent('e1')]);
		expect(store.has('e1')).toBe(true);
		expect(store.get('e1')?.id).toBe('e1');
	});

	it('rejects events with a missing/empty id', () => {
		const store = useEventStore();
		store.setEvents([{ id: '', host: { id: 'h' } } as unknown as Event]);
		expect(store.cache.size).toBe(0);
	});

	it('rejects events whose host is an array (anon-stripped serializeUser)', () => {
		const store = useEventStore();
		store.setEvents([{ id: 'e1', host: [] } as unknown as Event]);
		expect(store.has('e1')).toBe(false);
	});

	it('rejects events with no host', () => {
		const store = useEventStore();
		store.setEvents([{ id: 'e1' } as unknown as Event]);
		expect(store.has('e1')).toBe(false);
	});

	it('rejects events whose host has no string id', () => {
		const store = useEventStore();
		store.setEvents([{ id: 'e1', host: { id: 42 } } as unknown as Event]);
		expect(store.has('e1')).toBe(false);
	});

	it('keeps valid entries and drops invalid ones in a mixed batch', () => {
		const store = useEventStore();
		store.setEvents([makeEvent('good'), { id: 'bad', host: [] } as unknown as Event]);
		expect(store.has('good')).toBe(true);
		expect(store.has('bad')).toBe(false);
	});

	it('does not let setEvents overwrite an already-cached event', () => {
		const store = useEventStore();
		store.cache.set('e1', makeEvent('e1', { is_attending: true } as Partial<Event>));
		store.setEvents([makeEvent('e1', { is_attending: false } as Partial<Event>)]);
		expect((store.get('e1') as any).is_attending).toBe(true);
	});

	it('still seeds events not yet cached via setEvents', () => {
		const store = useEventStore();
		store.cache.set('e1', makeEvent('e1'));
		store.setEvents([makeEvent('e1'), makeEvent('e2')]);
		expect(store.has('e2')).toBe(true);
	});
});

describe('event store get/has/three-state', () => {
	it('get returns undefined for an empty id', () => {
		const store = useEventStore();
		expect(store.get('')).toBeUndefined();
	});

	it('get returns undefined for an unknown id', () => {
		const store = useEventStore();
		expect(store.get('nope')).toBeUndefined();
	});

	it('get returns null for a confirmed-not-found id', () => {
		const store = useEventStore();
		store.cache.set('gone', null);
		expect(store.get('gone')).toBeNull();
		expect(store.has('gone')).toBe(true);
	});

	it('has reflects presence regardless of value', () => {
		const store = useEventStore();
		store.cache.set('x', null);
		expect(store.has('x')).toBe(true);
		expect(store.has('y')).toBe(false);
	});

	it('isLoading is false for null/undefined/empty ids', () => {
		const store = useEventStore();
		expect(store.isLoading(null)).toBe(false);
		expect(store.isLoading(undefined)).toBe(false);
		expect(store.isLoading('')).toBe(false);
	});
});

describe('event store updateEvent', () => {
	it('merges updates into an existing event', () => {
		const store = useEventStore();
		store.setEvents([makeEvent('e1', { attendee_count: 1 } as Partial<Event>)]);
		store.updateEvent('e1', { attendee_count: 5 } as Partial<Event>);
		expect((store.get('e1') as any).attendee_count).toBe(5);
		// untouched fields survive the merge
		expect(store.get('e1')?.host).toBeTruthy();
	});

	it('is a no-op for an unknown id', () => {
		const store = useEventStore();
		store.updateEvent('missing', { attendee_count: 9 } as Partial<Event>);
		expect(store.has('missing')).toBe(false);
	});
});

describe('event store random cache', () => {
	it('keys on count', () => {
		const store = useEventStore();
		store.setRandomCached(5, stubEvents('a', 'b'));
		store.setRandomCached(10, stubEvents('c'));
		expect(ids(store.getRandomCached(5))).toEqual(['a', 'b']);
		expect(ids(store.getRandomCached(10))).toEqual(['c']);
	});

	it('returns null for an uncached count', () => {
		const store = useEventStore();
		store.setRandomCached(5, stubEvents('a'));
		expect(store.getRandomCached(3)).toBeNull();
	});

	describe('ttl', () => {
		beforeEach(() => vi.useFakeTimers());
		afterEach(() => vi.useRealTimers());

		it('serves within the 5-minute window and expires past it', () => {
			const store = useEventStore();
			store.setRandomCached(5, stubEvents('fresh'));

			vi.advanceTimersByTime(4 * 60 * 1000);
			expect(ids(store.getRandomCached(5))).toEqual(['fresh']);

			vi.advanceTimersByTime(2 * 60 * 1000);
			expect(store.getRandomCached(5)).toBeNull();
		});
	});
});

describe('event store LRU eviction', () => {
	it('evicts the oldest entry once the cache reaches MAX_CACHE_SIZE on fetch', async () => {
		const store = useEventStore();
		// prefill exactly to the 100-entry cap
		const seed: Event[] = [];
		for (let i = 0; i < 100; i++) seed.push(makeEvent(`seed-${i}`));
		store.setEvents(seed);
		expect(store.cache.size).toBe(100);
		expect(store.has('seed-0')).toBe(true);

		// fetchEvent runs evictOldestIfNeeded before caching the new entry
		vi.mocked(makeAPIRequest).mockResolvedValue({
			success: true,
			data: makeEvent('new')
		} as any);
		await store.fetchEvent('new');

		// oldest insertion is gone, newest landed, size held at the cap
		expect(store.has('seed-0')).toBe(false);
		expect(store.has('new')).toBe(true);
		expect(store.cache.size).toBe(100);
	});

	it('drops companion caches for the evicted key', async () => {
		const store = useEventStore();
		const seed: Event[] = [];
		for (let i = 0; i < 100; i++) seed.push(makeEvent(`seed-${i}`));
		store.setEvents(seed);
		// attach satellite data to the soon-to-be-evicted oldest key
		store.attendeesCache.set('seed-0', [{ id: 'u' } as any]);
		store.submissionsCache.set('seed-0', [{ id: 's' } as any]);

		vi.mocked(makeAPIRequest).mockResolvedValue({
			success: true,
			data: makeEvent('new')
		} as any);
		await store.fetchEvent('new');

		expect(store.attendeesCache.has('seed-0')).toBe(false);
		expect(store.submissionsCache.has('seed-0')).toBe(false);
	});
});

describe('event store fetchEvent', () => {
	it('caches a valid payload', async () => {
		const store = useEventStore();
		vi.mocked(makeAPIRequest).mockResolvedValue({
			success: true,
			data: makeEvent('e1')
		} as any);

		const result = await store.fetchEvent('e1');
		expect(result?.id).toBe('e1');
		expect(store.get('e1')?.id).toBe('e1');
		expect(store.isLoading('e1')).toBe(false);
	});

	it('caches null on a malformed (host: []) payload and treats it as not-found', async () => {
		const store = useEventStore();
		vi.mocked(makeAPIRequest).mockResolvedValue({
			success: true,
			data: { id: 'e1', host: [] }
		} as any);

		const result = await store.fetchEvent('e1');
		expect(result).toBeNull();
		expect(store.has('e1')).toBe(true);
		expect(store.get('e1')).toBeNull();
	});

	it('caches null on a failed response', async () => {
		const store = useEventStore();
		vi.mocked(makeAPIRequest).mockResolvedValue({
			success: false,
			message: 'boom'
		} as any);

		const result = await store.fetchEvent('e1');
		expect(result).toBeNull();
		expect(store.get('e1')).toBeNull();
	});

	it('caches null when the request throws', async () => {
		const store = useEventStore();
		vi.mocked(makeAPIRequest).mockRejectedValue(new Error('network'));

		const result = await store.fetchEvent('e1');
		expect(result).toBeNull();
		expect(store.get('e1')).toBeNull();
		expect(store.isLoading('e1')).toBe(false);
	});

	it('returns null for an empty id without calling the network', async () => {
		const store = useEventStore();
		const result = await store.fetchEvent('');
		expect(result).toBeNull();
		expect(makeAPIRequest).not.toHaveBeenCalled();
	});

	it('serves a cached hit without re-fetching', async () => {
		const store = useEventStore();
		store.setEvents([makeEvent('e1')]);
		const result = await store.fetchEvent('e1');
		expect(result?.id).toBe('e1');
		expect(makeAPIRequest).not.toHaveBeenCalled();
	});

	it('refetches when force is true', async () => {
		const store = useEventStore();
		store.setEvents([makeEvent('e1')]);
		vi.mocked(makeAPIRequest).mockResolvedValue({
			success: true,
			data: makeEvent('e1', { attendee_count: 7 } as Partial<Event>)
		} as any);

		await store.fetchEvent('e1', true);
		expect(makeAPIRequest).toHaveBeenCalledTimes(1);
		expect((store.get('e1') as any).attendee_count).toBe(7);
	});

	it('dedupes concurrent fetches into one network call', async () => {
		const store = useEventStore();
		vi.mocked(makeAPIRequest).mockResolvedValue({
			success: true,
			data: makeEvent('e1')
		} as any);

		const [a, b] = await Promise.all([store.fetchEvent('e1'), store.fetchEvent('e1')]);
		expect(a?.id).toBe('e1');
		expect(b?.id).toBe('e1');
		expect(makeAPIRequest).toHaveBeenCalledTimes(1);
	});
});

describe('event store attendees / submissions fetch', () => {
	it('caches attendees from a valid paginated response', async () => {
		const store = useEventStore();
		vi.mocked(paginatedAPIRequest).mockResolvedValue({
			success: true,
			data: [{ id: 'u1' }, { id: 'u2' }]
		} as any);

		const res = await store.fetchAttendees('e1');
		expect(res.map((u: any) => u.id)).toEqual(['u1', 'u2']);
		expect(store.getAttendees('e1')?.length).toBe(2);
	});

	it('caches an empty attendee list on a failed response', async () => {
		const store = useEventStore();
		vi.mocked(paginatedAPIRequest).mockResolvedValue({
			success: false,
			message: 'nope'
		} as any);

		const res = await store.fetchAttendees('e1');
		expect(res).toEqual([]);
		expect(store.getAttendees('e1')).toEqual([]);
	});

	it('caches an empty attendee list when the request throws', async () => {
		const store = useEventStore();
		vi.mocked(paginatedAPIRequest).mockRejectedValue(new Error('x'));
		const res = await store.fetchAttendees('e1');
		expect(res).toEqual([]);
		expect(store.getAttendees('e1')).toEqual([]);
	});

	it('caches submissions from a valid response', async () => {
		const store = useEventStore();
		vi.mocked(paginatedAPIRequest).mockResolvedValue({
			success: true,
			data: [{ submission_id: 's1' }]
		} as any);

		const res = await store.fetchSubmissions('e1');
		expect(res.length).toBe(1);
		expect(store.getSubmissions('e1')?.length).toBe(1);
	});
});

describe('event store mutations via makeClientAPIRequest', () => {
	it('createEvent caches the returned event', async () => {
		const store = useEventStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue({
			success: true,
			data: makeEvent('created')
		} as any);

		await store.createEvent({ name: 'x' });
		expect(store.get('created')?.id).toBe('created');
	});

	it('patchEvent caches the updated event', async () => {
		const store = useEventStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue({
			success: true,
			data: makeEvent('p1', { attendee_count: 3 } as Partial<Event>)
		} as any);

		await store.patchEvent({ id: 'p1' });
		expect((store.get('p1') as any).attendee_count).toBe(3);
	});

	it('deleteEvent clears the cache entry on success', async () => {
		const store = useEventStore();
		store.setEvents([makeEvent('d1')]);
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true } as any);

		await store.deleteEvent('d1');
		expect(store.has('d1')).toBe(false);
	});

	it('deleteEvent leaves the cache untouched on failure', async () => {
		const store = useEventStore();
		store.setEvents([makeEvent('d1')]);
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: false } as any);

		await store.deleteEvent('d1');
		expect(store.has('d1')).toBe(true);
	});

	it('signUpForEvent increments attendee_count and invalidates the attendee list', async () => {
		const store = useEventStore();
		store.setEvents([makeEvent('s1', { attendee_count: 2 } as Partial<Event>)]);
		store.attendeesCache.set('s1', [{ id: 'u' } as any]);
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true } as any);

		await store.signUpForEvent('s1');
		expect((store.get('s1') as any).attendee_count).toBe(3);
		expect(store.getAttendees('s1')).toBeUndefined();
	});

	it('signUpForEvent treats a missing attendee_count as zero', async () => {
		const store = useEventStore();
		store.setEvents([makeEvent('s2')]);
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true } as any);

		await store.signUpForEvent('s2');
		expect((store.get('s2') as any).attendee_count).toBe(1);
	});

	it('leaveEvent decrements attendee_count and invalidates the attendee list', async () => {
		const store = useEventStore();
		store.setEvents([makeEvent('l1', { attendee_count: 2 } as Partial<Event>)]);
		store.attendeesCache.set('l1', [{ id: 'u' } as any]);
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true } as any);

		await store.leaveEvent('l1');
		expect((store.get('l1') as any).attendee_count).toBe(1);
		expect(store.getAttendees('l1')).toBeUndefined();
	});

	it('cancelEvent sets fields.cancelled true', async () => {
		const store = useEventStore();
		store.setEvents([makeEvent('c1', { fields: {} } as Partial<Event>)]);
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true } as any);

		await store.cancelEvent('c1');
		expect((store.get('c1') as any).fields.cancelled).toBe(true);
	});

	it('uncancelEvent sets fields.cancelled false', async () => {
		const store = useEventStore();
		store.setEvents([makeEvent('c1', { fields: { cancelled: true } } as Partial<Event>)]);
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true } as any);

		await store.uncancelEvent('c1');
		expect((store.get('c1') as any).fields.cancelled).toBe(false);
	});
});

describe('event store clear', () => {
	it('clears a single id and its satellite caches', () => {
		const store = useEventStore();
		store.setEvents([makeEvent('e1'), makeEvent('e2')]);
		store.attendeesCache.set('e1', [{ id: 'u' } as any]);
		store.submissionsCache.set('e1', [{ id: 's' } as any]);

		store.clear('e1');
		expect(store.has('e1')).toBe(false);
		expect(store.getAttendees('e1')).toBeUndefined();
		expect(store.getSubmissions('e1')).toBeUndefined();
		// other entries untouched
		expect(store.has('e2')).toBe(true);
	});

	it('clears everything when called with no id', () => {
		const store = useEventStore();
		store.setEvents([makeEvent('e1'), makeEvent('e2')]);
		store.clear();
		expect(store.cache.size).toBe(0);
	});
});
