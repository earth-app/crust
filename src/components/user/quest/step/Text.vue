<template>
	<div class="flex flex-col w-full! gap-4! select-none! touch-none!">
		<textarea
			v-model="text"
			:disabled="props.disabled"
			class="w-full! min-h-32! p-3! rounded-xl! border-2! text-sm! font-medium! text-center! transition-all duration-150 resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50!"
			placeholder="Type your answer here..."
		/>

		<button
			class="mt-4! px-5! py-2! rounded-xl! font-semibold! text-sm! transition-all!"
			:class="
				props.disabled
					? 'bg-success/30 text-neutral-600 cursor-not-allowed'
					: 'bg-success text-neutral-900 active:scale-95 cursor-pointer'
			"
			:disabled="props.disabled || !text.trim()"
			@click="$emit('capture', text.trim())"
		>
			Submit
		</button>
	</div>
</template>

<script setup lang="ts">
const props = defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{ capture: [text: string] }>();
const text = ref('');
</script>
