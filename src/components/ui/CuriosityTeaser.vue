<template>
	<span
		v-if="gap.teaser"
		class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
		:class="pillClass"
	>
		<UIcon
			:name="icon"
			class="size-3.5"
			:class="glow"
		/>
		<span>{{ gap.teaser }}</span>
	</span>
</template>

<script setup lang="ts">
const props = withDefaults(
	defineProps<{
		revealed: number;
		total: number;
		noun?: string;
		icon?: string;
	}>(),
	{ noun: 'Discovery', icon: 'mdi:help-circle-outline' }
);

const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

const gap = computed(() => curiosityGap(props.revealed, props.total, { noun: props.noun }));

const pillClass = computed(() => {
	if (gap.value.complete) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300';
	// the last payoff gets the warmest color to pull the user in
	if (gap.value.oneAway) return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
	return 'bg-primary/10 text-primary';
});

// gentle pulse only on the strongest pull, and only when motion is allowed
const glow = computed(() =>
	gap.value.oneAway && !prefersReducedMotion.value ? 'motion-safe:animate-pulse' : ''
);
</script>
