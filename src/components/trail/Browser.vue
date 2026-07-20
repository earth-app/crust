<template>
	<div class="flex flex-col gap-5 w-full">
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
			<div
				id="trails-header"
				class="flex flex-col"
			>
				<h2 class="text-xl font-semibold">Curiosity Trails</h2>
				<p class="text-sm opacity-70">
					One quiet outdoor practice at a time. Follow a curiosity outside, be present, and keep a
					private record of what you notice.
				</p>
			</div>

			<div class="flex items-center gap-3 shrink-0">
				<UButton
					icon="mdi:progress-question"
					color="neutral"
					variant="ghost"
					aria-label="Replay Trails Tour"
					@click="startTour('trails')"
				/>
				<UButton
					id="trail-journal-button"
					variant="soft"
					color="neutral"
					icon="mdi:book-heart-outline"
					@click="journalOpen = true"
					>Journal</UButton
				>
				<div id="nature-ring">
					<TrailNatureRing
						v-if="natureMinutes"
						:minutes="natureMinutes.minutes"
						:target="natureMinutes.target"
						:best="natureMinutes.best"
						:size="72"
					/>
				</div>
			</div>
		</div>

		<div
			id="trail-theme-filters"
			class="flex flex-wrap gap-2"
		>
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

		<div id="trail-list">
			<div
				v-if="loading && !filteredTrails.length"
				class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4"
			>
				<USkeleton
					v-for="n in 6"
					:key="n"
					class="h-40 rounded-xl"
				/>
			</div>

			<div
				v-else-if="filteredTrails.length"
				class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 w-full gap-4"
			>
				<TrailCard
					v-for="trail in filteredTrails"
					:key="trail.id"
					:trail="trail"
					@select="openTrail"
					@preview="previewTrail"
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
		</div>

		<ClientOnly>
			<SiteTour
				:steps="trailsTour"
				tour-id="trails"
				name="Curiosity Trails Tour"
				:pulse="true"
			/>
		</ClientOnly>

		<TrailRunner
			v-if="activeTrail"
			:key="activeTrail.id"
			v-model:open="runnerOpen"
			:trail="activeTrail"
			:preview="previewMode"
			@begin="previewMode = false"
		/>

		<TrailJournal v-model:open="journalOpen" />
	</div>
</template>

<script setup lang="ts">
const { trails, natureMinutes, fetchTrails, fetchNatureMinutes } = useTrails();
const { user } = useAuth();
const { startTour, startTourIfNew } = useSiteTour();

// #region tour
const trailsTour = computed<SiteTourStep[]>(() => [
	{
		id: 'trails-header',
		title: 'Curiosity Trails',
		description:
			'A curiosity trail is one calm outdoor practice: follow a curious clue outside, stay present for a few minutes, then keep a private reflection just for you. Every minute you spend out here feeds your Nature Minutes.',
		footer: 'One trail at a time - no streak to protect, no feed to scroll.',
		icon: 'mdi:map-marker-path',
		waitFor: 'trails-header'
	},
	{
		id: 'nature-ring',
		title: 'Your Nature Minutes',
		description:
			'This ring tracks the time you spend outdoors, gently aiming for about 120 minutes a week - the amount linked to feeling calmer and more restored. It fills as you walk trails; it never scolds you for missing a day.',
		footer: 'Time outside is the whole point, not the point total.',
		icon: 'mdi:timer-sand',
		placement: 'bottom'
	},
	{
		id: 'trail-theme-filters',
		title: 'Filter by How You Feel',
		description:
			'Pick a mood or theme - nature, curiosity, creative, reflective - and the trails reshape to match the kind of moment you want outside.',
		footer: 'There is no wrong choice; follow whatever pulls you.',
		icon: 'mdi:tune-variant'
	},
	{
		id: 'trail-list',
		title: 'Pick One That Pulls You Outside',
		description:
			'Each card is a short outdoor practice waiting for you. Choose the one that sparks a little curiosity, step out the door, and let it guide your attention.',
		footer: 'Preview a trail first if you like, then begin when you are ready.',
		icon: 'mdi:compass-outline',
		waitFor: 'trail-list',
		placement: 'top'
	},
	{
		id: 'trail-journal-button',
		title: 'Your Private Journal',
		description:
			'Every reflection you write on a trail is saved here, for your eyes only. Come back to see how your noticing has grown over time.',
		footer: 'Private by default - reflections are never shared.',
		icon: 'mdi:book-heart-outline'
	}
]);
// #endregion

const themeOptions = [
	{ value: 'all', label: 'All' },
	{ value: 'nature', label: 'Nature' },
	{ value: 'curiosity', label: 'Curiosity' },
	{ value: 'creative', label: 'Creative' },
	{ value: 'reflective', label: 'Reflective' },
	{ value: 'mixed', label: 'Mixed' }
] as const;

const activeTheme = ref<(typeof themeOptions)[number]['value']>('all');
const journalOpen = ref(false);
const loading = ref(false);

// rarity-then-alphabetical, matching the quest/badge ordering
const filteredTrails = computed(() => {
	const base =
		activeTheme.value === 'all'
			? trails.value
			: trails.value.filter((t) => t.theme === activeTheme.value);
	return sortTrailsByRarity(base);
});

const activeTrail = ref<Trail | null>(null);
const runnerOpen = ref(false);
// preview opens the runner read-only (no pledge, no writes); begin starts the real run
const previewMode = ref(false);

function open(id: string, preview: boolean) {
	const trail = trails.value.find((t) => t.id === id) ?? null;
	if (!trail) return;
	activeTrail.value = trail;
	previewMode.value = preview;
	runnerOpen.value = true;
}

function openTrail(id: string) {
	open(id, false);
}

function previewTrail(id: string) {
	open(id, true);
}

onMounted(async () => {
	loading.value = true;
	try {
		await fetchTrails();
		if (user.value?.id) await fetchNatureMinutes();
	} finally {
		loading.value = false;
	}
	startTourIfNew('trails');
});
</script>
