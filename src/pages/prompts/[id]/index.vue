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
const { prompt, fetch } = usePrompt(route.params.id as string);

// Force fetch on mount to ensure fresh data on page refresh
onMounted(() => {
	fetch();
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
