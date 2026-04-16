<template>
	<div
		v-if="user !== undefined"
		class="flex flex-col items-center px-8"
	>
		<div class="flex mt-8">
			<h1
				id="quests-title"
				class="text-3xl font-bold"
			>
				Quests
			</h1>
			<UButton
				icon="mdi:progress-question"
				color="secondary"
				variant="subtle"
				class="ml-2"
				@click="startTour('quests')"
			/>
		</div>
		<span class="text-base opacity-90">Track your progress and earn rewards!</span>
		<div
			v-if="quest?.quest"
			class="flex flex-col items-center"
		>
			<h2 class="text-xl mt-8 mb-4">Current Quest</h2>
			<LazyUserQuestThumbnail
				id="current-quest"
				:quest="quest.quest"
				:progress="quest.progress"
				:current="true"
			/>
		</div>

		<h2 class="text-xl mt-8">All Quests</h2>
		<span
			v-if="quests && quests.length > 0"
			class="text-base opacity-80"
			>{{ quests.length }} Total</span
		>
		<div
			v-if="quests && quests.length > 0"
			class="grid grid-cols-2 lg:grid-cols-3 gap-4 pt-4"
		>
			<LazyUserQuestThumbnail
				v-for="(q, i) in quests"
				:id="`quest-${i}`"
				:key="q.id"
				:quest="q"
				:progress="questHistory.get(q.id)?.progress"
				:completedAt="questHistory.get(q.id)?.completedAt"
				hydrate-on-visible
			/>
		</div>
		<Loading v-else-if="quests === null" />
		<span
			v-else
			class="text-base opacity-60 mt-4"
			>No quests available.</span
		>
	</div>
	<Loading v-else />

	<ClientOnly>
		<SiteTour
			:steps="questTour"
			name="Quests Tour"
			tour-id="quests"
		/>
	</ClientOnly>
</template>

<script setup lang="ts">
const { user } = useAuth();
const { quests, fetchQuests } = useQuests();
const { quest, fetchQuest, questHistory, fetchQuestHistory } = useUser(user.value?.id || '');

watch(
	() => user.value,
	(newUser) => {
		if (newUser) {
			fetchQuests();
			fetchQuest();
			fetchQuestHistory();
		} else if (newUser === null) {
			navigateTo('/login');
		}
	},
	{ immediate: true }
);

// quest tours
const { startTour } = useSiteTour();
const questTour: SiteTourStep[] = [
	{
		id: 'quests-title',
		title: 'Welcome to Quests!',
		description:
			'Quests are a way to track your progress and earn rewards as you explore The Earth App and its activities.',
		footer: 'Click "Next" to learn how to use quests and start your journey!'
	},
	{
		id: 'quest-1',
		title: 'Your Quests',
		description:
			'By clicking on a quest, you can look through the steps you need to complete it. Read Articles, Sort Items, Take Pictures, Record Yourself, and more to complete quests and earn rewards!',
		footer: 'Complete quests to earn rewards and show off your progress on your profile!'
	}
];
</script>
