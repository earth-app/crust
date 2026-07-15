import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from 'stores/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSubscription } from '~/composables/useSubscription';

// useSubscription relies on the auto-imported makeClientAPIRequest; mocking the
// resolved 'utils' module intercepts it the same as an explicit import.
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

const planShape = {
	tier: 'pro',
	name: 'Pro',
	price_cents: 599,
	price_display: '$5.99/mo',
	currency: 'usd',
	interval: 'month'
} as any;

describe('useSubscription', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
		useAuthStore().setSessionToken('token');
		// reset the module-level shared state between tests
		const api = useSubscription();
		api.status.value = null;
		api.plans.value = [];
		api.loading.value = false;
		api.submitting.value = false;
	});

	describe('fetchPlans', () => {
		it('loads the plans array and unwraps the envelope', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(
				ok({ plans: [planShape], refund_window_days: 14 })
			);
			const api = useSubscription();

			const res = await api.fetchPlans();

			expect(res.success).toBe(true);
			expect(res.data).toHaveLength(1);
			expect(api.plans.value[0]!.tier).toBe('pro');
			expect(api.loading.value).toBe(false);
			// plans endpoint is public - called without a token
			expect(makeClientAPIRequest).toHaveBeenCalledWith('/v2/subscriptions/plans');
		});

		it('returns an error envelope on failure', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(fail('unavailable'));
			const api = useSubscription();

			const res = await api.fetchPlans();

			expect(res).toEqual({ success: false, error: 'unavailable' });
		});
	});

	describe('fetchStatus', () => {
		it('loads and caches the current status', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(ok(statusShape));
			const api = useSubscription();

			const res = await api.fetchStatus();

			expect(res.success).toBe(true);
			expect(api.status.value?.status).toBe('active');
			expect(makeClientAPIRequest).toHaveBeenCalledWith('/v2/users/current/subscription', 'token');
		});

		it('captures an error envelope on failure', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(fail('nope'));
			const api = useSubscription();

			const res = await api.fetchStatus();

			expect(res).toEqual({ success: false, error: 'nope' });
			expect(api.status.value).toBeNull();
		});
	});

	describe('startCheckout', () => {
		it('posts a lowercased tier + consent + return urls and returns the session', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(
				ok({ url: 'https://checkout.stripe.com/x', session_id: 'cs_1' })
			);
			const api = useSubscription();

			const res = await api.startCheckout('PRO' as any, true);

			expect(res.success).toBe(true);
			expect(res.data?.url).toBe('https://checkout.stripe.com/x');
			const [path, token, opts] = (makeClientAPIRequest as any).mock.calls[0];
			expect(path).toBe('/v2/users/current/subscription/checkout');
			expect(token).toBe('token');
			expect(opts.method).toBe('POST');
			expect(opts.body.tier).toBe('pro');
			expect(opts.body.consent).toBe(true);
			expect(opts.body.success_url).toContain('/subscription/success');
			expect(opts.body.cancel_url).toContain('/subscription/cancel');
			expect(api.submitting.value).toBe(false);
		});

		it('maps a 402 payment failure to an error envelope', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(fail('card declined', 402));
			const api = useSubscription();

			const res = await api.startCheckout('WRITER' as any, true);

			expect(res).toEqual({ success: false, error: 'card declined' });
		});

		it('maps a 409 already-active conflict to an error envelope', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(fail('already subscribed', 409));
			const api = useSubscription();

			const res = await api.startCheckout('PRO' as any, true);

			expect(res).toEqual({ success: false, error: 'already subscribed' });
		});

		it('surfaces a network failure as an error envelope', async () => {
			(makeClientAPIRequest as any).mockRejectedValue(new Error('network down'));
			const api = useSubscription();

			const res = await api.startCheckout('PRO' as any, true);

			expect(res).toEqual({ success: false, error: 'network down' });
			expect(api.submitting.value).toBe(false);
		});
	});

	describe('openPortal', () => {
		it('returns the portal url', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(ok({ url: 'https://billing.stripe.com/p' }));
			const api = useSubscription();

			const res = await api.openPortal();

			expect(res.success).toBe(true);
			expect(res.data?.url).toBe('https://billing.stripe.com/p');
		});

		it('returns an error envelope when the portal is unconfigured', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(fail('billing is not configured', 503));
			const api = useSubscription();

			const res = await api.openPortal();

			expect(res).toEqual({ success: false, error: 'billing is not configured' });
		});
	});

	describe('cancel', () => {
		it('cancels then refreshes status', async () => {
			(makeClientAPIRequest as any).mockImplementation((_path: string, _t: unknown, opts: any) => {
				if (opts?.method === 'POST') {
					return Promise.resolve(
						ok({ result: 'canceled', cancel_at_period_end: true, tier: 'pro', message: 'ok' })
					);
				}
				// trailing fetchStatus() refresh
				return Promise.resolve(ok({ ...statusShape, cancel_at_period_end: true }));
			});
			const api = useSubscription();

			const res = await api.cancel();

			expect(res.success).toBe(true);
			expect(res.data.result).toBe('canceled');
			expect(api.status.value?.cancel_at_period_end).toBe(true);
		});

		it('returns an error envelope when there is no active sub (404)', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(fail('no active subscription', 404));
			const api = useSubscription();

			const res = await api.cancel();

			expect(res).toEqual({ success: false, error: 'no active subscription' });
		});
	});

	describe('redeemCode', () => {
		it('redeems a code then refreshes status', async () => {
			(makeClientAPIRequest as any).mockImplementation((_path: string, _t: unknown, opts: any) => {
				if (opts?.method === 'POST') {
					return Promise.resolve(
						ok({ tier: 'pro', days: 30, trial_end: '2026-08-12T00:00:00+00:00', message: 'ok' })
					);
				}
				return Promise.resolve(ok({ ...statusShape, status: 'trialing', is_trial: true }));
			});
			const api = useSubscription();

			const res = await api.redeemCode('EARTH-ABCD-1234');

			expect(res.success).toBe(true);
			expect(res.data.days).toBe(30);
			expect(api.status.value?.is_trial).toBe(true);
			const [path, , opts] = (makeClientAPIRequest as any).mock.calls[0];
			expect(path).toBe('/v2/users/current/subscription/redeem-code');
			expect(opts.body.code).toBe('EARTH-ABCD-1234');
		});

		it('returns an error envelope for an unredeemable code (409)', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(fail('code already redeemed', 409));
			const api = useSubscription();

			const res = await api.redeemCode('EARTH-DEAD-BEEF');

			expect(res).toEqual({ success: false, error: 'code already redeemed' });
		});
	});
});
