<template>
	<div class="flex flex-col gap-4">
		<div class="flex items-start justify-between gap-3 flex-wrap">
			<div>
				<h2 class="text-xl font-semibold">Approvals</h2>
				<p class="text-sm text-muted mt-1">
					Review activities awaiting publication and applications for verified publisher status.
					Automated submissions publish themselves if the window closes; organizer submissions are
					denied.
				</p>
			</div>
			<div class="flex items-center gap-2">
				<UButton
					icon="mdi:radar"
					variant="ghost"
					color="neutral"
					:loading="discovering"
					@click="runDryRun"
					>Preview Discovery</UButton
				>
				<UButton
					icon="mdi:refresh"
					variant="ghost"
					color="neutral"
					@click="refresh"
					>Refresh</UButton
				>
			</div>
		</div>

		<div class="flex items-center gap-2 flex-wrap">
			<UButton
				:variant="view === 'activities' ? 'solid' : 'ghost'"
				color="primary"
				icon="mdi:tag-multiple"
				@click="view = 'activities'"
				>Staged Activities ({{ stagedCount }})</UButton
			>
			<UButton
				:variant="view === 'publishers' ? 'solid' : 'ghost'"
				color="primary"
				icon="mdi:shield-account"
				@click="view = 'publishers'"
				>Publisher Applications ({{ publisherCount }})</UButton
			>
		</div>

		<AdminApprovalsStagedActivities
			v-show="view === 'activities'"
			ref="stagedRef"
			@count="stagedCount = $event"
		/>
		<AdminApprovalsPublisherApplications
			v-show="view === 'publishers'"
			ref="publishersRef"
			@count="publisherCount = $event"
		/>
	</div>
</template>

<script setup lang="ts">
// a nested UTabs inside the vertical outer tabs renders badly, so this is a segmented
// switcher that keeps both backlog counts visible at once
const view = ref<'activities' | 'publishers'>('activities');
const stagedCount = ref(0);
const publisherCount = ref(0);
const discovering = ref(false);

const toast = useToast();
const stagedRef = useTemplateRef<{ load: () => Promise<void> }>('stagedRef');
const publishersRef = useTemplateRef<{ load: () => Promise<void> }>('publishersRef');

async function refresh() {
	await Promise.all([stagedRef.value?.load(), publishersRef.value?.load()]);
}

async function runDryRun() {
	discovering.value = true;
	try {
		const res = await $fetch<{ considered: number; funnel: { nextUp: string[] } }>(
			'/api/admin/activity/discover',
			{ method: 'POST' }
		);
		toast.add({
			title: `Discovery Preview: ${res.considered} Candidates`,
			description: res.funnel?.nextUp?.length
				? `Next up: ${res.funnel.nextUp.slice(0, 5).join(', ')}`
				: 'No further candidates queued.',
			icon: 'mdi:radar',
			color: 'info',
			duration: 8000
		});
	} catch (err) {
		toast.add({
			title: 'Discovery Preview Failed',
			description: errors.extractServerMessage(err, 'Could not reach the discovery pipeline.'),
			icon: 'mdi:alert-circle',
			color: 'error'
		});
	} finally {
		discovering.value = false;
	}
}
</script>
