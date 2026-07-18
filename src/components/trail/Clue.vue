<template>
	<div class="flex flex-col items-center text-center gap-5 py-8 px-4 max-w-xl mx-auto">
		<span class="text-xs uppercase tracking-widest opacity-60"
			>Step {{ index }} of {{ total }}</span
		>

		<div
			class="flex items-center justify-center size-16 rounded-full bg-primary/10 text-primary motion-safe:animate-pulse"
		>
			<UIcon
				name="mdi:compass-outline"
				class="size-9"
			/>
		</div>

		<div class="flex flex-col gap-2">
			<h2 class="text-lg font-semibold">A Curious Clue</h2>
			<p class="text-base opacity-90 wrap-break-word whitespace-pre-line">{{ clue }}</p>
		</div>

		<p class="text-sm opacity-60 max-w-md">
			Head out and see for yourself. The answer reveals once you finish the step.
		</p>

		<UButton
			color="primary"
			size="lg"
			icon="mdi:shoe-print"
			class="mt-1"
			@click="emit('continue')"
			>I'm Ready</UButton
		>
	</div>
</template>

<script setup lang="ts">
defineProps<{
	clue: string;
	index: number;
	total: number;
}>();

const emit = defineEmits<{
	continue: [];
}>();
</script>
