import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from 'stores/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTrialCodes } from '~/composables/useSubscription';

// useTrialCodes relies on the auto-imported makeClientAPIRequest; mocking the
// resolved 'utils' module intercepts it the same as an explicit import.
vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return { ...actual, makeClientAPIRequest: vi.fn() };
});

import { makeClientAPIRequest } from 'utils';

const ok = <T>(data: T) => ({ success: true as const, data });
const fail = (message = 'boom', status?: number) => ({ success: false as const, message, status });

const code = (c: string, over: Record<string, unknown> = {}) =>
	({
		code: c,
		tier: 'pro',
		days: 30,
		max_redemptions: 0,
		redemptions: 0,
		expires_at: null,
		active: true,
		created_by: 1,
		created: '2026-07-13T00:00:00+00:00',
		...over
	}) as any;

describe('useTrialCodes', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
		useAuthStore().setSessionToken('token');
		// reset the module-level shared state between tests
		const api = useTrialCodes();
		api.codes.value = [];
		api.loading.value = false;
		api.error.value = null;
	});

	describe('fetchCodes', () => {
		it('loads the list from the { codes: [...] } envelope', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(
				ok({ codes: [code('EARTH-A'), code('EARTH-B')] })
			);
			const api = useTrialCodes();

			const res = await api.fetchCodes();

			expect(res.success).toBe(true);
			expect(api.codes.value.map((c) => c.code)).toEqual(['EARTH-A', 'EARTH-B']);
			expect(api.loading.value).toBe(false);
			expect(makeClientAPIRequest).toHaveBeenCalledWith('/v2/admin/trial-codes', 'token');
		});

		it('captures an error envelope on failure', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(fail('forbidden', 403));
			const api = useTrialCodes();

			const res = await api.fetchCodes();

			expect(res).toEqual({ success: false, error: 'forbidden' });
			expect(api.error.value).toBe('forbidden');
		});
	});

	describe('createCode', () => {
		it('posts a lowercased tier and prepends the created code', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(ok(code('EARTH-NEW')));
			const api = useTrialCodes();
			api.codes.value = [code('EARTH-OLD')];

			const res = await api.createCode({
				tier: 'PRO' as any,
				days: 30,
				max_redemptions: 100
			});

			expect(res.success).toBe(true);
			expect(api.codes.value.map((c) => c.code)).toEqual(['EARTH-NEW', 'EARTH-OLD']);
			const [path, token, opts] = (makeClientAPIRequest as any).mock.calls[0];
			expect(path).toBe('/v2/admin/trial-codes');
			expect(token).toBe('token');
			expect(opts.method).toBe('POST');
			expect(opts.body).toEqual({ tier: 'pro', days: 30, max_redemptions: 100 });
		});

		it('includes optional expires_at + custom code when provided', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(ok(code('CUSTOM-1')));
			const api = useTrialCodes();

			await api.createCode({
				tier: 'WRITER' as any,
				days: 7,
				expires_at: '2026-12-31T00:00:00+00:00',
				code: 'CUSTOM-1'
			});

			const opts = (makeClientAPIRequest as any).mock.calls[0][2];
			expect(opts.body.tier).toBe('writer');
			expect(opts.body.expires_at).toBe('2026-12-31T00:00:00+00:00');
			expect(opts.body.code).toBe('CUSTOM-1');
		});

		it('returns an error envelope when creation fails (409 duplicate code)', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(fail('code exists', 409));
			const api = useTrialCodes();

			const res = await api.createCode({ tier: 'PRO' as any, days: 30 });

			expect(res).toEqual({ success: false, error: 'code exists' });
			expect(api.error.value).toBe('code exists');
		});
	});

	describe('updateCode', () => {
		it('patches the matching code in place and lowercases a tier change', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(ok(code('EARTH-A', { active: false })));
			const api = useTrialCodes();
			api.codes.value = [code('EARTH-A'), code('EARTH-B')];

			const res = await api.updateCode('EARTH-A', { active: false, tier: 'ORGANIZER' as any });

			expect(res.success).toBe(true);
			expect(api.codes.value[0]!.active).toBe(false);
			expect(api.codes.value[1]!.code).toBe('EARTH-B'); // untouched
			const [path, , opts] = (makeClientAPIRequest as any).mock.calls[0];
			expect(path).toBe('/v2/admin/trial-codes/EARTH-A');
			expect(opts.method).toBe('PATCH');
			expect(opts.body.tier).toBe('organizer');
			expect(opts.body.active).toBe(false);
		});

		it('returns an error envelope when the code is unknown (404)', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(fail('unknown code', 404));
			const api = useTrialCodes();

			const res = await api.updateCode('NOPE', { active: false });

			expect(res).toEqual({ success: false, error: 'unknown code' });
		});
	});

	describe('deleteCode', () => {
		it('removes the code from the list on a 204 success', async () => {
			(makeClientAPIRequest as any).mockResolvedValue({ success: true });
			const api = useTrialCodes();
			api.codes.value = [code('EARTH-A'), code('EARTH-B')];

			const res = await api.deleteCode('EARTH-A');

			expect(res.success).toBe(true);
			expect(api.codes.value.map((c) => c.code)).toEqual(['EARTH-B']);
			const [path, , opts] = (makeClientAPIRequest as any).mock.calls[0];
			expect(path).toBe('/v2/admin/trial-codes/EARTH-A');
			expect(opts.method).toBe('DELETE');
		});

		it('keeps the list intact and returns an error envelope on failure', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(fail('forbidden', 403));
			const api = useTrialCodes();
			api.codes.value = [code('EARTH-A')];

			const res = await api.deleteCode('EARTH-A');

			expect(res).toEqual({ success: false, error: 'forbidden' });
			expect(api.codes.value.map((c) => c.code)).toEqual(['EARTH-A']);
		});

		it('surfaces a network failure as an error envelope', async () => {
			(makeClientAPIRequest as any).mockRejectedValue(new Error('timeout'));
			const api = useTrialCodes();
			api.codes.value = [code('EARTH-A')];

			const res = await api.deleteCode('EARTH-A');

			expect(res).toEqual({ success: false, error: 'timeout' });
		});
	});

	describe('fetchRedemptions', () => {
		it('loads the redemptions list for a code', async () => {
			const list = {
				redemptions: [
					{
						uid: 7,
						username: 'alice',
						redeemed_at: '2026-07-10T00:00:00+00:00',
						tier: 'pro',
						expires_at: '2026-08-09T00:00:00+00:00',
						active: true
					},
					{
						uid: 8,
						username: 'bob',
						redeemed_at: '2026-06-01T00:00:00+00:00',
						tier: null,
						expires_at: null,
						active: false
					}
				],
				active_count: 1,
				total_count: 2
			};
			(makeClientAPIRequest as any).mockResolvedValue(ok(list));
			const api = useTrialCodes();

			const res = await api.fetchRedemptions('EARTH-A');

			expect(res.success).toBe(true);
			expect(res.data?.active_count).toBe(1);
			expect(res.data?.total_count).toBe(2);
			expect(res.data?.redemptions.map((r) => r.username)).toEqual(['alice', 'bob']);
			expect(makeClientAPIRequest).toHaveBeenCalledWith(
				'/v2/admin/trial-codes/EARTH-A/redemptions',
				'token'
			);
		});

		it('returns an error envelope for an unknown code (404)', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(fail('unknown code', 404));
			const api = useTrialCodes();

			const res = await api.fetchRedemptions('NOPE');

			expect(res).toEqual({ success: false, error: 'unknown code' });
		});

		it('surfaces a network failure as an error envelope', async () => {
			(makeClientAPIRequest as any).mockRejectedValue(new Error('timeout'));
			const api = useTrialCodes();

			const res = await api.fetchRedemptions('EARTH-A');

			expect(res).toEqual({ success: false, error: 'timeout' });
		});
	});

	describe('notifyRedeemers', () => {
		it('posts the title + message and returns the notified count', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(ok({ notified: 3 }));
			const api = useTrialCodes();

			const res = await api.notifyRedeemers('EARTH-A', {
				title: 'Trial Ending',
				message: 'Your trial ends soon.'
			});

			expect(res.success).toBe(true);
			expect(res.data?.notified).toBe(3);
			const [path, token, opts] = (makeClientAPIRequest as any).mock.calls[0];
			expect(path).toBe('/v2/admin/trial-codes/EARTH-A/notify');
			expect(token).toBe('token');
			expect(opts.method).toBe('POST');
			expect(opts.body).toEqual({ title: 'Trial Ending', message: 'Your trial ends soon.' });
		});

		it('returns an error envelope when the body is rejected (400)', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(fail('title required', 400));
			const api = useTrialCodes();

			const res = await api.notifyRedeemers('EARTH-A', { title: '', message: 'x' });

			expect(res).toEqual({ success: false, error: 'title required' });
		});
	});
});
