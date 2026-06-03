<template>
	<div class="flex items-center justify-center min-h-80!">
		<svg
			v-if="disabled"
			viewBox="0 0 100 100"
			class="size-32"
			xmlns="http://www.w3.org/2000/svg"
		>
			<line
				x1="10"
				y1="10"
				x2="90"
				y2="90"
				stroke="rgb(239 68 68)"
				stroke-width="10"
				stroke-linecap="round"
			/>
			<line
				x1="90"
				y1="10"
				x2="10"
				y2="90"
				stroke="rgb(239 68 68)"
				stroke-width="10"
				stroke-linecap="round"
			/>
		</svg>
		<span
			v-else
			class="text-8xl font-bold text-primary tabular-nums"
			>{{ value }}</span
		>
	</div>
</template>

<script setup lang="ts">
interface Props {
	value: number;
	disabled?: boolean;
}
defineProps<Props>();
</script>
