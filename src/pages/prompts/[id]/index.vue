<template>
	<div
		v-if="currentPrompt"
		class="flex flex-row items-center justify-between w-full"
	>
		<PromptPage :prompt="currentPrompt" />
	</div>
	<div
		v-else
		class="flex flex-col items-center justify-center h-screen"
	>
		<p class="text-gray-600">Prompt doesn't exist. Maybe look at the URL again?</p>
	</div>
</template>

<script setup lang="ts">
import { getPrompt } from '~/compostables/usePrompt';
import { useTitleSuffix } from '~/compostables/useTitleSuffix';
import type { Prompt } from '~/shared/types/prompts';

const { setTitleSuffix } = useTitleSuffix();
const route = useRoute();
const currentPrompt = ref<Prompt | null>(null);

if (route.params.id) {
	const res = await getPrompt(route.params.id as string);

	if (res.success && res.data) {
		currentPrompt.value = res.data;
		setTitleSuffix(`Prompt | ${currentPrompt.value.prompt}`);
	} else {
		currentPrompt.value = null;
		setTitleSuffix('Prompt');
	}
}
</script>
