<template>
	<ClientOnly>
		<UButton
			:icon="iconForMode"
			color="neutral"
			variant="subtle"
			size="md"
			:aria-label="ariaLabel"
			:title="ariaLabel"
			class="rounded-full"
			@click="cycle"
		/>
	</ClientOnly>
</template>

<script setup lang="ts">
// three-way cycle: system → light → dark → system. The cycle (not a binary toggle)
// lets users opt back into "follow OS" without manually flipping at sunset.
const colorMode = useColorMode();

const cycle = () => {
	const next =
		colorMode.preference === 'system'
			? 'light'
			: colorMode.preference === 'light'
				? 'dark'
				: 'system';
	colorMode.preference = next;
};

const iconForMode = computed(() => {
	if (colorMode.preference === 'system') return 'mdi:theme-light-dark';
	if (colorMode.preference === 'light') return 'mdi:weather-sunny';
	return 'mdi:weather-night';
});

const ariaLabel = computed(() => {
	if (colorMode.preference === 'system') return 'Theme: follows system. Click for light mode.';
	if (colorMode.preference === 'light') return 'Theme: light. Click for dark mode.';
	return 'Theme: dark. Click for system default.';
});
</script>
