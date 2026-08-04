import { createPinia, setActivePinia } from 'pinia';
import { useBackendStore } from 'stores/backend';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type RawReply = { status: number; _data?: unknown };

/** queue one reply per url fragment; anything unmatched rejects like a transport failure */
function stubFetch(replies: { info?: RawReply | Error; cloud?: RawReply | Error }) {
	const raw = vi.fn(async (url: string) => {
		const reply = url.includes('/v2/info') ? replies.info : replies.cloud;
		if (!reply) throw new Error('network');
		if (reply instanceof Error) throw reply;
		return reply;
	});

	const fetcher = Object.assign(vi.fn(), { raw });
	vi.stubGlobal('$fetch', fetcher);
	return raw;
}

function httpError(status: number) {
	return Object.assign(new Error(`HTTP ${status}`), { status });
}

function setOnline(online: boolean) {
	Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
}

beforeEach(() => {
	setActivePinia(createPinia());
	setOnline(true);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('preflight', () => {
	it('leaves the app open when mantle reports active', async () => {
		stubFetch({ info: { status: 200, _data: { status: 'active' } }, cloud: { status: 200 } });
		const store = useBackendStore();

		await store.preflight();

		expect(store.mantle).toBe('active');
		expect(store.cloud).toBe('up');
		expect(store.isBlocked).toBe(false);
		expect(store.isDegraded).toBe(false);
		expect(store.hasChecked).toBe(true);
	});

	it('blocks the app when mantle reports maintenance', async () => {
		stubFetch({ info: { status: 200, _data: { status: 'maintenance' } }, cloud: { status: 200 } });
		const store = useBackendStore();

		await store.preflight();

		expect(store.mantle).toBe('maintenance');
		expect(store.isBlocked).toBe(true);
	});

	it('blocks the app when mantle answers 5xx', async () => {
		stubFetch({ info: httpError(503), cloud: { status: 200 } });
		const store = useBackendStore();

		await store.preflight();

		expect(store.mantle).toBe('outage');
		expect(store.isBlocked).toBe(true);
	});

	it('treats an unreachable mantle as an outage while online', async () => {
		stubFetch({ info: new Error('connection refused'), cloud: { status: 200 } });
		const store = useBackendStore();

		await store.preflight();

		expect(store.mantle).toBe('outage');
	});

	// offline already has its own banner; two contradictory messages is worse than one
	it('does not call an unreachable mantle an outage while offline', async () => {
		setOnline(false);
		stubFetch({ info: new Error('connection refused'), cloud: { status: 200 } });
		const store = useBackendStore();

		await store.preflight();

		expect(store.mantle).toBe('unknown');
		expect(store.isBlocked).toBe(false);
	});

	it('degrades but never blocks when only cloud is down', async () => {
		stubFetch({ info: { status: 200, _data: { status: 'active' } }, cloud: httpError(500) });
		const store = useBackendStore();

		await store.preflight();

		expect(store.isDegraded).toBe(true);
		expect(store.isBlocked).toBe(false);
	});

	it('reports unknown, not down, when no cloud url is configured', async () => {
		const raw = stubFetch({
			info: { status: 200, _data: { status: 'active' } },
			cloud: { status: 200 }
		});
		const config = useRuntimeConfig();
		const original = config.public.cloudBaseUrl;
		config.public.cloudBaseUrl = '';

		const store = useBackendStore();
		await store.preflight();

		expect(store.cloud).toBe('unknown');
		expect(store.isDegraded).toBe(false);
		expect(raw).toHaveBeenCalledTimes(1); // info only; cloud was never asked
		config.public.cloudBaseUrl = original;
	});

	it('does not let a slow cloud stop mantle from answering', async () => {
		stubFetch({ info: { status: 200, _data: { status: 'active' } }, cloud: new Error('timeout') });
		const store = useBackendStore();

		await store.preflight();

		expect(store.mantle).toBe('active');
		expect(store.cloud).toBe('down');
	});

	it('checks once and reuses the answer', async () => {
		const raw = stubFetch({
			info: { status: 200, _data: { status: 'active' } },
			cloud: { status: 200 }
		});
		const store = useBackendStore();

		await store.preflight();
		await store.preflight();

		expect(raw).toHaveBeenCalledTimes(2); // one info + one cloud, not four
	});

	it('shares a single run between concurrent callers', async () => {
		const raw = stubFetch({
			info: { status: 200, _data: { status: 'active' } },
			cloud: { status: 200 }
		});
		const store = useBackendStore();

		await Promise.all([store.preflight(), store.preflight(), store.preflight()]);

		expect(raw).toHaveBeenCalledTimes(2);
	});

	it('re-checks when forced', async () => {
		const raw = stubFetch({
			info: { status: 200, _data: { status: 'active' } },
			cloud: { status: 200 }
		});
		const store = useBackendStore();

		await store.preflight();
		await store.preflight(true);

		expect(raw).toHaveBeenCalledTimes(4);
	});
});

describe('live request outcomes', () => {
	/* one failed create must not blank the app: a 5xx only asks /v2/info to re-check, and the
	   preflight decides. regression -- escalating directly broke two e2e specs that deliberately
	   force a failing POST and assert the form stays usable */
	it('does not blank the app on a single 5xx; it re-checks instead', async () => {
		const raw = stubFetch({
			info: { status: 200, _data: { status: 'active' } },
			cloud: { status: 200 }
		});
		const store = useBackendStore();

		store.reportFailure(502);
		await vi.waitFor(() => expect(raw).toHaveBeenCalled());

		expect(store.mantle).toBe('active');
		expect(store.isBlocked).toBe(false);
	});

	it('blocks when the confirmation check agrees the backend is down', async () => {
		const raw = stubFetch({ info: httpError(503), cloud: { status: 200 } });
		const store = useBackendStore();

		store.reportFailure(502);
		await vi.waitFor(() => expect(raw).toHaveBeenCalled());
		await vi.waitFor(() => expect(store.mantle).toBe('outage'));

		expect(store.isBlocked).toBe(true);
	});

	// a 401 or 404 is about that request, so it must not even cost a confirmation check
	it('ignores 4xx and 2xx entirely', () => {
		const raw = stubFetch({
			info: { status: 200, _data: { status: 'active' } },
			cloud: { status: 200 }
		});
		const store = useBackendStore();

		for (const status of [200, 401, 404, 429]) store.reportFailure(status);

		expect(raw).not.toHaveBeenCalled();
		expect(store.isBlocked).toBe(false);
	});

	it('lets a later preflight clear the outage it confirmed', async () => {
		stubFetch({ info: httpError(503), cloud: { status: 200 } });
		const store = useBackendStore();
		await store.preflight();
		expect(store.isBlocked).toBe(true);

		stubFetch({ info: { status: 200, _data: { status: 'active' } }, cloud: { status: 200 } });
		await store.preflight(true);

		expect(store.mantle).toBe('active');
		expect(store.isBlocked).toBe(false);
	});
});
