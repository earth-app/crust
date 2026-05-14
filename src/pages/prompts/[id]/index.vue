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
const { user, tapCurrentJourney } = useAuth();
const { prompt, fetch } = usePrompt(route.params.id as string);
const journeyTrackedPromptId = ref<string | null>(null);
const journeyTrackingPromptId = ref<string | null>(null);

onMounted(async () => {
	// Force fetch on mount to ensure fresh data on page refresh
	await fetch();
});

watch(
	[() => prompt.value, () => user.value] as const,
	async ([currentPrompt, currentUser]) => {
		if (!currentPrompt || !currentUser) return;

		const promptId = currentPrompt.id;
		if (journeyTrackedPromptId.value === promptId || journeyTrackingPromptId.value === promptId) {
			return;
		}

		journeyTrackingPromptId.value = promptId;
		try {
			const res = await tapCurrentJourney('prompt');
			if (!res.success || !res.data || 'message' in res.data) return;

			journeyTrackedPromptId.value = promptId;
			if (!res.data.incremented) return;

			const journeyCount = res.data.count > 0 ? res.data.count : null;

			toast.add({
				title: 'Journey Updated',
				description: journeyCount
					? `You have now read ${journeyCount} prompts on your journey streak. Keep going!`
					: 'Your prompt journey has been updated. Keep going!',
				icon: 'game-icons:horizon-road',
				color: 'success',
				duration: 5000
			});
		} finally {
			if (journeyTrackingPromptId.value === promptId) {
				journeyTrackingPromptId.value = null;
			}
		}
	},
	{ immediate: true }
);

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

// prompts read time tracking

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
</script>
