<template>
	<div class="flex flex-col items-center justify-center mt-4">
		<h2 class="text-2xl font-semibold mr-4">Today's Prompts</h2>
		<UButton
			title="Refresh"
			icon="i-lucide-refresh-cw"
			color="neutral"
			variant="outline"
			class="mt-2"
			:loading="promptsLoading"
			:disabled="promptsLoading"
			@click="fetchPrompts"
		/>
		<div class="mt-12 w-9/10 grid grid-cols-1 md:grid-cols-2 gap-x-8">
			<InfoCardSkeleton
				v-if="promptsLoading"
				v-for="n in 5"
				:key="n"
				content-size="xs"
				class="mb-4"
			/>
			<PromptProfile
				v-for="prompt in prompts"
				:key="prompt.id"
				:prompt="prompt"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { getRandomPrompts } from '~/compostables/usePrompt';
import { useTitleSuffix } from '~/compostables/useTitleSuffix';
import type { Prompt } from '~/shared/types/prompts';

const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Prompts');

const prompts = ref<Prompt[]>([]);
const promptsLoading = ref(false);

async function fetchPrompts() {
	promptsLoading.value = true;
	const res = await getRandomPrompts(25);
	promptsLoading.value = false;

	if (res.success && res.data) {
		prompts.value = res.data;
	} else {
		const toast = useToast();
		toast.add({
			title: 'Error',
			description: res.message || 'Failed to load prompts.',
			color: 'error',
			duration: 5000
		});

		console.error('Failed to load prompts:', res.message);
	}

	promptsLoading.value = false;
}

onMounted(async () => {
	await fetchPrompts();
});
</script>
