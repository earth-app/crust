<template>
	<div
		v-if="prompt"
		class="flex flex-row items-center justify-between w-full pt-24 sm:pt-0"
	>
		<PromptPage :prompt="prompt" />
	</div>
	<div
		v-else-if="prompt === null"
		class="flex flex-col items-center justify-center h-screen w-screen"
	>
		<p class="text-gray-600">Prompt doesn't exist. Maybe look at the URL again?</p>
	</div>
	<Loading v-else />
</template>

<script setup lang="ts">
const { setTitleSuffix } = useTitleSuffix();
const route = useRoute();
const toast = useToast();
const { user, fetchCurrentJourney, tapCurrentJourney } = useAuth();
const { prompt, fetch } = usePrompt(route.params.id as string);
const { startTimer, stopTimer } = useTimeOnPage('prompts_read_time', {
	prompt: prompt.value,
	user: user.value
});

onMounted(() => {
	if (import.meta.client) {
		startTimer();
	}
});

onUnmounted(() => {
	if (import.meta.client) {
		stopTimer();
	}
});

onMounted(async () => {
	// Force fetch on mount to ensure fresh data on page refresh
	await fetch();

	if (!prompt.value) return;
	if (!user.value) return;

	const count = await fetchCurrentJourney('prompt', user.value.id);
	if (!count.success || !count.data) return; // silently ignore errors
	if ('message' in count.data) return;

	const res = await tapCurrentJourney('prompt');
	if (!res.success || !res.data) return; // silently ignore errors
	if ('message' in res.data) return;

	if (count.data.count === res.data.count) return; // no change

	toast.add({
		title: 'Journey Updated',
		description: `You have now read ${res.data.count} prompts on your journey streak. Keep going!`,
		icon: 'game-icons:horizon-road',
		color: 'success',
		duration: 5000
	});
});

watch(
	() => prompt.value,
	(prompt) => {
		setTitleSuffix(prompt ? prompt.prompt : 'Prompt');
	}
);

useSeoMeta({
	ogTitle: prompt.value ? prompt.value.prompt : 'Prompt',
	ogDescription: prompt.value ? `${prompt.value.responses_count} Responses` : 'Prompt'
});
</script>
