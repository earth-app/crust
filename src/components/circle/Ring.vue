<template>
	<div class="flex flex-col items-center gap-3">
		<div
			class="relative"
			:style="{ width: `${size}px`, height: `${size}px` }"
		>
			<svg
				:width="size"
				:height="size"
				:viewBox="`0 0 ${size} ${size}`"
				class="-rotate-90"
			>
				<circle
					:cx="center"
					:cy="center"
					:r="radius"
					fill="none"
					class="stroke-default/60"
					:stroke-width="strokeWidth"
				/>
				<circle
					v-for="seg in segments"
					:key="seg.uid"
					:cx="center"
					:cy="center"
					:r="radius"
					fill="none"
					stroke-linecap="round"
					:stroke="seg.color"
					:stroke-width="strokeWidth"
					:stroke-dasharray="`${seg.length} ${circumference}`"
					:stroke-dashoffset="-seg.offset"
					class="transition-[stroke-dasharray,stroke-dashoffset] duration-700 ease-out"
				/>
			</svg>
			<div class="absolute inset-0 flex flex-col items-center justify-center text-center">
				<span class="text-3xl font-bold tabular-nums">{{ percentLabel }}%</span>
				<span class="text-xs text-muted">of {{ goalMeta.label }}</span>
			</div>
		</div>
		<p class="text-sm text-muted">
			<span class="font-semibold text-default">{{ remaining.toLocaleString() }}</span>
			{{ goalMeta.unit }} to Grow Together
		</p>
	</div>
</template>

<script setup lang="ts">
// shared-goal ring: the combined progress toward the expedition target, split into
// per-member contribution segments (contribution, never a rank or position)
const props = withDefaults(
	defineProps<{
		expedition: Expedition;
		size?: number;
		strokeWidth?: number;
	}>(),
	{ size: 176, strokeWidth: 14 }
);

const center = computed(() => props.size / 2);
const radius = computed(() => props.size / 2 - props.strokeWidth);
const circumference = computed(() => 2 * Math.PI * radius.value);

const goalMeta = computed(() => EXPEDITION_GOAL_META[props.expedition.goal]);
const percentLabel = computed(() => Math.round(expeditionPercent(props.expedition) * 100));
const remaining = computed(() => expeditionRemaining(props.expedition));

// stack each contributor's arc proportional to their contribution; cap the total at the
// filled fraction so an over-target circle never overruns the ring
const segments = computed(() => {
	const exp = props.expedition;
	const target = exp.target > 0 ? exp.target : 1;
	const filled = expeditionPercent(exp) * circumference.value;
	let offset = 0;
	const out: { uid: string; color: string; length: number; offset: number }[] = [];
	for (const c of orderedContributors(exp)) {
		if (offset >= filled) break;
		const raw = (Math.max(0, c.contribution) / target) * circumference.value;
		const length = Math.max(0, Math.min(raw, filled - offset));
		if (length <= 0) continue;
		out.push({ uid: c.uid, color: contributorColor(c.uid), length, offset });
		offset += length;
	}
	return out;
});
</script>
