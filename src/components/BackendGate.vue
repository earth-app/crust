<template>
	<div
		id="backend-gate"
		role="alert"
		aria-live="assertive"
		class="flex min-h-[70vh] w-full items-center justify-center px-4 py-12"
	>
		<div class="e-card e-card-raised w-full max-w-lg items-center text-center">
			<UIcon
				:name="copy.icon"
				class="size-12"
				:class="isMaintenance ? 'e-text-warning' : 'e-text-danger'"
			/>

			<h1 class="text-2xl font-semibold text-highlighted">{{ copy.title }}</h1>

			<p class="text-toned">{{ copy.body }}</p>

			<div class="mt-2 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
				<UButton
					:loading="backend.checking"
					color="primary"
					icon="mdi:refresh"
					@click="retry"
					>Try Again</UButton
				>
				<UButton
					:to="STATUS_PAGE_URL"
					external
					target="_blank"
					color="neutral"
					variant="subtle"
					icon="mdi:chart-timeline-variant"
					>Check Status</UButton
				>
				<UButton
					v-if="!isMaintenance"
					:to="SUPPORT_PAGE_URL"
					external
					target="_blank"
					color="neutral"
					variant="subtle"
					icon="mdi:lifebuoy"
					>Contact Support</UButton
				>
			</div>

			<p class="text-2xs text-muted">{{ copy.footer }}</p>
		</div>
	</div>
</template>

<script setup lang="ts">
import { STATUS_PAGE_URL, SUPPORT_PAGE_URL } from 'backend';
import { useBackendStore } from 'stores/backend';

const backend = useBackendStore();

const isMaintenance = computed(() => backend.mantle === 'maintenance');

const copy = computed(() =>
	isMaintenance.value
		? {
				icon: 'mdi:wrench-outline',
				title: 'The Earth App is Under Maintenance',
				body: 'We are making some changes and will be back shortly. Nothing you have saved is affected.',
				footer: 'This page checks again on its own every 30 seconds.'
			}
		: {
				icon: 'mdi:cloud-alert-outline',
				title: "We can't reach The Earth App",
				body: 'Our servers are not responding right now. This is on our end, not yours, and your account and data are safe.',
				footer: 'This page checks again on its own every 30 seconds.'
			}
);

async function retry() {
	await backend.preflight(true);
}

onMounted(() => backend.startRecoveryPolling());
onUnmounted(() => backend.stopRecoveryPolling());
</script>
