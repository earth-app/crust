<template>
	<span :class="['relative inline-flex', active && !prefersReducedMotion ? 'pulse-ring-host' : '']">
		<slot />
		<span
			v-if="active && !prefersReducedMotion"
			aria-hidden="true"
			:class="[
				'pulse-ring-anim pointer-events-none absolute inset-0 rounded-[inherit] ring-2',
				colorClass
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

<style scoped>
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

.pulse-ring-anim {
	opacity: 0;
	animation: pulse-ring 1.4s ease-out infinite;
}

@media (prefers-reduced-motion: reduce) {
	.pulse-ring-anim {
		animation: none;
	}
}
</style>
