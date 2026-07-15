import { useAuthStore } from 'stores/auth';
import type {
	CheckoutSession,
	PortalSession,
	SubResult,
	SubscriptionPlan,
	SubscriptionStatus
} from 'types/subscription';
import type { AccountType } from 'types/user';

// #region subscriptions

const statusState = ref<SubscriptionStatus | null>(null);
const plansState = ref<SubscriptionPlan[]>([]);
const loadingState = ref(false);
const submittingState = ref(false);

function origin(): string {
	return typeof window !== 'undefined' ? window.location.origin : '';
}

export function useSubscription() {
	const authStore = useAuthStore();

	const fetchPlans = async (): Promise<SubResult<SubscriptionPlan[]>> => {
		loadingState.value = true;
		try {
			const res = await makeClientAPIRequest<{
				plans: SubscriptionPlan[];
				refund_window_days: number;
			}>('/v2/subscriptions/plans');
			if (!res.success || !res.data) {
				throw new Error(res.message || 'Failed to load subscription plans');
			}
			plansState.value = res.data.plans ?? [];
			return { success: true, data: plansState.value };
		} catch (e: any) {
			return { success: false, error: e?.message || 'Failed to load subscription plans' };
		} finally {
			loadingState.value = false;
		}
	};

	const fetchStatus = async (): Promise<SubResult<SubscriptionStatus>> => {
		loadingState.value = true;
		try {
			const res = await makeClientAPIRequest<SubscriptionStatus>(
				'/v2/users/current/subscription',
				authStore.sessionToken
			);
			if (!res.success || !res.data) {
				throw new Error(res.message || 'Failed to load subscription status');
			}
			statusState.value = res.data;
			return { success: true, data: res.data };
		} catch (e: any) {
			return { success: false, error: e?.message || 'Failed to load subscription status' };
		} finally {
			loadingState.value = false;
		}
	};

	const startCheckout = async (
		tier: AccountType,
		consent: boolean
	): Promise<SubResult<CheckoutSession>> => {
		submittingState.value = true;
		try {
			const res = await makeClientAPIRequest<CheckoutSession>(
				'/v2/users/current/subscription/checkout',
				authStore.sessionToken,
				{
					method: 'POST',
					body: {
						// backend expects lowercase tier (mirror stores/user.ts setAccountType)
						tier: String(tier).toLowerCase(),
						consent,
						success_url: `${origin()}/subscription/success`,
						cancel_url: `${origin()}/subscription/cancel`
					}
				}
			);
			if (!res.success || !res.data) {
				throw new Error(res.message || 'Failed to start checkout');
			}
			return { success: true, data: res.data };
		} catch (e: any) {
			return { success: false, error: e?.message || 'Failed to start checkout' };
		} finally {
			submittingState.value = false;
		}
	};

	const openPortal = async (): Promise<SubResult<PortalSession>> => {
		submittingState.value = true;
		try {
			const res = await makeClientAPIRequest<PortalSession>(
				'/v2/users/current/subscription/portal',
				authStore.sessionToken,
				{ method: 'POST', body: { return_url: `${origin()}/` } }
			);
			if (!res.success || !res.data) {
				throw new Error(res.message || 'Failed to open billing portal');
			}
			return { success: true, data: res.data };
		} catch (e: any) {
			return { success: false, error: e?.message || 'Failed to open billing portal' };
		} finally {
			submittingState.value = false;
		}
	};

	const cancel = async (): Promise<SubResult<any>> => {
		submittingState.value = true;
		try {
			const res = await makeClientAPIRequest<any>(
				'/v2/users/current/subscription/cancel',
				authStore.sessionToken,
				{ method: 'POST', body: {} }
			);
			if (!res.success || !res.data) {
				throw new Error(res.message || 'Failed to cancel subscription');
			}
			await fetchStatus();
			return { success: true, data: res.data };
		} catch (e: any) {
			return { success: false, error: e?.message || 'Failed to cancel subscription' };
		} finally {
			submittingState.value = false;
		}
	};

	const redeemCode = async (code: string): Promise<SubResult<any>> => {
		submittingState.value = true;
		try {
			const res = await makeClientAPIRequest<any>(
				'/v2/users/current/subscription/redeem-code',
				authStore.sessionToken,
				{ method: 'POST', body: { code } }
			);
			if (!res.success || !res.data) {
				throw new Error(res.message || 'Failed to redeem code');
			}
			await fetchStatus();
			return { success: true, data: res.data };
		} catch (e: any) {
			return { success: false, error: e?.message || 'Failed to redeem code' };
		} finally {
			submittingState.value = false;
		}
	};

	return {
		status: statusState,
		plans: plansState,
		loading: loadingState,
		submitting: submittingState,
		fetchPlans,
		fetchStatus,
		startCheckout,
		openPortal,
		cancel,
		redeemCode
	};
}

// #region admin

const matchesState = ref<AdminUserMatch[]>([]);
const adminLoadingState = ref(false);
const adminSubmittingState = ref(false);
const errorState = ref<string | null>(null);

// backend rejects q shorter than 2 chars with a 400; short-circuit locally
const MIN_QUERY_LENGTH = 2;

export function useAdminSubscriptions() {
	const authStore = useAuthStore();

	const lookupUsers = async (q: string): Promise<SubResult<AdminUserMatch[]>> => {
		const query = q.trim();
		if (query.length < MIN_QUERY_LENGTH) {
			const message = 'Enter at least 2 characters to search.';
			errorState.value = message;
			return { success: false, error: message };
		}
		adminLoadingState.value = true;
		errorState.value = null;
		try {
			const res = await makeClientAPIRequest<{ matches: AdminUserMatch[] }>(
				`/v2/admin/users/lookup?q=${encodeURIComponent(query)}`,
				authStore.sessionToken
			);
			if (!res.success || !res.data) {
				throw new Error(res.message || 'Failed to look up users');
			}
			matchesState.value = res.data.matches ?? [];
			return { success: true, data: matchesState.value };
		} catch (e: any) {
			const message = e?.message || 'Failed to look up users';
			errorState.value = message;
			return { success: false, error: message };
		} finally {
			adminLoadingState.value = false;
		}
	};

	const refundUser = async (id: number, reason?: string): Promise<SubResult<any>> => {
		adminSubmittingState.value = true;
		try {
			const body: Record<string, unknown> = {};
			if (reason && reason.trim()) body.reason = reason.trim();

			const res = await makeClientAPIRequest<any>(
				`/v2/admin/users/${id}/refund`,
				authStore.sessionToken,
				{ method: 'POST', body }
			);
			if (!res.success || !res.data) {
				throw new Error(res.message || 'Failed to refund user');
			}
			return { success: true, data: res.data };
		} catch (e: any) {
			return { success: false, error: e?.message || 'Failed to refund user' };
		} finally {
			adminSubmittingState.value = false;
		}
	};

	return {
		matches: matchesState,
		loading: adminLoadingState,
		submitting: adminSubmittingState,
		error: errorState,
		lookupUsers,
		refundUser
	};
}

// #region trial codes

const codesState = ref<TrialCode[]>([]);
const trialLoadingState = ref(false);
const trialErrorState = ref<string | null>(null);

/**
 * admin trial-code CRUD composable against /v2/admin/trial-codes. UI-agnostic —
 * returns a neutral result envelope so each surface owns its own feedback
 */
export function useTrialCodes() {
	const authStore = useAuthStore();

	const fetchCodes = async (): Promise<SubResult<TrialCode[]>> => {
		trialLoadingState.value = true;
		trialErrorState.value = null;
		try {
			const res = await makeClientAPIRequest<{ codes: TrialCode[] }>(
				'/v2/admin/trial-codes',
				authStore.sessionToken
			);
			if (!res.success || !res.data) {
				throw new Error(res.message || 'Failed to load trial codes');
			}
			codesState.value = res.data.codes ?? [];
			return { success: true, data: codesState.value };
		} catch (e: any) {
			const message = e?.message || 'Failed to load trial codes';
			trialErrorState.value = message;
			return { success: false, error: message };
		} finally {
			trialLoadingState.value = false;
		}
	};

	const createCode = async (input: TrialCodeCreateInput): Promise<SubResult<TrialCode>> => {
		trialLoadingState.value = true;
		trialErrorState.value = null;
		try {
			const body: Record<string, unknown> = {
				// backend expects lowercase tier (mirror stores/user.ts setAccountType)
				tier: String(input.tier).toLowerCase(),
				days: input.days
			};
			if (input.max_redemptions !== undefined) body.max_redemptions = input.max_redemptions;
			if (input.expires_at !== undefined) body.expires_at = input.expires_at;
			if (input.code) body.code = input.code;

			const res = await makeClientAPIRequest<TrialCode>(
				'/v2/admin/trial-codes',
				authStore.sessionToken,
				{ method: 'POST', body }
			);
			if (!res.success || !res.data) {
				throw new Error(res.message || 'Failed to create trial code');
			}
			codesState.value = [res.data, ...codesState.value];
			return { success: true, data: res.data };
		} catch (e: any) {
			const message = e?.message || 'Failed to create trial code';
			trialErrorState.value = message;
			return { success: false, error: message };
		} finally {
			trialLoadingState.value = false;
		}
	};

	const updateCode = async (
		code: string,
		patch: TrialCodeUpdateInput
	): Promise<SubResult<TrialCode>> => {
		try {
			const body: Record<string, unknown> = { ...patch };
			if (patch.tier !== undefined) body.tier = String(patch.tier).toLowerCase();

			const res = await makeClientAPIRequest<TrialCode>(
				`/v2/admin/trial-codes/${encodeURIComponent(code)}`,
				authStore.sessionToken,
				{ method: 'PATCH', body }
			);
			if (!res.success || !res.data) {
				throw new Error(res.message || 'Failed to update trial code');
			}

			// patch in place to avoid a full re-fetch flicker
			const idx = codesState.value.findIndex((c) => c.code === code);
			if (idx !== -1) codesState.value[idx] = res.data;
			return { success: true, data: res.data };
		} catch (e: any) {
			return { success: false, error: e?.message || 'Failed to update trial code' };
		}
	};

	const deleteCode = async (code: string): Promise<SubResult> => {
		try {
			const res = await makeClientAPIRequest<unknown>(
				`/v2/admin/trial-codes/${encodeURIComponent(code)}`,
				authStore.sessionToken,
				{ method: 'DELETE' }
			);
			if (!res.success) {
				throw new Error(res.message || 'Failed to delete trial code');
			}
			codesState.value = codesState.value.filter((c) => c.code !== code);
			return { success: true };
		} catch (e: any) {
			return { success: false, error: e?.message || 'Failed to delete trial code' };
		}
	};

	const fetchRedemptions = async (code: string): Promise<SubResult<TrialRedemptionList>> => {
		try {
			const res = await makeClientAPIRequest<TrialRedemptionList>(
				`/v2/admin/trial-codes/${encodeURIComponent(code)}/redemptions`,
				authStore.sessionToken
			);
			if (!res.success || !res.data) {
				throw new Error(res.message || 'Failed to load redemptions');
			}
			return { success: true, data: res.data };
		} catch (e: any) {
			return { success: false, error: e?.message || 'Failed to load redemptions' };
		}
	};

	const notifyRedeemers = async (
		code: string,
		input: NotifyRedeemersInput
	): Promise<SubResult<{ notified: number }>> => {
		try {
			const res = await makeClientAPIRequest<{ notified: number }>(
				`/v2/admin/trial-codes/${encodeURIComponent(code)}/notify`,
				authStore.sessionToken,
				{ method: 'POST', body: { title: input.title, message: input.message } }
			);
			if (!res.success || !res.data) {
				throw new Error(res.message || 'Failed to notify redeemers');
			}
			return { success: true, data: res.data };
		} catch (e: any) {
			return { success: false, error: e?.message || 'Failed to notify redeemers' };
		}
	};

	return {
		codes: codesState,
		loading: trialLoadingState,
		error: trialErrorState,
		fetchCodes,
		createCode,
		updateCode,
		deleteCode,
		fetchRedemptions,
		notifyRedeemers
	};
}
