import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from 'stores/auth';
import { useEventStore } from 'stores/event';
import type { Event } from 'types/event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEvent, useEvents } from '~/composables/useEvents';

// makeClientAPIRequest backs fetchRandom (the recommend/similar pool source);
// makeAPIRequest backs the listing fetch + useEvent construction-time fetchEvent.
vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return { ...actual, makeAPIRequest: vi.fn(), makeClientAPIRequest: vi.fn() };
});

import { makeAPIRequest, makeClientAPIRequest } from 'utils';

// store's isValidEvent needs id + host.id
function event(id: string): Event {
	return { id, name: id, host: { id: `host-${id}` }, date: Date.now() } as unknown as Event;
}

const ok = <T>(data: T) => ({ success: true as const, data });
const fail = (message = 'boom') => ({ success: false as const, message });

describe('useEvents', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
		(makeAPIRequest as any).mockResolvedValue(fail('not loaded'));
	});

	const authed = () => {
		const authStore = useAuthStore();
		authStore.setSessionToken('token');
		authStore.currentUser = { id: 'u1' } as any;
	};

	describe('fetchRecommended', () => {
		it('short-circuits when unauthenticated', async () => {
			const { fetchRecommended } = useEvents();
			const res = await fetchRecommended(3);

			expect(res).toEqual({ success: false, message: 'User not authenticated' });
			expect(makeClientAPIRequest).not.toHaveBeenCalled();
		});

		it('uses the server result when upstream returns a non-empty list', async () => {
			authed();
			(makeClientAPIRequest as any).mockResolvedValue(ok([event('p1'), event('p2')]));
			const serverRequest = vi.fn().mockResolvedValue(ok([event('s1'), event('s2')]));

			const { fetchRecommended } = useEvents(serverRequest as any);
			const res = await fetchRecommended(2);

			expect(res.success).toBe(true);
			expect((res as any).data.map((e: Event) => e.id)).toEqual(['s1', 's2']);
		});

		it('falls back to the random pool when the server returns empty', async () => {
			authed();
			(makeClientAPIRequest as any).mockResolvedValue(ok([event('p1'), event('p2'), event('p3')]));
			const serverRequest = vi.fn().mockResolvedValue(ok([] as Event[]));

			const { fetchRecommended } = useEvents(serverRequest as any);
			const res = await fetchRecommended(2);

			expect(res.success).toBe(true);
			expect((res as any).data.length).toBe(2);
		});

		it('falls back to the random pool when the server fails', async () => {
			authed();
			(makeClientAPIRequest as any).mockResolvedValue(ok([event('p1'), event('p2')]));
			const serverRequest = vi.fn().mockResolvedValue(fail());

			const { fetchRecommended } = useEvents(serverRequest as any);
			const res = await fetchRecommended(5);

			expect(res.success).toBe(true);
			expect((res as any).data.map((e: Event) => e.id).sort()).toEqual(['p1', 'p2']);
		});

		it('returns empty data when the random pool is empty', async () => {
			authed();
			(makeClientAPIRequest as any).mockResolvedValue(ok([] as Event[]));
			const serverRequest = vi.fn();

			const { fetchRecommended } = useEvents(serverRequest as any);
			const res = await fetchRecommended(3);

			expect(res).toEqual({ success: true, data: [], message: '' });
			expect(serverRequest).not.toHaveBeenCalled();
		});
	});

	describe('fetch (upcoming filter)', () => {
		it('filters out past events when upcoming=true', async () => {
			const past = { ...event('past'), date: Date.now() - 86_400_000 };
			const future = { ...event('future'), date: Date.now() + 86_400_000 };
			(makeAPIRequest as any).mockResolvedValue(
				ok({ items: [past, future], page: 1, limit: 50, total: 2 })
			);

			const { fetch } = useEvents();
			const res = await fetch(1, 50, '', true);

			expect(res.items.map((e: Event) => e.id)).toEqual(['future']);
			// total is preserved from the raw response, not the filtered length
			expect(res.total).toBe(2);
		});

		it('returns the raw page when upcoming=false', async () => {
			const past = { ...event('past'), date: Date.now() - 86_400_000 };
			const future = { ...event('future'), date: Date.now() + 86_400_000 };
			(makeAPIRequest as any).mockResolvedValue(
				ok({ items: [past, future], page: 1, limit: 50, total: 2 })
			);

			const { fetch } = useEvents();
			const res = await fetch(1, 50, '', false);

			expect(res.items.map((e: Event) => e.id)).toEqual(['past', 'future']);
		});

		it('degrades to an empty page when the request fails', async () => {
			(makeAPIRequest as any).mockResolvedValue(fail());

			const { fetch } = useEvents();
			const res = await fetch(2, 10);

			expect(res).toEqual({ items: [], total: 0, page: 2, limit: 10 });
		});
	});
});

describe('useEvent fetchSimilar', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
		(makeAPIRequest as any).mockResolvedValue(fail('not loaded'));
	});

	const seed = (...evs: Event[]) => useEventStore().setEvents(evs);

	it('uses the server result when upstream returns a non-empty list', async () => {
		seed(event('current'));
		(makeClientAPIRequest as any).mockResolvedValue(ok([event('p1'), event('p2')]));
		const serverRequest = vi.fn().mockResolvedValue(ok([event('s1')]));

		const { fetchSimilar } = useEvent('current', serverRequest as any);
		const res = await fetchSimilar(5);

		expect((res as any).data.map((e: Event) => e.id)).toEqual(['s1']);
	});

	it('excludes the current event and falls back when the server fails', async () => {
		seed(event('current'));
		(makeClientAPIRequest as any).mockResolvedValue(
			ok([event('current'), event('p1'), event('p2')])
		);
		const serverRequest = vi.fn().mockResolvedValue(fail());

		const { fetchSimilar } = useEvent('current', serverRequest as any);
		const res = await fetchSimilar(10);

		expect(res.success).toBe(true);
		expect((res as any).data.map((e: Event) => e.id)).not.toContain('current');
		expect((res as any).data.map((e: Event) => e.id).sort()).toEqual(['p1', 'p2']);
	});

	it('slices the fallback to the requested count', async () => {
		seed(event('current'));
		const pool = Array.from({ length: 9 }, (_, i) => event(`p${i}`));
		(makeClientAPIRequest as any).mockResolvedValue(ok(pool));
		const serverRequest = vi.fn().mockResolvedValue(fail());

		const { fetchSimilar } = useEvent('current', serverRequest as any);
		const res = await fetchSimilar(3);

		expect((res as any).data.length).toBe(3);
	});

	it('returns empty data when the random pool is empty', async () => {
		seed(event('current'));
		(makeClientAPIRequest as any).mockResolvedValue(ok([] as Event[]));
		const serverRequest = vi.fn();

		const { fetchSimilar } = useEvent('current', serverRequest as any);
		const res = await fetchSimilar(5);

		expect(res).toEqual({ success: true, data: [], message: '' });
	});
});
