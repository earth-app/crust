<template>
	<span class="tabular-nums">{{ prefix }}{{ formatted }}{{ suffix }}</span>
</template>

<script setup lang="ts">
const props = withDefaults(
	defineProps<{
		value: number;
		duration?: number;
		prefix?: string;
		suffix?: string;
		decimals?: number;
	}>(),
	{ duration: 900, prefix: '', suffix: '', decimals: 0 }
);

const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
const current = ref(0);
let raf: number | null = null;
let teardown: (() => void) | null = null;

const formatted = computed(() => current.value.toFixed(props.decimals));

function animate(from: number, to: number) {
	if (teardown) teardown();
	if (prefersReducedMotion.value || !import.meta.client) {
		current.value = to;
		return;
	}
	const start = performance.now();
	const delta = to - from;
	const tick = (now: number) => {
		const t = Math.min(1, (now - start) / props.duration);
		const eased = 1 - Math.pow(1 - t, 3);
		current.value = from + delta * eased;
		if (t < 1) {
			raf = requestAnimationFrame(tick);
		} else {
			current.value = to;
		}
	};
	raf = requestAnimationFrame(tick);
	teardown = () => {
		if (raf !== null) cancelAnimationFrame(raf);
	};
}

watch(
	() => props.value,
	(newVal, oldVal) => {
		animate(oldVal ?? 0, newVal);
	}
);

onMounted(() => {
	animate(0, props.value);
});

onBeforeUnmount(() => {
	if (teardown) teardown();
});
</script>
