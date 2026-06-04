<template>
	<UCard
		variant="soft"
		class="relative min-w-72 max-w-md p-4 shadow-md rounded-xl bg-linear-to-br from-primary/10 via-secondary/5 to-transparent overflow-hidden"
	>
		<div class="flex items-center gap-2 mb-2">
			<UIcon
				name="mdi:poll"
				class="size-5 text-primary"
			/>
			<h3 class="text-sm font-semibold uppercase tracking-wide text-muted">Quick Poll</h3>
		</div>
		<p class="text-base font-medium mb-3">{{ question }}</p>
		<div class="flex flex-col gap-2">
			<UButton
				v-for="(option, i) in options"
				:key="`poll-${i}`"
				:variant="voted === null ? 'outline' : voted === i ? 'solid' : 'ghost'"
				:color="voted === i ? 'primary' : 'neutral'"
				:disabled="voted !== null"
				block
				class="justify-start text-left"
				@click="vote(i)"
			>
				{{ option }}
			</UButton>
		</div>
		<div
			v-if="voted !== null"
			class="mt-3 flex flex-col gap-2"
		>
			<div
				v-for="(option, i) in options"
				:key="`bar-${i}`"
				class="flex flex-col gap-1"
			>
				<div class="flex justify-between text-xs text-muted">
					<span :class="{ 'text-primary font-semibold': voted === i }">{{ option }}</span>
					<span>{{ percentages[i] }}%</span>
				</div>
				<UProgress
					:model-value="percentages[i]"
					:color="voted === i ? 'primary' : 'neutral'"
					size="sm"
				/>
			</div>
			<p
				v-if="questHint"
				class="text-xs text-primary mt-2"
			>
				{{ questHint }}
			</p>
		</div>
		<UiSparkleBurst
			:trigger="sparkleTrigger"
			color="primary"
		/>
	</UCard>
</template>

<script setup lang="ts">
const props = withDefaults(
	defineProps<{
		question?: string;
		options?: string[];
		results?: number[];
		questHint?: string;
	}>(),
	{
		question: 'Which would you choose: Plant a tree OR Walk 1 mile?',
		options: () => ['Plant a tree', 'Walk 1 mile'],
		results: undefined,
		questHint: undefined
	}
);

const emit = defineEmits<{
	(event: 'complete', payload: { outcome: number }): void;
}>();

const voted = ref<number | null>(null);
const sparkleTrigger = ref(0);

// pseudo-aggregate when no results prop supplied (stable per option set)
const pseudoResults = computed(() => {
	const n = props.options.length;
	// deterministic distribution biased toward earlier options
	const base = props.options.map((opt, i) => {
		let h = 0;
		for (let c = 0; c < opt.length; c++) h = (h * 31 + opt.charCodeAt(c)) >>> 0;
		return 20 + ((h + i * 17) % 50);
	});
	const sum = base.reduce((a, b) => a + b, 0) || 1;
	return base.map((v) => Math.round((v / sum) * 100));
});

const percentages = computed(() => {
	const source = props.results ?? pseudoResults.value;
	// bump voted option slightly so user feels their click counted
	if (voted.value === null) return source;
	const bumped = [...source];
	bumped[voted.value] = (bumped[voted.value] ?? 0) + 3;
	const total = bumped.reduce((a, b) => a + b, 0) || 1;
	return bumped.map((v) => Math.round((v / total) * 100));
});

function vote(i: number) {
	if (voted.value !== null) return;
	voted.value = i;
	sparkleTrigger.value++;
	emit('complete', { outcome: i });
}
</script>
