<template>
	<div class="container px-6 py-4">
		<PromptCreateMenu @prompt-created="moveToPrompt" />
	</div>
</template>

<script setup lang="ts">
import type { Prompt } from '~/shared/types/prompts';

const router = useRouter();

function moveToPrompt(prompt: Prompt) {
	router.push(`/prompts/${prompt.id}`);
}
</script>
