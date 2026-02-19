<template>
	<div class="flex justify-center">
		<UBadge
			:color="color"
			class="flex justify-center aspect-square! text-3xl font-bold rounded-full border-4 border-current/30"
			>{{ letter }}<span class="text-lg self-start -ml-1">{{ symbol }}</span></UBadge
		>
		<UBadge
			variant="soft"
			color="neutral"
			class="ml-4 text-lg font-medium"
			>{{ score100 }}%</UBadge
		>
	</div>
</template>

<script setup lang="ts">
const props = defineProps<{
	score: number; // 0.0 - 1.0
}>();

const score100 = computed(() => Math.round(props.score * 10000) / 100.0);

const color = computed(() => {
	if (score100.value >= 90) return 'primary';
	if (score100.value >= 80) return 'secondary';
	if (score100.value >= 70) return 'info';
	if (score100.value >= 60) return 'warning';
	return 'error';
});

const letter = computed(() => {
	if (score100.value >= 90) return 'A';
	if (score100.value >= 80) return 'B';
	if (score100.value >= 70) return 'C';
	if (score100.value >= 60) return 'D';
	return 'F';
});

const symbol = computed(() => {
	const decimal = score100.value % 10;
	if (decimal >= 7) return '+';
	if (decimal <= 3) return '-';
	return '';
});
</script>
