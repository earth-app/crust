import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from 'stores/auth';
import { useTrailmarkStore } from 'stores/trailmark';
import type { Trailmark } from 'types/trailmarks';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trailmarkDistanceMeters, useTrailmarks } from '~/composables/useTrailmarks';

vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return {
		...actual,
		makeAPIRequest: vi.fn(),
		makeClientAPIRequest: vi.fn()
	};
});

import { makeAPIRequest, makeClientAPIRequest } from 'utils';

function mark(id: string, lat: number, lng: number): Trailmark {
	return {
		id,
		author_uid: 'author',
		author_username: 'walker',
		geo: { lat, lng },
		note: `note ${id}`,
		created_at: new Date().toISOString()
	} as Trailmark;
}

const ok = <T>(data: T) => ({ success: true as const, data });

beforeEach(() => {
	setActivePinia(createPinia());
	vi.clearAllMocks();
	useAuthStore().setSessionToken('token');
});

describe('trailmarkDistanceMeters', () => {
	it('is zero for the same point', () => {
		expect(trailmarkDistanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 0 })).toBe(0);
	});

	it('measures ~111m per 0.001 degree of longitude at the equator', () => {
		const d = trailmarkDistanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 0.001 });
		expect(d).toBeGreaterThan(100);
		expect(d).toBeLessThan(120);
	});
});

describe('useTrailmarks.fetchNearby', () => {
	it('rejects an invalid origin without hitting the network', async () => {
		const { fetchNearby } = useTrailmarks();
		const res = await fetchNearby({ lat: NaN, lng: 0 });
		expect(res.success).toBe(false);
		expect(makeAPIRequest).not.toHaveBeenCalled();
	});

	it('orders results nearest-first from the origin', async () => {
		vi.mocked(makeAPIRequest).mockResolvedValue(
			ok([mark('far', 0, 0.02), mark('near', 0, 0.001)]) as any
		);
		const { fetchNearby, nearby } = useTrailmarks();
		const res = await fetchNearby({ lat: 0, lng: 0 });
		expect(res.success).toBe(true);
		expect(nearby.value.map((m) => m.id)).toEqual(['near', 'far']);
	});
});

describe('useTrailmarks.leaveNote', () => {
	it('rejects an empty note', async () => {
		const { leaveNote } = useTrailmarks();
		const res = await leaveNote({ geo: { lat: 1, lng: 2 }, note: '   ' });
		expect(res.success).toBe(false);
		expect(makeClientAPIRequest).not.toHaveBeenCalled();
	});

	it('rejects a note over the length cap', async () => {
		const { leaveNote, maxNote } = useTrailmarks();
		const res = await leaveNote({ geo: { lat: 1, lng: 2 }, note: 'x'.repeat(maxNote + 1) });
		expect(res.success).toBe(false);
	});

	it('rejects a missing location', async () => {
		const { leaveNote } = useTrailmarks();
		const res = await leaveNote({ geo: { lat: NaN, lng: 2 }, note: 'hello' });
		expect(res.success).toBe(false);
	});

	it('posts a valid note and surfaces it at the top of nearby', async () => {
		vi.mocked(makeClientAPIRequest).mockResolvedValue(ok(mark('fresh', 1, 2)) as any);
		const { leaveNote, nearby } = useTrailmarks();
		const res = await leaveNote({ geo: { lat: 1, lng: 2 }, note: 'hello' });
		expect(res.success).toBe(true);
		expect(nearby.value[0]?.id).toBe('fresh');
	});
});

describe('useTrailmarks.thank', () => {
	it('rejects a missing id', async () => {
		const { thank } = useTrailmarks();
		const res = await thank('');
		expect(res.success).toBe(false);
	});

	it('delegates a thank and reports already-thanked on a 409', async () => {
		const store = useTrailmarkStore();
		store.upsert(mark('m1', 1, 2));
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: false, status: 409 } as any);
		const { thank, hasThanked } = useTrailmarks();
		const res = await thank('m1');
		expect(res.success).toBe(true);
		expect(res.alreadyThanked).toBe(true);
		expect(hasThanked('m1')).toBe(true);
	});
});
