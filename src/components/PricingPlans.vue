<template>
	<Ranks
		:highlighted="highlighted"
		@upgrade="onUpgrade"
	/>

	<UModal
		v-model:open="confirmOpen"
		title="Confirm Your Subscription"
		:dismissible="!checkingOut"
	>
		<template #body>
			<div
				v-if="confirmPlan"
				class="flex flex-col gap-3 p-1"
			>
				<p class="text-sm">
					You are about to subscribe to the
					<span class="font-semibold">{{ confirmPlan.title }}</span> plan at
					<span class="font-semibold">{{ confirmPlan.price }}</span
					>.
				</p>
				<div
					class="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs flex items-start gap-2"
				>
					<UIcon
						name="mdi:autorenew"
						class="text-amber-500 text-lg shrink-0"
					/>
					<span>
						This is an auto-renewing subscription. Your card is charged {{ confirmPlan.price }} each
						month until you cancel. You can cancel anytime from your account settings, and refunds
						are available within 14 days of a charge.
					</span>
				</div>
				<p class="text-xs opacity-70">
					By continuing you agree to our Terms of Service and consent to recurring billing. You will
					be redirected to our secure checkout to complete payment.
				</p>
			</div>
		</template>

		<template #footer>
			<div class="flex justify-end gap-2 w-full">
				<UButton
					color="neutral"
					variant="ghost"
					:disabled="checkingOut"
					@click="confirmOpen = false"
				>
					Cancel
				</UButton>
				<UButton
					color="primary"
					icon="mdi:lock"
					:loading="checkingOut"
					@click="confirmCheckout"
				>
					Agree & Continue
				</UButton>
			</div>
		</template>
	</UModal>
</template>

<script setup lang="ts">
import type { PricingPlanProps } from '@nuxt/ui';
import type { AccountType } from 'types/user';

type Plan = PricingPlanProps & { tier: AccountType };

defineProps<{
	highlighted?: 'FREE' | 'PRO' | 'WRITER' | 'ORGANIZER';
}>();

const { startCheckout } = useSubscription();
const toast = useToast();

const confirmOpen = ref(false);
const confirmPlan = ref<Plan | null>(null);
const checkingOut = ref(false);

function onUpgrade(plan: Plan) {
	confirmPlan.value = plan;
	confirmOpen.value = true;
}

async function confirmCheckout() {
	const plan = confirmPlan.value;
	if (!plan) return;
	checkingOut.value = true;
	const res = await startCheckout(plan.tier, true);
	if (res.success && res.data?.url) {
		window.location.href = res.data.url;
		return; // keep the spinner while the browser navigates away
	}
	checkingOut.value = false;
	confirmOpen.value = false;
	toast.add({
		title: 'Could Not Start Checkout',
		description: res.error ?? 'We could not reach the checkout service. Please try again.',
		icon: 'mdi:alert-circle',
		color: 'error',
		duration: 6000
	});
}
</script>
