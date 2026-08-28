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
				:aria-label="`${roundedMinutes} Nature Minutes this week`"
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
					>min</span
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
				class="text-xs font-semibold e-text-warning"
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
		best?: number;
		label?: string;
		size?: number;
		compact?: boolean;
	}>(),
	{ best: 0, label: 'Nature Minutes', size: 88, compact: false }
);

// arbitrary ring scale for a first week with no record yet, deliberately local: the server's
// `target` is 120 min/week, and a figure a user could read as advice does not belong in a
// component the user looks at
const FIRST_WEEK_SCALE = 60;

const radius = 42;
const stroke = 8;
const circumference = 2 * Math.PI * radius;

const roundedMinutes = computed(() => Math.max(0, Math.round(props.minutes)));

// the ring fills against your own best week; nothing else scales it
const scale = computed(() => (props.best > 0 ? props.best : FIRST_WEEK_SCALE));
const pct = computed(() => Math.min(1, Math.max(0, roundedMinutes.value / scale.value)));
const dashOffset = computed(() => circumference * (1 - pct.value));

// self-referential framing; "your longest yet" replaces the best line at a new high
const framing = computed(() =>
	personalBestFraming(roundedMinutes.value, props.best, { unit: 'min' })
);
</script>
