<template>
	<UCard
		variant="soft"
		class="relative min-w-72 max-w-md p-4 shadow-md rounded-xl bg-linear-to-br from-secondary/10 via-primary/5 to-transparent overflow-hidden"
	>
		<div class="flex items-center justify-between mb-3">
			<div class="flex items-center gap-2">
				<UIcon
					name="mdi:flash"
					class="size-5 text-secondary"
				/>
				<h3 class="text-sm font-semibold uppercase tracking-wide text-muted">Rapid Flash Match</h3>
			</div>
			<UBadge
				color="secondary"
				variant="soft"
				icon="mdi:timer-outline"
				>{{ formattedTime }}</UBadge
			>
		</div>
		<div
			v-if="!done"
			class="grid grid-cols-2 gap-2"
		>
			<UButton
				v-for="(item, i) in terms"
				:key="`t-${i}`"
				:color="cellColor(matchedTerms, selectedTerm, i)"
				:variant="cellVariant(matchedTerms, selectedTerm, i)"
				:disabled="matchedTerms.has(i)"
				:class="{ 'animate-shake': shakeTerm === i }"
				block
				class="justify-start text-left text-xs"
				@click="pick('term', i)"
				>{{ item.term }}</UButton
			>
			<UButton
				v-for="(item, i) in defs"
				:key="`d-${i}`"
				:color="cellColor(matchedDefs, selectedDef, i)"
				:variant="cellVariant(matchedDefs, selectedDef, i)"
				:disabled="matchedDefs.has(i)"
				:class="{ 'animate-shake': shakeDef === i }"
				block
				class="justify-start text-left text-xs"
				@click="pick('def', i)"
				>{{ item.term }}</UButton
			>
		</div>
		<div
			v-else
			class="text-center py-3"
		>
			<UIcon
				name="mdi:check-decagram"
				class="size-10 text-success mb-2"
			/>
			<p class="text-sm font-semibold">All 4 Matched in {{ formattedTime }}</p>
			<p
				v-if="questHint"
				class="text-xs text-primary mt-2"
			>
				{{ questHint }}
			</p>
		</div>
		<UiSparkleBurst
			:trigger="sparkleTrigger"
			color="success"
		/>
	</UCard>
</template>

<script setup lang="ts">
type Pair = { term: string; def: string };
const props = withDefaults(defineProps<{ pool?: Pair[]; questHint?: string }>(), {
	pool: () => DEFAULT_POOL,
	questHint: undefined
});
const emit = defineEmits<{ (event: 'complete', payload: { timeMs: number }): void }>();

const ROUND = 4;
const sparkleTrigger = ref(0);
const selectedTerm = ref<number | null>(null);
const selectedDef = ref<number | null>(null);
const matchedTerms = ref<Set<number>>(new Set());
const matchedDefs = ref<Set<number>>(new Set());
const shakeTerm = ref<number | null>(null);
const shakeDef = ref<number | null>(null);
const elapsed = ref(0);
const done = ref(false);
let startedAt = 0;
let timer: ReturnType<typeof setInterval> | null = null;

function shuffle<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j]!, a[i]!];
	}
	return a;
}

const terms = ref<Pair[]>([]);
const defs = ref<Pair[]>([]);
const formattedTime = computed(
	() => `${Math.floor(elapsed.value / 1000)}.${Math.floor((elapsed.value % 1000) / 100)}s`
);

const cellColor = (matched: Set<number>, selected: number | null, i: number) =>
	matched.has(i)
		? ('success' as const)
		: selected === i
			? ('primary' as const)
			: ('neutral' as const);
const cellVariant = (matched: Set<number>, selected: number | null, i: number) =>
	matched.has(i) || selected === i ? ('solid' as const) : ('outline' as const);

onMounted(() => {
	const round = shuffle(props.pool).slice(0, ROUND);
	terms.value = round;
	defs.value = shuffle(round);
	startedAt = performance.now();
	timer = setInterval(() => {
		elapsed.value = performance.now() - startedAt;
	}, 100);
});

onBeforeUnmount(() => {
	if (timer) clearInterval(timer);
});

function pick(kind: 'term' | 'def', i: number) {
	if (kind === 'term') {
		if (matchedTerms.value.has(i)) return;
		selectedTerm.value = i;
	} else {
		if (matchedDefs.value.has(i)) return;
		selectedDef.value = i;
	}
	if (selectedTerm.value === null || selectedDef.value === null) return;
	const t = terms.value[selectedTerm.value];
	const d = defs.value[selectedDef.value];
	if (t && d && t.def === d.def) {
		matchedTerms.value.add(selectedTerm.value);
		matchedDefs.value.add(selectedDef.value);
		sparkleTrigger.value++;
		selectedTerm.value = null;
		selectedDef.value = null;
		if (matchedTerms.value.size === ROUND) finish();
	} else {
		shakeTerm.value = selectedTerm.value;
		shakeDef.value = selectedDef.value;
		setTimeout(() => {
			shakeTerm.value = null;
			shakeDef.value = null;
			selectedTerm.value = null;
			selectedDef.value = null;
		}, 400);
	}
}

function finish() {
	done.value = true;
	if (timer) clearInterval(timer);
	emit('complete', { timeMs: Math.round(elapsed.value) });
}
</script>

<script lang="ts">
const DEFAULT_POOL = [
	{ term: 'Biome', def: 'a large ecological community' },
	{ term: 'Pollinator', def: 'moves pollen between flowers' },
	{ term: 'Watershed', def: 'land draining to one body of water' },
	{ term: 'Compost', def: 'decayed organic fertilizer' },
	{ term: 'Mycelium', def: 'underground fungal network' },
	{ term: 'Canopy', def: 'top layer of a forest' }
];
</script>

<style scoped>
@keyframes shake {
	0%,
	100% {
		transform: translateX(0);
	}
	25% {
		transform: translateX(-4px);
	}
	75% {
		transform: translateX(4px);
	}
}
.animate-shake {
	animation: shake 0.3s ease-in-out;
}
@media (prefers-reduced-motion: reduce) {
	.animate-shake {
		animation: none;
	}
}
</style>
