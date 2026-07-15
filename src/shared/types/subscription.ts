import type { AccountType } from './user';

export type SubscriptionStatusValue =
	'active' | 'trialing' | 'past_due' | 'canceled' | 'refunded' | 'incomplete' | 'none';

export type SubscriptionProvider = 'stripe' | 'apple' | 'google' | 'trial';

export interface SubscriptionPlan {
	tier: AccountType;
	name: string;
	price_cents: number;
	price_display: string;
	currency: string;
	interval: 'month';
}

export interface SubscriptionStatus {
	tier: AccountType;
	status: SubscriptionStatusValue;
	provider: SubscriptionProvider | null;
	current_period_end: string | null;
	cancel_at_period_end: boolean;
	is_trial: boolean;
	trial_end: string | null;
	refund_eligible: boolean;
	refund_deadline: string | null;
	can_manage_billing: boolean;
}

export interface TrialCode {
	code: string;
	tier: AccountType;
	days: number;
	max_redemptions: number;
	redemptions: number;
	expires_at: string | null;
	active: boolean;
	created_by: number;
	created: string;
}

export interface TrialCodeCreateInput {
	tier: AccountType;
	days: number;
	max_redemptions?: number;
	expires_at?: string | null;
	code?: string;
}

// patch is a subset of the mutable trial-code fields
export type TrialCodeUpdateInput = Partial<{
	active: boolean;
	max_redemptions: number;
	expires_at: string | null;
	days: number;
	tier: AccountType;
}>;

// one redeemer of a trial code; detail (tier/expires_at) is nulled once the
// trial ends but the guard row lives forever, so active drives the badge
export interface TrialRedemption {
	uid: number;
	username: string;
	redeemed_at: string;
	tier: AccountType | null;
	expires_at: string | null;
	active: boolean;
}

export interface TrialRedemptionList {
	redemptions: TrialRedemption[];
	active_count: number;
	total_count: number;
}

export interface NotifyRedeemersInput {
	title: string;
	message: string;
}

// a candidate user resolved by the admin refund lookup (by id/username/email/name)
export interface AdminUserMatch {
	id: number;
	username: string;
	email: string;
	full_name: string;
	subscription: SubscriptionStatus;
}

// checkout + redeem results are loosely shaped (provider-dependent); the caller
// only reads url/message so keep them permissive
export interface CheckoutSession {
	url: string;
	session_id: string;
}

export interface PortalSession {
	url: string;
}

// neutral result envelope returned by every method so each consumer surfaces
// success/failure with its own toast (rich Nuxt UI in crust, capacitor in sky)
export interface SubResult<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
}
