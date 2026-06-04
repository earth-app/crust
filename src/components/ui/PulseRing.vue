<template>
	<span
		:class="[
			'relative inline-flex',
			active && !prefersReducedMotion ? 'after:animate-[pulse-ring_1.4s_ease-out_infinite]' : ''
		]"
	>
		<slot />
		<span
			v-if="active && !prefersReducedMotion"
			aria-hidden="true"
			:class="[
				'pointer-events-none absolute inset-0 rounded-[inherit] ring-2 opacity-0',
				colorClass,
				'animate-[pulse-ring_1.4s_ease-out_infinite]'
			]"
		/>
	</span>
</template>

<script setup lang="ts">
type Color = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error';

const props = withDefaults(
	defineProps<{
		active?: boolean;
		color?: Color;
	}>(),
	{ active: true, color: 'primary' }
);

const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

const colorClass = computed(() => {
	switch (props.color) {
		case 'secondary':
			return 'ring-secondary/60';
		case 'success':
			return 'ring-success/60';
		case 'info':
			return 'ring-info/60';
		case 'warning':
			return 'ring-warning/60';
		case 'error':
			return 'ring-error/60';
		default:
			return 'ring-primary/60';
	}
});
</script>

<style>
/* keyframe must be unscoped — the template references it via tailwind's
   arbitrary `animate-[pulse-ring_...]` which doesn't get rewritten by scoped css */
@keyframes pulse-ring {
	0% {
		opacity: 0.85;
		transform: scale(1);
	}
	80% {
		opacity: 0;
		transform: scale(1.35);
	}
	100% {
		opacity: 0;
		transform: scale(1.4);
	}
}
</style>
