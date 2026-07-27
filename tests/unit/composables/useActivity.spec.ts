import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return {
		...actual,
		makeAPIRequest: vi.fn(),
		makeClientAPIRequest: vi.fn(),
		paginatedAPIRequest: vi.fn()
	};
});

import { makeAPIRequest, paginatedAPIRequest } from 'utils';
import { useActivities } from '~/composables/useActivity';

const apiMock = vi.mocked(makeAPIRequest);
const paginatedMock = vi.mocked(paginatedAPIRequest);

beforeEach(() => {
	setActivePinia(createPinia());
	apiMock.mockReset();
	paginatedMock.mockReset();
	apiMock.mockResolvedValue({ success: true, data: { items: [], total: 0 } });
	paginatedMock.mockResolvedValue({ success: true, data: [] });

	useAuthStore().sessionToken = 'session-token';
});

describe('useActivities alias-aware search', () => {
	it('asks mantle2 to match aliases by default (mantle2 defaults the flag off)', async () => {
		await useActivities().fetch(1, 25, 'jog');

		const [key, url, token] = apiMock.mock.calls[0]!;
		expect(url).toContain('search=jog');
		expect(url).toContain('include_aliases=true');
		expect(token).toBe('session-token');
		expect(key).toContain('-aliases');
	});

	it('drops the flag when a caller opts out per-call', async () => {
		await useActivities().fetch(1, 25, 'jog', 'desc', false);

		expect(apiMock.mock.calls[0]![1]).not.toContain('include_aliases');
	});

	it('partitions the request cache so the two variants never answer each other', async () => {
		const activities = useActivities();
		await activities.fetch(1, 25, 'jog');
		await activities.fetch(1, 25, 'jog', 'desc', false);

		const [aliasKey, aliasUrl] = apiMock.mock.calls[0]!;
		const [plainKey, plainUrl] = apiMock.mock.calls[1]!;
		expect(aliasKey).not.toBe(plainKey);
		expect(aliasUrl).not.toBe(plainUrl);
	});

	it('honors an opt-out set at construction for both fetch and fetchAll', async () => {
		const activities = useActivities(1, 25, '', 'desc', false);

		await activities.fetch(1, 25, 'jog');
		expect(apiMock.mock.calls[0]![1]).not.toContain('include_aliases');

		await activities.fetchAll(25, 'jog');
		expect(paginatedMock.mock.calls[0]![6]).toEqual({});
	});

	// the shape Discover.vue uses for the search-term populate pass
	it('sends the flag through the paginated helper used by discover', async () => {
		await useActivities().fetchAll(150, 'jog', 'desc');

		const [url, token, , limit, search, sort, query] = paginatedMock.mock.calls[0]!;
		expect(url).toBe('/v2/activities');
		expect(token).toBe('session-token');
		expect(limit).toBe(150);
		expect(search).toBe('jog');
		expect(sort).toBe('desc');
		expect(query).toEqual({ include_aliases: true });
	});

	it('lets fetchAll opt out per-call', async () => {
		await useActivities().fetchAll(150, 'jog', 'desc', false);

		expect(paginatedMock.mock.calls[0]![6]).toEqual({});
	});
});
