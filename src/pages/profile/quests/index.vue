<template>
	<div
		v-if="user !== undefined"
		class="flex flex-col items-center px-8"
	>
		<h1 class="mt-8 text-3xl font-bold">Quests</h1>
		<span class="text-base opacity-90">Track your progress and earn rewards!</span>
		<div
			v-if="quest?.quest"
			class="flex flex-col items-center"
		>
			<h2 class="text-xl mt-8 mb-4">Current Quest</h2>
			<LazyUserQuestThumbnail
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
				v-for="q in quests"
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
</script>
