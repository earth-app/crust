import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '~/shared/types/user';
import { isVerifiedOwner } from '~/shared/types/user';
import { verifiedPublisherApplicationSchema } from '~/shared/utils/schemas';

vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return { ...actual, makeAPIRequest: vi.fn(), makeClientAPIRequest: vi.fn() };
});

import { makeAPIRequest, makeClientAPIRequest } from 'utils';
import { useStagedActivities } from '~/composables/useActivity';
import { useVerifiedPublisher } from '~/composables/useUser';

const apiMock = vi.mocked(makeAPIRequest);
const clientMock = vi.mocked(makeClientAPIRequest);

beforeEach(() => {
	setActivePinia(createPinia());
	apiMock.mockReset();
	clientMock.mockReset();
	apiMock.mockResolvedValue({ success: true, data: { items: [], page: 1, limit: 50, total: 0 } });
	clientMock.mockResolvedValue({ success: true, data: {} });

	const authStore = useAuthStore();
	authStore.sessionToken = 'session-token';
});

describe('useStagedActivities', () => {
	it('reads the pending queue through the cacheable request helper', async () => {
		await useStagedActivities().list();

		const [key, url, token] = apiMock.mock.calls[0];
		expect(key).toBeNull();
		expect(url).toBe('/v2/activities/staged?state=pending&page=1&limit=50');
		expect(token).toBe('session-token');
	});

	it('reflects a non-default state and page in the url', async () => {
		await useStagedActivities().list('denied', 3, 10);

		expect(apiMock.mock.calls[0][1]).toBe('/v2/activities/staged?state=denied&page=3&limit=10');
	});

	it('reads the caller own submissions from the mine route', async () => {
		await useStagedActivities().mine();

		expect(apiMock.mock.calls[0][1]).toContain('/v2/activities/staged/mine');
	});

	it('submits through the uncached helper', async () => {
		await useStagedActivities().submit({ id: 'bouldering', name: 'Bouldering' });

		const [url, token, options] = clientMock.mock.calls[0];
		expect(url).toBe('/v2/activities/staged');
		expect(token).toBe('session-token');
		expect(options?.method).toBe('POST');
		expect(options?.body).toMatchObject({ id: 'bouldering' });
		expect(apiMock).not.toHaveBeenCalled();
	});

	it('approves and denies on separate paths rather than one action body', async () => {
		await useStagedActivities().approve(12, 'great');
		expect(clientMock.mock.calls[0][0]).toBe('/v2/activities/staged/12/approve');
		expect(clientMock.mock.calls[0][2]?.body).toEqual({ notes: 'great', force: false });

		clientMock.mockClear();
		await useStagedActivities().deny(12, 'nope');
		expect(clientMock.mock.calls[0][0]).toBe('/v2/activities/staged/12/deny');
		expect(clientMock.mock.calls[0][2]?.body).toEqual({ notes: 'nope' });
	});

	it('passes force through on approve', async () => {
		await useStagedActivities().approve(12, undefined, true);

		expect(clientMock.mock.calls[0][2]?.body).toMatchObject({ force: true });
	});

	it('withdraws with a DELETE', async () => {
		await useStagedActivities().withdraw(5);

		expect(clientMock.mock.calls[0][0]).toBe('/v2/activities/staged/5');
		expect(clientMock.mock.calls[0][1 + 1]?.method).toBe('DELETE');
	});
});

describe('useVerifiedPublisher', () => {
	it('reads and submits the caller own application on the snake_case path', async () => {
		await useVerifiedPublisher().status();
		expect(clientMock.mock.calls[0][0]).toBe('/v2/users/current/verified_publisher');

		clientMock.mockClear();
		await useVerifiedPublisher().apply({ reason: 'because', organization: 'Org' });
		expect(clientMock.mock.calls[0][0]).toBe('/v2/users/current/verified_publisher');
		expect(clientMock.mock.calls[0][2]?.method).toBe('POST');
		expect(clientMock.mock.calls[0][2]?.body).toMatchObject({ reason: 'because' });
	});

	it('lists applications for admins and patches a decision', async () => {
		await useVerifiedPublisher().listApplications('approved', 2, 10);
		expect(apiMock.mock.calls[0][1]).toBe(
			'/v2/admin/verified_publishers?state=approved&page=2&limit=10'
		);

		await useVerifiedPublisher().review('42', 'revoke', 'policy');
		expect(clientMock.mock.calls[0][0]).toBe('/v2/admin/verified_publishers/42');
		expect(clientMock.mock.calls[0][2]?.method).toBe('PATCH');
		expect(clientMock.mock.calls[0][2]?.body).toEqual({ action: 'revoke', notes: 'policy' });
	});
});

describe('verifiedPublisherApplicationSchema', () => {
	const valid = {
		organization: 'Bay Area Climbing Collective',
		website: 'https://example.org',
		reason: 'We run a 400 member climbing chapter and want to publish our trip activities.',
		activity_examples: 'bouldering, via ferrata',
		agrees_to_guidelines: true
	};

	it('accepts a complete application', () => {
		expect(verifiedPublisherApplicationSchema.safeParse(valid).success).toBe(true);
	});

	it('rejects a reason under forty characters', () => {
		const result = verifiedPublisherApplicationSchema.safeParse({
			...valid,
			reason: 'a'.repeat(39)
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues[0].message).toContain('at least 40 characters');
	});

	it('rejects a malformed website but allows an empty one', () => {
		expect(
			verifiedPublisherApplicationSchema.safeParse({ ...valid, website: 'notaurl' }).success
		).toBe(false);
		expect(verifiedPublisherApplicationSchema.safeParse({ ...valid, website: '' }).success).toBe(
			true
		);
	});

	it('requires the guidelines checkbox', () => {
		expect(
			verifiedPublisherApplicationSchema.safeParse({ ...valid, agrees_to_guidelines: false })
				.success
		).toBe(false);
	});

	it('requires at least one example activity', () => {
		expect(
			verifiedPublisherApplicationSchema.safeParse({ ...valid, activity_examples: '' }).success
		).toBe(false);
	});
});

describe('isVerifiedOwner', () => {
	const owner = (over: Partial<User>) => over as Partial<User>;

	it('is true for administrators', () => {
		expect(isVerifiedOwner(owner({ is_admin: true }))).toBe(true);
	});

	it('is true only when the publisher flag is granted', () => {
		expect(
			isVerifiedOwner(owner({ verified_publisher: { state: 'approved', verified: true } }))
		).toBe(true);
		expect(
			isVerifiedOwner(owner({ verified_publisher: { state: 'pending', verified: false } }))
		).toBe(false);
	});

	// paying for the Organizer tier is no longer verification
	it('is false for an unverified Organizer', () => {
		expect(isVerifiedOwner(owner({ account: { account_type: 'ORGANIZER' } as never }))).toBe(false);
	});

	it('tolerates null and undefined', () => {
		expect(isVerifiedOwner(null)).toBe(false);
		expect(isVerifiedOwner(undefined)).toBe(false);
	});
});
