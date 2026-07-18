import { createPinia, setActivePinia } from 'pinia';
import { kudosKey, useCirclesStore } from 'stores/circles';
import type { CircleGarden, Expedition } from 'types/circles';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, nextTick } from 'vue';

// mantle2 is hit directly now (no crust Nitro proxy); stub only the wire helpers.
// invalidateAPICache is stubbed too so a forced refetch can be asserted to bust the
// shared util cache (dynamic per-user state must never serve a stale hit)
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

const ok = <T>(data: T) => ({ success: true as const, data });
const fail = (message = 'boom') => ({ success: false as const, message });

function expedition(partial: Partial<Expedition> = {}): Expedition {
	return {
		id: 'exp1',
		owner_uid: 'owner',
		title: 'Weekend Woods',
		goal: 'nature_minutes',
		target: 600,
		progress: 120,
		contributors: [],
		status: 'active',
		starts_at: new Date().toISOString(),
		ends_at: new Date(Date.now() + 604_800_000).toISOString(),
		...partial
	};
}

function garden(partial: Partial<CircleGarden> = {}): CircleGarden {
	return {
		owner_uid: 'o1',
		level: 3,
		total_minutes: 100,
		elements: [],
		animated: true,
		updated_at: new Date().toISOString(),
		...partial
	};
}

beforeEach(() => {
	setActivePinia(createPinia());
	vi.clearAllMocks();
});

describe('kudosKey', () => {
	it('builds a stable per-context key', () => {
		expect(kudosKey({ toUid: 'u1', contextType: 'quest', contextRef: 'q7' })).toBe('quest:q7:u1');
	});

	it('tolerates a missing context ref', () => {
		expect(kudosKey({ toUid: 'u1', contextType: 'expedition' })).toBe('expedition::u1');
	});
});

describe('circles store fetchExpedition', () => {
	it('stores and returns the active expedition from the mantle2 path', async () => {
		const store = useCirclesStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok(expedition()) as any);

		const res = await store.fetchExpedition();
		expect(res?.id).toBe('exp1');
		expect(store.expedition?.id).toBe('exp1');
		const url = vi.mocked(makeAPIRequest).mock.calls[0][1] as string;
		expect(url).toBe('/v2/users/current/expedition');
	});

	it('records a 404 no-expedition as null', async () => {
		const store = useCirclesStore();
		vi.mocked(makeAPIRequest).mockResolvedValue({ success: false, status: 404 } as any);

		const res = await store.fetchExpedition();
		expect(res).toBeNull();
		expect(store.expedition).toBeNull();
	});

	it('treats a 204 no-content as null too', async () => {
		const store = useCirclesStore();
		vi.mocked(makeAPIRequest).mockResolvedValue({ success: false, status: 204 } as any);

		const res = await store.fetchExpedition();
		expect(res).toBeNull();
		expect(store.expedition).toBeNull();
	});

	it('keeps the last-good expedition on a transient failure', async () => {
		const store = useCirclesStore();
		vi.mocked(makeAPIRequest).mockResolvedValueOnce(ok(expedition({ id: 'live' })) as any);
		await store.fetchExpedition();
		// a 5xx must not wipe the loaded expedition
		vi.mocked(makeAPIRequest).mockResolvedValueOnce({ success: false, status: 500 } as any);
		await store.fetchExpedition(true);
		expect(store.expedition?.id).toBe('live');
	});

	it('serves the cached value without re-fetching', async () => {
		const store = useCirclesStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok(expedition()) as any);

		await store.fetchExpedition();
		await store.fetchExpedition();
		expect(makeAPIRequest).toHaveBeenCalledTimes(1);
	});

	it('re-fetches when forced', async () => {
		const store = useCirclesStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok(expedition()) as any);

		await store.fetchExpedition();
		await store.fetchExpedition(true);
		expect(makeAPIRequest).toHaveBeenCalledTimes(2);
	});

	it('busts the shared util cache only on a forced refetch', async () => {
		const store = useCirclesStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok(expedition()) as any);

		await store.fetchExpedition();
		expect(invalidateAPICache).not.toHaveBeenCalled();

		await store.fetchExpedition(true);
		expect(invalidateAPICache).toHaveBeenCalledWith('circle-expedition');
	});
});

describe('circles store startExpedition', () => {
	it('sets the expedition on success and normalizes the body', async () => {
		const store = useCirclesStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue(ok(expedition({ id: 'new' })) as any);

		const res = await store.startExpedition({ title: 'T', goal: 'quests', target: 5.6 });
		expect(res.success).toBe(true);
		expect(store.expedition?.id).toBe('new');
		// mutation goes to mantle2 with a rounded, clamped target
		const [url, , opts] = vi.mocked(makeClientAPIRequest).mock.calls[0] as any;
		expect(url).toBe('/v2/users/current/expedition');
		expect(opts.method).toBe('POST');
		expect(opts.body.target).toBe(6);
	});

	it('leaves the expedition untouched on failure', async () => {
		const store = useCirclesStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue(fail() as any);

		const res = await store.startExpedition({ title: 'T', goal: 'quests', target: 5 });
		expect(res.success).toBe(false);
		expect(store.expedition).toBeUndefined();
	});
});

describe('circles store fetchGarden', () => {
	it('caches the garden per owner from the mantle2 path', async () => {
		const store = useCirclesStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok(garden()) as any);

		const res = await store.fetchGarden('o1');
		expect(res?.owner_uid).toBe('o1');
		expect(store.getGarden('o1')?.level).toBe(3);
		const url = vi.mocked(makeAPIRequest).mock.calls[0][1] as string;
		expect(url).toBe('/v2/users/o1/garden');

		await store.fetchGarden('o1');
		expect(makeAPIRequest).toHaveBeenCalledTimes(1);
	});

	it('caches null on a failed fetch', async () => {
		const store = useCirclesStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(fail() as any);

		const res = await store.fetchGarden('o2');
		expect(res).toBeNull();
		expect(store.getGarden('o2')).toBeNull();
	});

	it('short-circuits an empty owner without a network call', async () => {
		const store = useCirclesStore();
		const res = await store.fetchGarden('');
		expect(res).toBeNull();
		expect(makeAPIRequest).not.toHaveBeenCalled();
	});

	it('busts the per-owner util cache only on a forced refetch', async () => {
		const store = useCirclesStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok(garden()) as any);

		await store.fetchGarden('o1');
		expect(invalidateAPICache).not.toHaveBeenCalled();

		await store.fetchGarden('o1', true);
		expect(invalidateAPICache).toHaveBeenCalledWith('circle-garden-o1');
		expect(makeAPIRequest).toHaveBeenCalledTimes(2);
	});

	it('reports undefined for an unfetched owner and false loading', () => {
		const store = useCirclesStore();
		expect(store.getGarden('never')).toBeUndefined();
		expect(store.isGardenLoading('never')).toBe(false);
		expect(store.isGardenLoading('')).toBe(false);
	});
});

describe('circles store sendKudos', () => {
	const input = {
		toUid: 'friend',
		contextType: 'quest' as const,
		contextRef: 'q1',
		phrase: 'go_you' as const
	};

	it('sends and records the one-shot without exposing a tally', async () => {
		const store = useCirclesStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true } as any);

		const res = await store.sendKudos(input);
		expect(res).toEqual({ success: true, alreadySent: false });
		expect(store.hasSentKudos(input)).toBe(true);
		// mutation posts direct to the recipient's mantle2 kudos endpoint
		const url = vi.mocked(makeClientAPIRequest).mock.calls[0][0] as string;
		expect(url).toBe('/v2/users/friend/kudos');
	});

	it('treats a 409 as an already-sent success', async () => {
		const store = useCirclesStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: false, status: 409 } as any);

		const res = await store.sendKudos(input);
		expect(res).toEqual({ success: true, alreadySent: true });
		expect(store.hasSentKudos(input)).toBe(true);
	});

	it('short-circuits a locally-known duplicate without a network call', async () => {
		const store = useCirclesStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true } as any);

		await store.sendKudos(input);
		vi.mocked(makeClientAPIRequest).mockClear();
		const res = await store.sendKudos(input);
		expect(res).toEqual({ success: true, alreadySent: true });
		expect(makeClientAPIRequest).not.toHaveBeenCalled();
	});

	it('surfaces a failure and does not mark as sent', async () => {
		const store = useCirclesStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue(fail('nope') as any);

		const res = await store.sendKudos(input);
		expect(res.success).toBe(false);
		expect(store.hasSentKudos(input)).toBe(false);
	});
});

describe('circles store zod shape-guard (malformed data)', () => {
	it('caches a malformed expedition as null instead of storing the partial', async () => {
		const store = useCirclesStore();
		// missing target/progress/contributors -> would crash the ring segments if stored
		vi.mocked(makeAPIRequest).mockResolvedValue(
			ok({ id: 'e1', title: 'x', goal: 'nature_minutes' }) as any
		);
		const res = await store.fetchExpedition();
		expect(res).toBeNull();
		expect(store.expedition).toBeNull();
	});

	it('rejects an expedition with an unknown goal', async () => {
		const store = useCirclesStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok(expedition({ goal: 'walking' as any })) as any);
		const res = await store.fetchExpedition();
		expect(res).toBeNull();
	});

	it('rejects an expedition whose contributors is not an array', async () => {
		const store = useCirclesStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(
			ok(expedition({ contributors: 'nope' as any })) as any
		);
		const res = await store.fetchExpedition();
		expect(res).toBeNull();
	});

	it('startExpedition leaves state untouched when the server returns a malformed expedition', async () => {
		const store = useCirclesStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue(ok({ id: 'e1', title: 'x' }) as any);
		const res = await store.startExpedition({ title: 'T', goal: 'quests', target: 5 });
		// the request "succeeded" but the shape was bad -> no corrupt expedition
		expect(store.expedition).toBeUndefined();
		expect(res.success).toBe(true);
	});

	it('caches a valid garden but rejects a malformed one as null', async () => {
		const store = useCirclesStore();
		vi.mocked(makeAPIRequest).mockResolvedValueOnce(ok(garden()) as any);
		await store.fetchGarden('o1');
		expect(store.getGarden('o1')?.level).toBe(3);

		vi.mocked(makeAPIRequest).mockResolvedValueOnce(
			ok({ owner_uid: 'o2', level: 'high', elements: 'lots' }) as any
		);
		const res = await store.fetchGarden('o2');
		expect(res).toBeNull();
		expect(store.getGarden('o2')).toBeNull();
	});

	it('rejects a garden whose elements carry the wrong shape', async () => {
		const store = useCirclesStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(
			ok(garden({ owner_uid: 'o3', elements: [{ kind: 'tree' }] as any })) as any
		);
		const res = await store.fetchGarden('o3');
		expect(res).toBeNull();
	});
});

describe('circles store reactivity + envelope', () => {
	it('a computed over the expedition recomputes when it is fetched', async () => {
		const store = useCirclesStore();
		const title = computed(() => store.expedition?.title ?? '');
		expect(title.value).toBe('');
		vi.mocked(makeAPIRequest).mockResolvedValue(ok(expedition({ title: 'River Run' })) as any);
		await store.fetchExpedition();
		await nextTick();
		expect(title.value).toBe('River Run');
	});

	it('a computed over a per-owner garden recomputes on fetch', async () => {
		const store = useCirclesStore();
		const level = computed(() => store.getGarden('o1')?.level ?? 0);
		expect(level.value).toBe(0);
		vi.mocked(makeAPIRequest).mockResolvedValue(ok(garden({ level: 7 })) as any);
		await store.fetchGarden('o1');
		await nextTick();
		expect(level.value).toBe(7);
	});

	it('sendKudos surfaces a neutral {success,alreadySent} result on both paths', async () => {
		const store = useCirclesStore();
		const input = {
			toUid: 'friend',
			contextType: 'trail' as const,
			contextRef: 't9',
			phrase: 'inspiring' as const
		};
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true } as any);
		const first = await store.sendKudos(input);
		expect(first).toEqual({ success: true, alreadySent: false });

		// second call short-circuits locally as idempotent, never exposing a tally
		const second = await store.sendKudos(input);
		expect(second).toEqual({ success: true, alreadySent: true });
	});
});

describe('circles store clear', () => {
	it('resets expedition, gardens, and kudos state', async () => {
		const store = useCirclesStore();
		vi.mocked(makeAPIRequest).mockResolvedValue(ok(expedition()) as any);
		await store.fetchExpedition();
		store.clear();
		expect(store.expedition).toBeUndefined();
		expect(store.gardens.size).toBe(0);
		expect(store.kudosSent.size).toBe(0);
	});
});
