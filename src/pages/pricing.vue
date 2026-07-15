<template>
	<div class="flex flex-col items-center w-full h-full py-8 px-4 sm:px-8">
		<h1 class="text-3xl font-bold text-center">Choose Your Plan</h1>
		<p class="text-md mt-2 text-center max-w-2xl opacity-80">
			Upgrade to unlock more events, faster quests, creator tools, and priority support. Paid plans
			renew monthly and can be canceled anytime.
		</p>
		<div class="mt-8 w-full flex justify-center">
			<PricingPlans :highlighted="highlighted" />
		</div>
	</div>
</template>

<script setup lang="ts">
const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Pricing');

const { user } = useAuth();

// highlight the tier just above the user's current one (Writer by default)
const highlighted = computed<'FREE' | 'PRO' | 'WRITER' | 'ORGANIZER'>(() => {
	const order = ['FREE', 'PRO', 'WRITER', 'ORGANIZER'] as const;
	const current = user.value?.account.account_type ?? 'FREE';
	const idx = order.indexOf(current as (typeof order)[number]);
	if (idx < 0 || idx >= order.length - 1) return 'WRITER';
	return order[idx + 1]!;
});
</script>
