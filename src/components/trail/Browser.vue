<template>
	<div class="flex flex-col gap-5 w-full">
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
			<div class="flex flex-col">
				<h2 class="text-xl font-semibold">Curiosity Trails</h2>
				<p class="text-sm opacity-70">
					Themed walks that pull you outside with a clue and pay off with wonder.
				</p>
			</div>

			<TrailNatureRing
				v-if="natureMinutes"
				:minutes="natureMinutes.minutes"
				:target="natureMinutes.target"
				:best="natureMinutes.best"
				:size="72"
			/>
		</div>

		<div class="flex flex-wrap gap-2">
			<UButton
				v-for="opt in themeOptions"
				:key="opt.value"
				:color="activeTheme === opt.value ? 'primary' : 'neutral'"
				:variant="activeTheme === opt.value ? 'solid' : 'soft'"
				size="sm"
				@click="activeTheme = opt.value"
				>{{ opt.label }}</UButton
			>
		</div>

		<div
			v-if="loading && !filteredTrails.length"
			class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
		>
			<USkeleton
				v-for="n in 6"
				:key="n"
				class="h-40 rounded-xl"
			/>
		</div>

		<div
			v-else-if="filteredTrails.length"
			class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
		>
			<TrailCard
				v-for="trail in filteredTrails"
				:key="trail.id"
				:trail="trail"
				@select="openTrail"
			/>
		</div>

		<div
			v-else
			class="flex flex-col items-center gap-2 py-16 text-center opacity-70"
		>
			<UIcon
				name="mdi:compass-off-outline"
				class="size-10"
			/>
			<p class="text-sm">No Trails Here Yet. Check Back Soon.</p>
		</div>

		<TrailRunner
			v-if="activeTrail"
			:key="activeTrail.id"
			v-model:open="runnerOpen"
			:trail="activeTrail"
		/>
	</div>
</template>

<script setup lang="ts">
const { trails, natureMinutes, fetchTrails, fetchNatureMinutes } = useTrails();
const { user } = useAuth();

const themeOptions = [
	{ value: 'all', label: 'All' },
	{ value: 'nature', label: 'Nature' },
	{ value: 'curiosity', label: 'Curiosity' },
	{ value: 'creative', label: 'Creative' },
	{ value: 'mixed', label: 'Mixed' }
] as const;

const activeTheme = ref<(typeof themeOptions)[number]['value']>('all');
const loading = ref(false);

const filteredTrails = computed(() =>
	activeTheme.value === 'all'
		? trails.value
		: trails.value.filter((t) => t.theme === activeTheme.value)
);

const activeTrail = ref<Trail | null>(null);
const runnerOpen = ref(false);

function openTrail(id: string) {
	const trail = trails.value.find((t) => t.id === id) ?? null;
	if (!trail) return;
	activeTrail.value = trail;
	runnerOpen.value = true;
}

onMounted(async () => {
	loading.value = true;
	try {
		await fetchTrails();
		if (user.value?.id) await fetchNatureMinutes();
	} finally {
		loading.value = false;
	}
});
</script>
