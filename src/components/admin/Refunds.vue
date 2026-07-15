<template>
	<div class="flex flex-col gap-4">
		<div>
			<h2 class="text-lg font-semibold m-0">Refund a User</h2>
			<p class="text-xs text-muted m-0 mt-1">
				Look up a subscriber by username, ID, email, or name, then issue a refund. Refunds move real
				money and revoke the paid plan immediately.
			</p>
		</div>

		<form
			class="flex items-center gap-2 flex-wrap"
			@submit.prevent="onSearch"
		>
			<UInput
				v-model="query"
				placeholder="Username, ID, Email, or Name"
				icon="mdi:account-search"
				class="flex-1 min-w-64"
				:disabled="loading"
			/>
			<UButton
				type="submit"
				color="primary"
				icon="mdi:magnify"
				:loading="loading"
				:disabled="query.trim().length < 2"
			>
				Search
			</UButton>
		</form>

		<div
			v-if="error"
			class="rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm text-danger"
		>
			{{ error }}
		</div>

		<div
			v-else-if="searched && !loading && matches.length === 0"
			class="rounded-lg border border-default px-6 py-12 text-center text-muted text-sm"
		>
			No users matched "{{ lastQuery }}".
		</div>

		<ul
			v-else-if="matches.length > 0"
			class="flex flex-col gap-3"
		>
			<li
				v-for="m in matches"
				:key="m.id"
				class="rounded-lg border border-default p-4 flex items-start justify-between gap-4 flex-wrap"
			>
				<div class="flex flex-col gap-2 min-w-0">
					<div class="flex items-center gap-2 flex-wrap">
						<span class="font-semibold wrap-break-word">{{ m.full_name || m.username }}</span>
						<span class="text-xs text-muted">@{{ m.username }}</span>
						<span class="text-xs text-muted">#{{ m.id }}</span>
					</div>
					<div
						v-if="m.email"
						class="text-xs text-muted wrap-break-word"
					>
						{{ m.email }}
					</div>
					<div class="flex items-center gap-2 flex-wrap mt-1">
						<UBadge
							color="neutral"
							variant="subtle"
							>{{ tierLabel(m.subscription.tier) }}</UBadge
						>
						<UBadge
							:color="statusColor(m.subscription.status)"
							variant="subtle"
							>{{ statusLabel(m.subscription.status) }}</UBadge
						>
						<UBadge
							v-if="m.subscription.refund_eligible"
							color="success"
							variant="subtle"
							icon="mdi:cash-refund"
							>Refund Eligible</UBadge
						>
						<UBadge
							v-else
							color="neutral"
							variant="outline"
							>Not Refund Eligible</UBadge
						>
					</div>
				</div>

				<UButton
					icon="mdi:cash-refund"
					color="error"
					:variant="canRefund(m) ? 'solid' : 'ghost'"
					size="sm"
					:disabled="!canRefund(m)"
					@click="openRefund(m)"
				>
					Refund
				</UButton>
			</li>
		</ul>

		<UModal
			v-model:open="openConfirm"
			title="Confirm Refund"
			:dismissible="!submitting"
		>
			<template #body>
				<div
					v-if="target"
					class="flex flex-col gap-4 p-1"
				>
					<div
						class="flex items-start gap-2 rounded bg-amber-500/10 border border-amber-500/40 p-3"
					>
						<UIcon
							name="mdi:alert"
							class="text-amber-500 text-lg shrink-0"
						/>
						<div class="text-xs">
							This issues a real-money refund and revokes the paid plan immediately. This action
							cannot be undone.
						</div>
					</div>

					<div class="flex flex-col gap-1 text-sm">
						<div class="flex items-center gap-2 flex-wrap">
							<span class="font-semibold">{{ target.full_name || target.username }}</span>
							<span class="text-xs text-muted">@{{ target.username }}</span>
							<span class="text-xs text-muted">#{{ target.id }}</span>
						</div>
						<div class="flex items-center gap-2 flex-wrap mt-1">
							<UBadge
								color="neutral"
								variant="subtle"
								>{{ tierLabel(target.subscription.tier) }}</UBadge
							>
							<UBadge
								:color="statusColor(target.subscription.status)"
								variant="subtle"
								>{{ statusLabel(target.subscription.status) }}</UBadge
							>
							<UBadge
								:color="target.subscription.refund_eligible ? 'success' : 'neutral'"
								:variant="target.subscription.refund_eligible ? 'subtle' : 'outline'"
								>{{
									target.subscription.refund_eligible ? 'Refund Eligible' : 'Not Refund Eligible'
								}}</UBadge
							>
						</div>
						<div
							v-if="!target.subscription.refund_eligible"
							class="text-xs text-muted mt-1"
						>
							Outside the 14-day refund window; this will cancel the plan instead of refunding.
						</div>
					</div>

					<div class="flex flex-col gap-1">
						<label class="text-sm font-medium">Reason (Optional)</label>
						<UTextarea
							v-model="reason"
							placeholder="Recorded on the refund for support and audit."
							:maxlength="500"
							:rows="3"
						/>
					</div>
				</div>
			</template>

			<template #footer>
				<div class="flex justify-end gap-2 w-full">
					<UButton
						color="neutral"
						variant="ghost"
						:disabled="submitting"
						@click="openConfirm = false"
					>
						Cancel
					</UButton>
					<UButton
						color="error"
						icon="mdi:cash-refund"
						:loading="submitting"
						@click="confirmRefund"
					>
						Refund This User
					</UButton>
				</div>
			</template>
		</UModal>
	</div>
</template>

<script setup lang="ts">
import type { AdminUserMatch, SubscriptionStatusValue } from 'types/subscription';
import type { AccountType } from 'types/user';

const { matches, loading, submitting, error, lookupUsers, refundUser } = useAdminSubscriptions();
const toast = useToast();

const query = ref('');
const lastQuery = ref('');
const searched = ref(false);

const openConfirm = ref(false);
const target = ref<AdminUserMatch | null>(null);
const reason = ref('');

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

function tierLabel(t: AccountType | string): string {
	const key = String(t).toUpperCase();
	return TIER_LABELS[key] ?? key;
}

function statusLabel(s: SubscriptionStatusValue): string {
	return STATUS_LABELS[s] ?? 'None';
}

function statusColor(s: SubscriptionStatusValue) {
	switch (s) {
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
}

// a refund only makes sense against a paid subscription; a free/no-plan user has
// nothing to refund
function canRefund(m: AdminUserMatch): boolean {
	const s = m.subscription;
	if (!s) return false;
	if (s.status === 'none') return false;
	if (String(s.tier).toUpperCase() === 'FREE') return false;
	return true;
}

async function onSearch() {
	const q = query.value.trim();
	if (q.length < 2) return;
	lastQuery.value = q;
	const res = await lookupUsers(q);
	searched.value = true;
	if (!res.success) {
		toast.add({
			title: 'Could Not Look Up Users',
			description: res.error ?? 'Try again.',
			icon: 'mdi:alert-circle',
			color: 'error',
			duration: 6000
		});
	}
}

function openRefund(m: AdminUserMatch) {
	if (!canRefund(m)) return;
	target.value = m;
	reason.value = '';
	openConfirm.value = true;
}

async function confirmRefund() {
	if (!target.value) return;
	const res = await refundUser(target.value.id, reason.value);
	if (res.success) {
		toast.add({
			title:
				res.data?.result === 'refunded'
					? 'User Refunded'
					: res.data?.result === 'store_managed'
						? 'Store-Managed Subscription'
						: 'Subscription Canceled',
			description: res.data?.message ?? 'The refund request was processed.',
			icon: 'mdi:cash-refund',
			color: 'success',
			duration: 6000
		});
		openConfirm.value = false;
		// refresh the results so the plan/status badges reflect the refund
		if (lastQuery.value) await lookupUsers(lastQuery.value);
	} else {
		toast.add({
			title: 'Could Not Refund User',
			description: res.error ?? 'Try again or check the subscription state.',
			icon: 'mdi:alert-circle',
			color: 'error',
			duration: 6000
		});
	}
}
</script>
