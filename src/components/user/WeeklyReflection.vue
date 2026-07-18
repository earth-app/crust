<template>
	<div class="w-full rounded-xl border border-default bg-elevated/50 p-4 sm:p-5">
		<div class="flex items-center justify-between mb-3">
			<div class="flex items-center gap-2">
				<UIcon
					name="mdi:calendar-heart"
					class="size-5 text-primary"
				/>
				<h2 class="text-base sm:text-lg font-semibold">Your Week</h2>
			</div>
			<span class="text-xs opacity-60">A Quiet Look Back</span>
		</div>

		<div class="grid grid-cols-3 gap-2 sm:gap-3">
			<div
				v-for="stat in stats"
				:key="stat.label"
				class="flex flex-col items-center justify-center text-center rounded-lg bg-default/60 py-3 px-1"
			>
				<UIcon
					:name="stat.icon"
					class="size-5 mb-1"
					:class="stat.color"
				/>
				<UiCountUp
					:value="stat.value"
					:duration="700"
					class="text-2xl sm:text-3xl font-bold leading-none"
				/>
				<span class="mt-1 text-[11px] sm:text-xs opacity-70 leading-tight">{{ stat.label }}</span>
			</div>
		</div>

		<p class="mt-4 text-sm text-center text-muted italic">{{ summaryLine }}</p>

		<NuxtLink
			to="/trails"
			class="mt-4 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary-500/10 hover:bg-primary-500/20 text-primary-600 dark:text-primary-300 text-sm font-medium transition-colors"
		>
			<UIcon
				name="mdi:pine-tree"
				class="size-4"
			/>
			<span>Add to Next Week Outside</span>
		</NuxtLink>
	</div>
</template>

<script setup lang="ts">
const { minutesOutside, questsDone, curiosityTouched, summaryLine, refresh } =
	useWeeklyReflection();
const { fetchNatureMinutes } = useTrails();

const stats = computed(() => [
	{
		label: 'Minutes Outside',
		value: minutesOutside.value,
		icon: 'mdi:pine-tree',
		color: 'text-emerald-500'
	},
	{
		label: 'Quests & Trails',
		value: questsDone.value,
		icon: 'mdi:flag-checkered',
		color: 'text-primary'
	},
	{
		label: 'Moments of Wonder',
		value: curiosityTouched.value,
		icon: 'mdi:star-four-points-outline',
		color: 'text-amber-500'
	}
]);

onMounted(() => {
	refresh();

	// self-only surface; safe to pull the user's nature minutes client-side
	void fetchNatureMinutes();
});
</script>
