<template>
	<div
		class="flex flex-col items-center justify-center w-full min-h-[60vh] py-12 px-4 text-center gap-4"
	>
		<UIcon
			name="mdi:check-circle"
			class="text-emerald-500 size-16"
		/>
		<h1 class="text-3xl font-bold">You're All Set</h1>
		<p class="text-md max-w-xl opacity-80">
			Thank you for subscribing to The Earth App. Your plan is now
			<span
				v-if="tierLabel"
				class="font-semibold"
				>{{ tierLabel }}</span
			>
			<span v-else>active</span>. A receipt has been sent to your email.
		</p>
		<div class="flex items-center gap-3 mt-2 flex-wrap justify-center">
			<UButton
				to="/"
				color="primary"
				icon="mdi:home"
				>Go Home</UButton
			>
			<UButton
				to="/pricing"
				color="neutral"
				variant="ghost"
				>View Plans</UButton
			>
		</div>
	</div>
</template>

<script setup lang="ts">
const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Subscription Confirmed');

const { status, fetchStatus } = useSubscription();
const toast = useToast();

const TIER_LABELS: Record<string, string> = {
	FREE: 'Free',
	PRO: 'Pro',
	WRITER: 'Writer',
	ORGANIZER: 'Organizer'
};

const tierLabel = computed(() => {
	const t = String(status.value?.tier ?? '').toUpperCase();
	return TIER_LABELS[t] ?? status.value?.tier ?? 'Plan';
});

onMounted(async () => {
	const res = await fetchStatus();
	if (res.success) {
		toast.add({
			title: 'Subscription Active',
			description: 'Your plan is ready to use.',
			icon: 'mdi:check-circle',
			color: 'success',
			duration: 5000
		});
	}
});
</script>
