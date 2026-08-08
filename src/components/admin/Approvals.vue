<template>
	<div class="flex flex-col gap-4">
		<div class="flex items-start justify-between gap-3 flex-wrap">
			<div>
				<h2 class="text-xl font-semibold">Approvals</h2>
				<p class="text-sm text-muted mt-1">
					Review activities awaiting publication and applications for verified publisher status.
					Nothing publishes on its own: any submission left unreviewed when its window closes is
					denied automatically.
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

		<div
			v-if="preview"
			class="rounded-lg border border-default p-3 flex flex-col gap-2"
		>
			<div class="flex items-center justify-between gap-2 flex-wrap">
				<span class="text-sm font-medium"
					>Discovery Preview &mdash; {{ preview.candidates.length }} candidate(s) queued</span
				>
				<UButton
					size="xs"
					variant="ghost"
					color="neutral"
					icon="mdi:close"
					@click="preview = null"
					>Dismiss</UButton
				>
			</div>

			<div
				v-if="preview.candidates.length"
				class="flex items-center gap-1 flex-wrap"
			>
				<UBadge
					v-for="id in preview.candidates"
					:key="id"
					color="info"
					variant="subtle"
					size="sm"
					>{{ id }}</UBadge
				>
			</div>
			<p
				v-else
				class="text-sm text-muted"
			>
				No candidates survived the filters this run.
			</p>

			<p class="text-xs text-muted font-mono">
				{{ preview.funnel.raw }} raw &rarr; {{ preview.funnel.afterCatalog }} new &rarr;
				{{ preview.funnel.afterGenre }} specific &rarr;
				{{ preview.funnel.afterSimilarity }} distinct &rarr; {{ preview.funnel.selected }} selected
			</p>
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
import { extractServerMessage } from 'errors';
// a nested UTabs inside the vertical outer tabs renders badly, so this is a segmented
// switcher that keeps both backlog counts visible at once
const view = ref<'activities' | 'publishers'>('activities');
const stagedCount = ref(0);
const publisherCount = ref(0);
const discovering = ref(false);

type DiscoveryFunnel = {
	raw: number;
	afterCatalog: number;
	afterGenre: number;
	afterSimilarity: number;
	selected: number;
	nextUp?: string[];
};

const preview = ref<{ candidates: string[]; funnel: DiscoveryFunnel } | null>(null);

const toast = useToast();
const stagedRef = useTemplateRef<{ load: () => Promise<void> }>('stagedRef');
const publishersRef = useTemplateRef<{ load: () => Promise<void> }>('publishersRef');

async function refresh() {
	await Promise.all([stagedRef.value?.load(), publishersRef.value?.load()]);
}

async function runDryRun() {
	discovering.value = true;
	try {
		const res = await $fetch<{ considered: number; funnel: DiscoveryFunnel }>(
			'/api/admin/activity/discover',
			{ method: 'POST' }
		);
		preview.value = { candidates: res.funnel?.nextUp ?? [], funnel: res.funnel };
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
			description: extractServerMessage(err, 'Could not reach the discovery pipeline.'),
			icon: 'mdi:alert-circle',
			color: 'error'
		});
	} finally {
		discovering.value = false;
	}
}
</script>
