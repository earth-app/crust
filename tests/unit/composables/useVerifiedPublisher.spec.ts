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
import { useVerifiedPublisher } from '~/composables/useUser';
import { verifiedPublisherApplicationSchema } from '~/shared/utils/schemas';

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

describe('useVerifiedPublisher', () => {
	it('reads own status from the snake_case current-user sub-resource', async () => {
		await useVerifiedPublisher().status();

		const [url, token] = clientMock.mock.calls[0]!;
		// mantle2 routes are snake_case; a hyphen here 404s
		expect(url).toBe('/v2/users/current/verified_publisher');
		expect(token).toBe('session-token');
	});

	it('applies by POST to the same path', async () => {
		await useVerifiedPublisher().apply({ reason: 'we run a climbing chapter' });

		const [url, , options] = clientMock.mock.calls[0]!;
		expect(url).toBe('/v2/users/current/verified_publisher');
		expect(options?.method).toBe('POST');
		expect(options?.body).toEqual({ reason: 'we run a climbing chapter' });
	});

	it('lists applications from the admin surface, defaulting to pending', async () => {
		await useVerifiedPublisher().listApplications();

		expect(apiMock.mock.calls[0]![1]).toBe(
			'/v2/admin/verified_publishers?state=pending&page=1&limit=50'
		);
	});

	it('reviews by PATCH with the action in the body', async () => {
		await useVerifiedPublisher().review('42', 'revoke', 'spam');

		const [url, , options] = clientMock.mock.calls[0]!;
		expect(url).toBe('/v2/admin/verified_publishers/42');
		expect(options?.method).toBe('PATCH');
		expect(options?.body).toEqual({ action: 'revoke', notes: 'spam' });
	});
});

describe('verifiedPublisherApplicationSchema', () => {
	const valid = {
		organization: 'Example Org',
		website: 'https://example.org',
		reason: 'We have run a community climbing chapter for six years and publish trip guides.',
		activity_examples: 'bouldering, via ferrata',
		agrees_to_guidelines: true as const
	};

	it('accepts a complete application', () => {
		expect(verifiedPublisherApplicationSchema.safeParse(valid).success).toBe(true);
	});

	it('rejects a reason that is too short to review', () => {
		const result = verifiedPublisherApplicationSchema.safeParse({
			...valid,
			reason: 'too short'
		});
		expect(result.success).toBe(false);
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
});
