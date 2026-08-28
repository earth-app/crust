<template>
	<div
		v-if="expeditions.length || loading"
		id="activity-expeditions"
		class="flex flex-col gap-3 min-w-75 w-3/5 mt-8 p-4 bg-elevated light:bg-muted border-2 border-default rounded-lg"
	>
		<div class="flex items-start justify-between gap-3">
			<div class="min-w-0">
				<h3 class="text-lg font-semibold">Groups Doing This</h3>
				<p class="text-sm text-muted">
					Shared gardens gathered around {{ activity.name }}. Outdoor time from everyone in the
					group grows the same garden.
				</p>
			</div>
			<UIcon
				name="mdi:account-group-outline"
				class="size-7 shrink-0 text-muted"
			/>
		</div>

		<USkeleton
			v-if="loading && !expeditions.length"
			class="h-16 rounded-lg"
		/>

		<NuxtLink
			v-for="expedition in expeditions"
			:key="expedition.id"
			:to="`/profile/circle?expedition=${expedition.id}`"
			class="flex items-center justify-between gap-3 p-3 rounded-lg bg-default border border-default hover:border-primary/40 transition-colors no-underline!"
		>
			<div class="min-w-0">
				<p class="text-sm font-medium truncate">{{ expedition.title }}</p>
				<p class="text-xs text-muted">
					{{ expedition.contributors.length }}
					{{ expedition.contributors.length === 1 ? 'person' : 'people' }} ·
					{{ goalLabel(expedition) }}
				</p>
			</div>
			<UBadge
				color="primary"
				variant="subtle"
				size="sm"
				>{{ percent(expedition) }}%</UBadge
			>
		</NuxtLink>
	</div>
</template>

<script setup lang="ts">
import type { Expedition } from 'types/circles';

const props = defineProps<{ activity: Activity }>();

const { expeditionsForActivity } = useCircles();

const expeditions = ref<Expedition[]>([]);
const loading = ref(false);

const GOAL_LABELS: Record<string, string> = {
	nature_minutes: 'minutes outside',
	trails: 'trails',
	quests: 'quests'
};

function goalLabel(expedition: Expedition): string {
	return `${expedition.progress} / ${expedition.target} ${GOAL_LABELS[expedition.goal] ?? expedition.goal}`;
}

function percent(expedition: Expedition): number {
	if (!expedition.target) return 0;
	return Math.min(100, Math.round((expedition.progress / expedition.target) * 100));
}

async function load() {
	if (!props.activity?.id) return;
	loading.value = true;
	try {
		const res = await expeditionsForActivity(props.activity.id);
		expeditions.value = valid(res) ? res.data.expeditions : [];
	} finally {
		loading.value = false;
	}
}

watch(() => props.activity?.id, load, { immediate: true });
</script>
