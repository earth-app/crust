<template>
	<div class="flex flex-col gap-4">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-lg font-semibold m-0">Poll Aggregates</h2>
				<p class="text-xs text-muted m-0 mt-1">
					Global vote counts across every MicroPoll surface. Polls expire 30 days after their last
					activity.
				</p>
			</div>
			<UButton
				color="neutral"
				variant="ghost"
				icon="mdi:refresh"
				:loading="loading"
				@click="load"
			>
				Refresh
			</UButton>
		</div>

		<div
			v-if="loading && items.length === 0"
			class="flex items-center justify-center py-12"
		>
			<UIcon
				name="mdi:loading"
				class="size-6 animate-spin text-muted"
			/>
		</div>

		<div
			v-else-if="errorMessage"
			class="rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm text-danger"
		>
			{{ errorMessage }}
		</div>

		<div
			v-else-if="items.length === 0"
			class="rounded-lg border border-default px-6 py-12 text-center text-muted text-sm"
		>
			No poll votes recorded yet.
		</div>

		<ul
			v-else
			class="flex flex-col gap-3"
		>
			<li
				v-for="entry in items"
				:key="entry.poll_id"
				class="rounded-lg border border-default p-4 flex flex-col gap-2"
			>
				<div class="flex items-baseline justify-between gap-3">
					<h3 class="text-base font-semibold m-0 break-words">
						{{ entry.question || entry.poll_id }}
					</h3>
					<UBadge
						color="primary"
						variant="subtle"
						>{{ entry.total }} {{ entry.total === 1 ? 'vote' : 'votes' }}</UBadge
					>
				</div>
				<p class="text-xs text-muted m-0">
					poll_id: <code class="text-[10px]">{{ entry.poll_id }}</code> · updated
					{{ formatUpdated(entry.updated_at) }}
				</p>
				<div class="flex flex-col gap-1 mt-1">
					<div
						v-for="(option, i) in entry.options"
						:key="`${entry.poll_id}-${i}`"
						class="flex flex-col gap-1"
					>
						<div class="flex justify-between text-xs">
							<span>{{ option }}</span>
							<span class="text-muted">{{ entry.counts[i] ?? 0 }} ({{ percent(entry, i) }}%)</span>
						</div>
						<UProgress
							:model-value="percent(entry, i)"
							color="primary"
							size="sm"
						/>
					</div>
				</div>
			</li>
		</ul>
	</div>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';
import type { GlobalPollEntry } from '~/composables/usePoll';

const { fetchGlobalAggregates } = usePoll();

const items = ref<GlobalPollEntry[]>([]);
const loading = ref(false);
const errorMessage = ref<string | null>(null);

function percent(entry: GlobalPollEntry, i: number): number {
	if (entry.total <= 0) return 0;
	return Math.round(((entry.counts[i] ?? 0) / entry.total) * 100);
}

function formatUpdated(ts: number): string {
	if (!ts) return 'never';
	return DateTime.fromSeconds(ts).toRelative() ?? 'recently';
}

async function load() {
	loading.value = true;
	errorMessage.value = null;
	const res = await fetchGlobalAggregates();
	loading.value = false;
	if (res.success) {
		items.value = (res.data ?? []).slice().sort((a, b) => b.total - a.total);
	} else {
		errorMessage.value = res.message || 'Failed to load poll aggregates.';
	}
}

onMounted(load);
</script>
