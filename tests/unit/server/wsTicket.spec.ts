import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CLOUD_BASE = 'https://cloud.test';

// the nuxt test env boots a real app during init; the runtime-config mock must include
// app.baseURL (read at boot) alongside the cloud base the handler consumes
mockNuxtImport('useRuntimeConfig', () => {
	return () => ({ app: { baseURL: '/' }, public: { cloudBaseUrl: CLOUD_BASE } }) as any;
});

const fetchMock = vi.fn();
let queryId: string | undefined;
let authHeader: string | undefined;

beforeEach(() => {
	queryId = '123';
	authHeader = 'Bearer real-token';
	fetchMock.mockReset();
	vi.stubGlobal('defineEventHandler', (fn: unknown) => fn);
	vi.stubGlobal('getQuery', () => ({ id: queryId }));
	vi.stubGlobal('getHeader', (_event: unknown, name: string) =>
		String(name).toLowerCase() === 'authorization' ? authHeader : undefined
	);
	vi.stubGlobal('createError', (input: { statusCode: number; statusMessage?: string }) =>
		Object.assign(new Error(input.statusMessage ?? 'error'), input)
	);
	vi.stubGlobal('$fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

// ofetch-style FetchError: status lives on both `response.status` and `statusCode`
const cloudError = (status: number, message = 'cloud error') =>
	Object.assign(new Error(message), {
		statusCode: status,
		response: { status }
	});

async function callWsTicket() {
	const handler = (await import('../../../src/server/api/user/wsTicket.get')).default as (
		event: unknown
	) => Promise<{ ticket: string; url: string }>;
	return handler({});
}

describe('GET /api/user/wsTicket', () => {
	it('rejects "Bearer null" with 401 without hitting cloud', async () => {
		authHeader = 'Bearer null';
		await expect(callWsTicket()).rejects.toMatchObject({ statusCode: 401 });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('rejects "Bearer undefined" with 401 without hitting cloud', async () => {
		authHeader = 'Bearer undefined';
		await expect(callWsTicket()).rejects.toMatchObject({ statusCode: 401 });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('rejects a missing authorization header with 401', async () => {
		authHeader = undefined;
		await expect(callWsTicket()).rejects.toMatchObject({ statusCode: 401 });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('forwards a valid bearer to cloud and returns the ticket + resolved ws url', async () => {
		fetchMock.mockResolvedValue({ ticket: 'tk-1' });

		const res = await callWsTicket();

		expect(res).toEqual({
			ticket: 'tk-1',
			url: 'wss://cloud.test/ws/users/123/notifications'
		});
		// forwarded the caller's bearer verbatim to the cloud ticket endpoint
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0]![0]).toBe(`${CLOUD_BASE}/ws/users/123/ticket`);
		expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBe('Bearer real-token');
	});

	it('surfaces a cloud 401 as 401, not a masked 502', async () => {
		fetchMock.mockRejectedValue(cloudError(401, 'Unauthorized'));
		await expect(callWsTicket()).rejects.toMatchObject({ statusCode: 401 });
	});

	it('maps a cloud 500 to a 502 gateway error', async () => {
		fetchMock.mockRejectedValue(cloudError(500, 'boom'));
		await expect(callWsTicket()).rejects.toMatchObject({ statusCode: 502 });
	});

	it('maps a network failure (no status) to a 502 gateway error', async () => {
		fetchMock.mockRejectedValue(new Error('network down'));
		await expect(callWsTicket()).rejects.toMatchObject({ statusCode: 502 });
	});

	it('rejects an invalid user id with 400 before auth or cloud', async () => {
		queryId = 'abc';
		await expect(callWsTicket()).rejects.toMatchObject({ statusCode: 400 });
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
