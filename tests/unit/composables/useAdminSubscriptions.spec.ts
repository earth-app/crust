import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from 'stores/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdminSubscriptions } from '~/composables/useSubscription';

// useAdminSubscriptions relies on the auto-imported makeClientAPIRequest; mocking
// the resolved 'utils' module intercepts it the same as an explicit import.
vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return { ...actual, makeClientAPIRequest: vi.fn() };
});

import { makeClientAPIRequest } from 'utils';

const ok = <T>(data: T) => ({ success: true as const, data });
const fail = (message = 'boom', status?: number) => ({ success: false as const, message, status });

const statusShape = {
	tier: 'pro',
	status: 'active',
	provider: 'stripe',
	current_period_end: '2026-08-13T00:00:00+00:00',
	cancel_at_period_end: false,
	is_trial: false,
	trial_end: null,
	refund_eligible: true,
	refund_deadline: '2026-07-27T00:00:00+00:00',
	can_manage_billing: true
} as any;

const match = (id: number, over: Record<string, unknown> = {}) =>
	({
		id,
		username: `user${id}`,
		email: `user${id}@earth.app`,
		full_name: `User ${id}`,
		subscription: statusShape,
		...over
	}) as any;

describe('useAdminSubscriptions', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
		useAuthStore().setSessionToken('token');
		// reset the module-level shared state between tests
		const api = useAdminSubscriptions();
		api.matches.value = [];
		api.loading.value = false;
		api.submitting.value = false;
		api.error.value = null;
	});

	describe('lookupUsers', () => {
		it('loads matches from the { matches: [...] } envelope and encodes the query', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(ok({ matches: [match(1), match(2)] }));
			const api = useAdminSubscriptions();

			const res = await api.lookupUsers('john doe');

			expect(res.success).toBe(true);
			expect(api.matches.value.map((m) => m.id)).toEqual([1, 2]);
			expect(api.loading.value).toBe(false);
			expect(makeClientAPIRequest).toHaveBeenCalledWith(
				'/v2/admin/users/lookup?q=john%20doe',
				'token'
			);
		});

		it('short-circuits a too-short query without a network call', async () => {
			const api = useAdminSubscriptions();

			const res = await api.lookupUsers('a');

			expect(res.success).toBe(false);
			expect(makeClientAPIRequest).not.toHaveBeenCalled();
			expect(api.error.value).toContain('2 characters');
		});

		it('trims the query before the length check and request', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(ok({ matches: [match(5)] }));
			const api = useAdminSubscriptions();

			await api.lookupUsers('  bob  ');

			expect(makeClientAPIRequest).toHaveBeenCalledWith('/v2/admin/users/lookup?q=bob', 'token');
		});

		it('captures an error envelope on failure', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(fail('forbidden', 403));
			const api = useAdminSubscriptions();

			const res = await api.lookupUsers('john');

			expect(res).toEqual({ success: false, error: 'forbidden' });
			expect(api.error.value).toBe('forbidden');
		});

		it('surfaces a network failure as an error envelope', async () => {
			(makeClientAPIRequest as any).mockRejectedValue(new Error('timeout'));
			const api = useAdminSubscriptions();

			const res = await api.lookupUsers('john');

			expect(res).toEqual({ success: false, error: 'timeout' });
		});

		it('exposes loading true while the lookup is in flight and false after', async () => {
			let resolve!: (v: unknown) => void;
			(makeClientAPIRequest as any).mockReturnValue(
				new Promise((r) => {
					resolve = r;
				})
			);
			const api = useAdminSubscriptions();

			const p = api.lookupUsers('john');
			expect(api.loading.value).toBe(true);
			resolve(ok({ matches: [] }));
			await p;
			expect(api.loading.value).toBe(false);
		});
	});

	describe('refundUser', () => {
		it('posts to the refund endpoint and returns the cancel result', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(
				ok({ result: 'refunded', tier: 'free', message: 'Refunded $5.99.' })
			);
			const api = useAdminSubscriptions();

			const res = await api.refundUser(42, 'duplicate charge');

			expect(res.success).toBe(true);
			expect(res.data.result).toBe('refunded');
			const [path, token, opts] = (makeClientAPIRequest as any).mock.calls[0];
			expect(path).toBe('/v2/admin/users/42/refund');
			expect(token).toBe('token');
			expect(opts.method).toBe('POST');
			expect(opts.body).toEqual({ reason: 'duplicate charge' });
			expect(api.submitting.value).toBe(false);
		});

		it('omits an empty reason from the body', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(
				ok({ result: 'canceled', cancel_at_period_end: true, message: 'ok' })
			);
			const api = useAdminSubscriptions();

			await api.refundUser(7);

			const opts = (makeClientAPIRequest as any).mock.calls[0][2];
			expect(opts.body).toEqual({});
		});

		it('returns an error envelope when there is no sub (404)', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(fail('no subscription', 404));
			const api = useAdminSubscriptions();

			const res = await api.refundUser(99);

			expect(res).toEqual({ success: false, error: 'no subscription' });
			expect(api.submitting.value).toBe(false);
		});

		it('surfaces a network failure as an error envelope', async () => {
			(makeClientAPIRequest as any).mockRejectedValue(new Error('network down'));
			const api = useAdminSubscriptions();

			const res = await api.refundUser(1);

			expect(res).toEqual({ success: false, error: 'network down' });
		});

		it('exposes submitting true while the refund is in flight and false after', async () => {
			let resolve!: (v: unknown) => void;
			(makeClientAPIRequest as any).mockReturnValue(
				new Promise((r) => {
					resolve = r;
				})
			);
			const api = useAdminSubscriptions();

			const p = api.refundUser(42);
			expect(api.submitting.value).toBe(true);
			resolve(ok({ result: 'refunded', tier: 'free', message: 'ok' }));
			await p;
			expect(api.submitting.value).toBe(false);
		});
	});
});
