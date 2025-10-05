<template>
	<div
		v-if="prompt"
		class="flex flex-row items-center justify-between w-full"
	>
		<PromptPage :prompt="prompt" />
	</div>
	<div
		v-else
		class="flex flex-col items-center justify-center h-screen w-screen"
	>
		<p class="text-gray-600">Prompt doesn't exist. Maybe look at the URL again?</p>
	</div>
</template>

<script setup lang="ts">
import { usePrompt } from '~/compostables/usePrompt';
import { useTitleSuffix } from '~/compostables/useTitleSuffix';

const { setTitleSuffix } = useTitleSuffix();
const route = useRoute();
const { prompt } = usePrompt(route.params.id as string);
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
