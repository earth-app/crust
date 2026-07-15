<template>
	<section
		id="subscription"
		class="flex flex-col items-center w-full max-w-4xl"
	>
		<h3 class="text-2xl font-semibold text-gray-200 light:text-gray-600 mt-8">Subscription</h3>
		<div class="text-sm opacity-80 text-center max-w-2xl mb-4">
			Manage your Earth App plan, billing, and trial codes. Paid plans renew automatically each
			month until you cancel, and you can request a refund within 14 days of a charge.
		</div>

		<div
			class="flex flex-col px-4 pt-3 pb-2 border-t-4 border-black dark:border-white w-full max-w-4xl gap-4"
		>
			<div
				v-if="loading && !status"
				class="flex items-center justify-center py-8"
			>
				<UIcon
					name="mdi:loading"
					class="size-6 animate-spin text-muted"
				/>
			</div>

			<template v-else>
				<div class="flex items-start justify-between flex-wrap gap-3">
					<div class="flex flex-col gap-1">
						<div class="text-sm opacity-80">Current Plan</div>
						<div class="flex items-center gap-2">
							<span class="text-lg font-semibold">{{ tierLabel }}</span>
							<UBadge
								:color="statusColor"
								variant="subtle"
								>{{ statusLabel }}</UBadge
							>
						</div>
						<div
							v-if="renewalLine"
							class="text-xs opacity-70"
						>
							{{ renewalLine }}
						</div>
						<div
							v-if="refundLine"
							class="text-xs text-emerald-500"
						>
							{{ refundLine }}
						</div>
					</div>

					<div class="flex items-center gap-2 flex-wrap">
						<UButton
							v-if="status?.can_manage_billing"
							icon="mdi:credit-card-outline"
							color="neutral"
							variant="ghost"
							size="sm"
							:loading="submitting"
							@click="onManageBilling"
						>
							Manage Billing
						</UButton>
						<UButton
							v-if="canCancel"
							icon="mdi:cancel"
							color="error"
							variant="ghost"
							size="sm"
							:loading="submitting"
							@click="onCancel"
						>
							Cancel Plan
						</UButton>
						<UButton
							to="/pricing"
							icon="mdi:arrow-up-bold"
							color="primary"
							size="sm"
						>
							View Plans
						</UButton>
					</div>
				</div>

				<div class="flex flex-col gap-2 border-t border-default pt-3">
					<label class="text-sm font-medium">Redeem a Code</label>
					<div class="flex items-center gap-2 flex-wrap">
						<UInput
							v-model="redeemInput"
							placeholder="EARTH-XXXX-XXXX"
							class="flex-1 min-w-60"
							:disabled="submitting"
							@keyup.enter="onRedeem"
						/>
						<UButton
							color="primary"
							icon="mdi:ticket-confirmation"
							:loading="submitting"
							:disabled="!redeemInput.trim()"
							@click="onRedeem"
						>
							Redeem
						</UButton>
					</div>
					<div class="text-xs opacity-70">
						Have a trial code? Enter it here to unlock a plan for a limited time.
					</div>
				</div>
			</template>
		</div>
	</section>
</template>

<script setup lang="ts">
const { status, loading, submitting, fetchStatus, cancel, openPortal, redeemCode } =
	useSubscription();
const toast = useToast();

const redeemInput = ref('');

const TIER_LABELS: Record<string, string> = {
	FREE: 'Free',
	PRO: 'Pro',
	WRITER: 'Writer',
	ORGANIZER: 'Organizer',
	ADMINISTRATOR: 'Administrator'
};

const STATUS_LABELS: Record<string, string> = {
	active: 'Active',
	trialing: 'Trial',
	past_due: 'Past Due',
	canceled: 'Canceled',
	refunded: 'Refunded',
	incomplete: 'Incomplete',
	none: 'None'
};

// backend serializes tier lowercase; normalize for display
const tierLabel = computed(() => {
	const t = String(status.value?.tier ?? 'FREE').toUpperCase();
	return TIER_LABELS[t] ?? t;
});

const statusLabel = computed(() => STATUS_LABELS[status.value?.status ?? 'none'] ?? 'None');

const statusColor = computed(() => {
	switch (status.value?.status) {
		case 'active':
		case 'trialing':
			return 'success';
		case 'past_due':
		case 'incomplete':
			return 'warning';
		case 'canceled':
		case 'refunded':
			return 'error';
		default:
			return 'neutral';
	}
});

const canCancel = computed(() => {
	const s = status.value;
	if (!s) return false;
	if (!['active', 'trialing', 'past_due'].includes(s.status)) return false;
	return !s.cancel_at_period_end;
});

const renewalLine = computed(() => {
	const s = status.value;
	if (!s) return '';
	if (s.is_trial && s.trial_end) return `Trial ends on ${formatDate(s.trial_end)}.`;
	if (s.cancel_at_period_end && s.current_period_end)
		return `Access until ${formatDate(s.current_period_end)}. Auto-renewal is off.`;
	if (s.current_period_end && (s.status === 'active' || s.status === 'past_due'))
		return `Renews on ${formatDate(s.current_period_end)}.`;
	return '';
});

const refundLine = computed(() => {
	const s = status.value;
	if (s?.refund_eligible && s.refund_deadline)
		return `Refund available through ${formatDate(s.refund_deadline)}.`;
	return '';
});

function formatDate(iso: string): string {
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

onMounted(fetchStatus);

async function onManageBilling() {
	const res = await openPortal();
	if (res.success && res.data?.url) {
		window.location.href = res.data.url;
	} else {
		toast.add({
			title: 'Could Not Open Billing Portal',
			description: res.error ?? 'The billing portal is unavailable right now. Try again later.',
			icon: 'mdi:alert-circle',
			color: 'error',
			duration: 6000
		});
	}
}

async function onCancel() {
	if (!confirm('Cancel your subscription? Any refund or access period is shown after you confirm.'))
		return;
	const res = await cancel();
	if (!res.success) {
		toast.add({
			title: 'Could Not Cancel Subscription',
			description:
				res.error ?? 'We could not cancel your subscription. Try again or contact support.',
			icon: 'mdi:alert-circle',
			color: 'error',
			duration: 6000
		});
		return;
	}
	const data = res.data ?? {};
	// a store-billed sub (bought in the mobile app) can't be canceled from the web; send them to the store
	if (data.result === 'store_managed' && data.manage_url) {
		toast.add({
			title: 'Manage in Your App Store',
			description:
				data.message ?? 'This subscription is billed by the app store. Opening your subscriptions.',
			icon: 'mdi:storefront',
			color: 'info',
			duration: 8000
		});
		window.open(data.manage_url, '_blank', 'noopener');
		return;
	}
	toast.add({
		title: data.result === 'refunded' ? 'Subscription Refunded' : 'Subscription Canceled',
		description: data.message ?? 'Your plan will not renew.',
		icon: data.result === 'refunded' ? 'mdi:cash-refund' : 'mdi:cancel',
		color: 'success',
		duration: 6000
	});
}

async function onRedeem() {
	const code = redeemInput.value.trim();
	if (!code) return;
	const res = await redeemCode(code);
	if (res.success) {
		redeemInput.value = '';
		toast.add({
			title: 'Code Redeemed',
			description: res.data?.message ?? 'Your trial has been applied. Enjoy your new plan!',
			icon: 'mdi:ticket-confirmation',
			color: 'success',
			duration: 6000
		});
	} else {
		toast.add({
			title: 'Could Not Redeem Code',
			description: res.error ?? 'That code is invalid, expired, or already used.',
			icon: 'mdi:alert-circle',
			color: 'error',
			duration: 6000
		});
	}
}
</script>
