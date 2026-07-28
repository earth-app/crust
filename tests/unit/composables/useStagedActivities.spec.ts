import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return {
		...actual,
		makeAPIRequest: vi.fn(),
		makeClientAPIRequest: vi.fn()
	};
});

import { makeAPIRequest, makeClientAPIRequest } from 'utils';
import { useStagedActivities } from '~/composables/useActivity';

const apiMock = vi.mocked(makeAPIRequest);
const clientMock = vi.mocked(makeClientAPIRequest);

beforeEach(() => {
	setActivePinia(createPinia());
	apiMock.mockReset();
	clientMock.mockReset();
	apiMock.mockResolvedValue({ success: true, data: { items: [], total: 0 } });
	clientMock.mockResolvedValue({ success: true, data: {} });

	useAuthStore().sessionToken = 'session-token';
});

describe('useStagedActivities reads', () => {
	it('defaults the queue to pending and passes the session token', async () => {
		await useStagedActivities().list();

		const [, url, token] = apiMock.mock.calls[0]!;
		expect(url).toBe('/v2/activities/staged?state=pending&page=1&limit=50');
		expect(token).toBe('session-token');
	});

	it('reflects a non-default state and page in the url', async () => {
		await useStagedActivities().list('denied', 3, 10);

		expect(apiMock.mock.calls[0]![1]).toBe('/v2/activities/staged?state=denied&page=3&limit=10');
	});

	it('scopes the submitter view to the mine sub-resource', async () => {
		await useStagedActivities().mine();

		expect(apiMock.mock.calls[0]![1]).toBe('/v2/activities/staged/mine?page=1&limit=25');
	});

	it('uses the cacheable reader for lists, not the client writer', async () => {
		await useStagedActivities().list();

		expect(apiMock).toHaveBeenCalledTimes(1);
		expect(clientMock).not.toHaveBeenCalled();
	});
});

describe('useStagedActivities writes', () => {
	it('approves against the dedicated approve path, not a PATCH with an action body', async () => {
		await useStagedActivities().approve(12);

		const [url, token, options] = clientMock.mock.calls[0]!;
		expect(url).toBe('/v2/activities/staged/12/approve');
		expect(token).toBe('session-token');
		expect(options?.method).toBe('POST');
		expect(options?.body).toEqual({ notes: undefined, force: false });
	});

	it('forwards reviewer notes and the force escape hatch', async () => {
		await useStagedActivities().approve(12, 'looks good', true);

		expect(clientMock.mock.calls[0]![2]?.body).toEqual({ notes: 'looks good', force: true });
	});

	it('denies against the dedicated deny path', async () => {
		await useStagedActivities().deny(7, 'not an activity');

		const [url, , options] = clientMock.mock.calls[0]!;
		expect(url).toBe('/v2/activities/staged/7/deny');
		expect(options?.method).toBe('POST');
		expect(options?.body).toEqual({ notes: 'not an activity' });
	});

	it('submits a new staged activity by POST to the collection', async () => {
		await useStagedActivities().submit({ id: 'bouldering', name: 'Bouldering', note: 'ours' });

		const [url, , options] = clientMock.mock.calls[0]!;
		expect(url).toBe('/v2/activities/staged');
		expect(options?.method).toBe('POST');
		expect(options?.body).toMatchObject({ id: 'bouldering', note: 'ours' });
	});

	it('withdraws by DELETE on the row itself', async () => {
		await useStagedActivities().withdraw(4);

		const [url, , options] = clientMock.mock.calls[0]!;
		expect(url).toBe('/v2/activities/staged/4');
		expect(options?.method).toBe('DELETE');
	});

	it('uses the uncached client writer for every mutation', async () => {
		const staged = useStagedActivities();
		await staged.approve(1);
		await staged.deny(2);
		await staged.withdraw(3);

		expect(clientMock).toHaveBeenCalledTimes(3);
		expect(apiMock).not.toHaveBeenCalled();
	});
});
