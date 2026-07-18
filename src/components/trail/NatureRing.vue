<template>
	<div
		class="flex items-center gap-3"
		:class="compact ? '' : 'flex-col text-center'"
	>
		<div
			class="relative shrink-0"
			:style="{ width: `${size}px`, height: `${size}px` }"
		>
			<svg
				:viewBox="`0 0 100 100`"
				class="w-full h-full"
				role="img"
				:aria-label="`${roundedMinutes} of ${target} Nature Minutes this week`"
			>
				<circle
					cx="50"
					cy="50"
					:r="radius"
					fill="none"
					class="text-neutral-200 dark:text-neutral-800"
					stroke="currentColor"
					:stroke-width="stroke"
				/>
				<circle
					cx="50"
					cy="50"
					:r="radius"
					fill="none"
					transform="rotate(-90 50 50)"
					class="text-primary transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
					stroke="currentColor"
					:stroke-width="stroke"
					stroke-linecap="round"
					:stroke-dasharray="circumference"
					:stroke-dashoffset="dashOffset"
				/>
				<circle
					v-if="showBestMarker"
					:cx="bestMarker.x"
					:cy="bestMarker.y"
					:r="stroke / 2.2"
					class="text-warning"
					fill="currentColor"
				/>
			</svg>
			<div class="absolute inset-0 flex flex-col items-center justify-center">
				<UiCountUp
					:value="roundedMinutes"
					class="font-semibold leading-none"
					:class="compact ? 'text-sm' : 'text-2xl'"
				/>
				<span
					v-if="!compact"
					class="text-[0.65rem] uppercase tracking-wide opacity-60"
					>of {{ target }}</span
				>
			</div>
		</div>

		<div :class="compact ? 'flex flex-col' : 'flex flex-col items-center gap-0.5'">
			<span
				class="font-medium"
				:class="compact ? 'text-xs' : 'text-sm'"
				>{{ label }}</span
			>
			<span
				v-if="framing.isNewBest && roundedMinutes > 0"
				class="text-xs font-semibold text-amber-600 dark:text-amber-400"
				>Your Longest Yet</span
			>
			<span
				v-else-if="best > 0"
				class="text-xs opacity-70"
				>Personal Best: {{ best }} min</span
			>
			<span
				v-else-if="!compact"
				class="text-xs opacity-70"
				>Personal, Never Compared</span
			>
		</div>
	</div>
</template>

<script setup lang="ts">
const props = withDefaults(
	defineProps<{
		minutes: number;
		target?: number;
		best?: number;
		label?: string;
		size?: number;
		compact?: boolean;
	}>(),
	{ target: 120, best: 0, label: 'Nature Minutes', size: 88, compact: false }
);

const radius = 42;
const stroke = 8;
const circumference = 2 * Math.PI * radius;

const roundedMinutes = computed(() => Math.max(0, Math.round(props.minutes)));
const pct = computed(() =>
	props.target > 0 ? Math.min(1, Math.max(0, roundedMinutes.value / props.target)) : 0
);
const dashOffset = computed(() => circumference * (1 - pct.value));

// self-referential framing; "your longest yet" replaces the best line at a new high
const framing = computed(() =>
	personalBestFraming(roundedMinutes.value, props.best, { unit: 'min' })
);

// only show the personal-best tick once it exceeds this week's minutes (a gentle target)
const showBestMarker = computed(
	() => props.best > 0 && props.best > roundedMinutes.value && props.best <= props.target
);
const bestMarker = computed(() => {
	const f = props.target > 0 ? Math.min(1, props.best / props.target) : 0;
	const angle = -90 + 360 * f;
	const rad = (angle * Math.PI) / 180;
	return { x: 50 + radius * Math.cos(rad), y: 50 + radius * Math.sin(rad) };
});
</script>
