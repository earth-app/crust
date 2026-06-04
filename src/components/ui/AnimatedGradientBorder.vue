<template>
	<div :class="['relative rounded-[inherit]', !prefersReducedMotion && 'gradient-border-host']">
		<div
			v-if="!prefersReducedMotion"
			aria-hidden="true"
			class="gradient-border-ring"
			:style="ringStyle"
		/>
		<div class="relative rounded-[inherit] z-10">
			<slot />
		</div>
	</div>
</template>

<script setup lang="ts">
const props = withDefaults(
	defineProps<{
		speed?: number;
		thickness?: number;
		from?: string;
		via?: string;
		to?: string;
	}>(),
	{
		speed: 8,
		thickness: 2,
		from: 'var(--ui-primary, #22c55e)',
		via: 'var(--ui-secondary, #3b82f6)',
		to: 'var(--ui-info, #06b6d4)'
	}
);

const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

const ringStyle = computed(() => ({
	'--gb-from': props.from,
	'--gb-via': props.via,
	'--gb-to': props.to,
	'--gb-thickness': `${props.thickness}px`,
	'--gb-speed': `${props.speed}s`
}));
</script>

<style scoped>
@keyframes gb-spin {
	0% {
		transform: rotate(0deg);
	}
	100% {
		transform: rotate(360deg);
	}
}

.gradient-border-host {
	isolation: isolate;
}

.gradient-border-ring {
	position: absolute;
	inset: calc(var(--gb-thickness) * -1);
	border-radius: inherit;
	padding: var(--gb-thickness);
	background: conic-gradient(
		from 0deg,
		var(--gb-from),
		var(--gb-via),
		var(--gb-to),
		var(--gb-from)
	);
	-webkit-mask:
		linear-gradient(#000 0 0) content-box,
		linear-gradient(#000 0 0);
	-webkit-mask-composite: xor;
	mask:
		linear-gradient(#000 0 0) content-box,
		linear-gradient(#000 0 0);
	mask-composite: exclude;
	pointer-events: none;
	z-index: 0;
	animation: gb-spin var(--gb-speed) linear infinite;
	opacity: 0.85;
}
</style>
