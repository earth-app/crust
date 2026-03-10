<template>
	<div class="flex flex-col w-full select-none gap-3">
		<div
			v-if="phase === 'countdown'"
			class="flex items-center justify-center min-h-80"
		>
			<svg
				v-if="props.disabled"
				viewBox="0 0 100 100"
				class="size-32"
				xmlns="http://www.w3.org/2000/svg"
			>
				<line
					x1="10"
					y1="10"
					x2="90"
					y2="90"
					stroke="rgb(239 68 68)"
					stroke-width="10"
					stroke-linecap="round"
				/>
				<line
					x1="90"
					y1="10"
					x2="10"
					y2="90"
					stroke="rgb(239 68 68)"
					stroke-width="10"
					stroke-linecap="round"
				/>
			</svg>
			<span
				v-else
				class="text-8xl font-bold text-primary tabular-nums"
				>{{ countdown }}</span
			>
		</div>

		<template v-else-if="phase === 'playing'">
			<div class="flex items-center gap-2">
				<span class="text-xs font-mono tabular-nums w-6">{{ timeLeft }}s</span>
				<div class="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
					<div
						class="h-full bg-primary rounded-full transition-all duration-1000"
						:style="{ width: `${(timeLeft / 60) * 100}%` }"
					/>
				</div>
			</div>
			<div class="grid grid-cols-2 gap-2">
				<button
					v-for="card in cards"
					:key="card.id"
					class="p-3 rounded-xl border-2 text-sm font-medium text-center transition-all duration-150 min-h-14 cursor-grab active:cursor-grabbing"
					:class="cardClass(card)"
					:disabled="card.matched || props.disabled"
					draggable="true"
					@dragstart="onDragStart(card)"
					@dragend="draggingCard = null"
					@dragover.prevent
					@drop.prevent="onDrop(card)"
					@click="selectCard(card)"
				>
					{{ card.text }}
				</button>
			</div>
		</template>

		<div
			v-else-if="phase === 'win'"
			class="flex flex-col items-center gap-4 py-12"
		>
			<UIcon
				name="i-lucide-trophy"
				class="size-16 text-success"
			/>
			<h3 class="text-xl font-bold">All Matched!</h3>
			<p class="text-sm text-neutral-400">Completed in {{ 60 - timeLeft }}s</p>
		</div>

		<div
			v-else-if="phase === 'lose'"
			class="flex flex-col items-center gap-4 py-12"
		>
			<UIcon
				name="i-lucide-timer-off"
				class="size-14 text-red-400"
			/>
			<h3 class="text-xl font-bold text-red-400">Time's up!</h3>
			<p class="text-sm text-neutral-400">
				{{ cards.filter((c) => !c.matched).length / 2 }} pair(s) remaining.
			</p>
			<button
				class="mt-2 px-6 py-2 rounded-xl border border-neutral-700 bg-neutral-900 text-white text-sm font-medium active:scale-95 transition-transform"
				@click="init"
			>
				Try Again
			</button>
		</div>
	</div>
</template>

<script setup lang="ts">
interface Card {
	id: string;
	text: string;
	pairId: number;
	side: 'left' | 'right';
	matched: boolean;
}

type Phase = 'countdown' | 'playing' | 'win' | 'lose';

const props = defineProps<{
	step: QuestStep & {
		icon: string;
		completed: boolean;
		index: number;
		altIndex?: number;
		isCurrentQuest: boolean;
	};
	disabled?: boolean;
}>();

const emit = defineEmits<{ submitted: [] }>();

const { user } = useAuth();
const { updateQuest } = useUser(user.value?.id || '');
const { lat, lng } = useGeolocation();

const phase = ref<Phase>('countdown');
const countdown = ref(3);
const timeLeft = ref(60);
const cards = ref<Card[]>([]);
const selected = ref<Card | null>(null);
const shaking = ref<string | null>(null);
const draggingCard = ref<Card | null>(null);

let timerInterval: ReturnType<typeof setInterval> | null = null;
let cdInterval: ReturnType<typeof setInterval> | null = null;

function shuffle<T>(arr: T[]): T[] {
	return [...arr].sort(() => Math.random() - 0.5);
}

function init() {
	if (cdInterval) {
		clearInterval(cdInterval);
		cdInterval = null;
	}
	if (timerInterval) {
		clearInterval(timerInterval);
		timerInterval = null;
	}

	const params = props.step.parameters as [string, [string, string][]] | undefined;
	if (!params || !Array.isArray(params[1])) return;
	const pairs = params[1];

	const left: Card[] = pairs.map(([term], i) => ({
		id: `L${i}`,
		text: term,
		pairId: i,
		side: 'left',
		matched: false
	}));
	const right: Card[] = pairs.map(([, def], i) => ({
		id: `R${i}`,
		text: def,
		pairId: i,
		side: 'right',
		matched: false
	}));
	cards.value = shuffle([...left, ...right]);
	selected.value = null;
	timeLeft.value = 60;
	phase.value = 'countdown';
	countdown.value = 3;

	if (props.disabled) return;

	cdInterval = setInterval(() => {
		countdown.value--;
		if (countdown.value <= 0) {
			clearInterval(cdInterval!);
			cdInterval = null;
			phase.value = 'playing';
			startTimer();
		}
	}, 1000);
}

function startTimer() {
	if (timerInterval) clearInterval(timerInterval);
	timerInterval = setInterval(() => {
		timeLeft.value--;
		if (timeLeft.value <= 0) {
			clearInterval(timerInterval!);
			phase.value = 'lose';
		}
	}, 1000);
}

function cardClass(card: Card) {
	if (card.matched) return 'border-success/30 bg-success/10 text-success/50 cursor-default';
	if (props.disabled)
		return 'border-neutral-800 bg-neutral-900/40 text-neutral-600 cursor-not-allowed opacity-50';
	if (shaking.value?.split(',').includes(card.id))
		return 'border-red-500 bg-red-500/10 text-red-300 animate-shake';
	if (selected.value?.id === card.id) return 'border-primary bg-primary/20 text-white scale-[1.03]';
	return 'border-neutral-700 bg-neutral-900/60 text-neutral-200 active:scale-95';
}

function onDragStart(card: Card) {
	if (card.matched || props.disabled) return;
	draggingCard.value = card;
	selected.value = null;
}

function onDrop(target: Card) {
	const src = draggingCard.value;
	draggingCard.value = null;
	if (!src || src.id === target.id || target.matched || src.matched) return;
	if (src.pairId === target.pairId && src.side !== target.side) {
		const a = src.id,
			b = target.id;
		setTimeout(() => {
			cards.value = cards.value.map((c) =>
				c.id === a || c.id === b ? { ...c, matched: true } : c
			);
			if (cards.value.every((c) => c.matched)) {
				clearInterval(timerInterval!);
				phase.value = 'win';
				sendUpdate();
			}
		}, 150);
	} else {
		shaking.value = [src.id, target.id].join(',');
		setTimeout(() => {
			shaking.value = null;
		}, 480);
	}
}

function selectCard(card: Card) {
	if (card.matched || shaking.value || props.disabled) return;
	if (!selected.value) {
		selected.value = card;
		return;
	}
	if (selected.value.id === card.id) {
		selected.value = null;
		return;
	}

	if (selected.value.pairId === card.pairId && selected.value.side !== card.side) {
		const a = selected.value.id,
			b = card.id;
		selected.value = null;
		setTimeout(() => {
			cards.value = cards.value.map((c) =>
				c.id === a || c.id === b ? { ...c, matched: true } : c
			);
			if (cards.value.every((c) => c.matched)) {
				clearInterval(timerInterval!);
				phase.value = 'win';
				sendUpdate();
			}
		}, 150);
	} else {
		const wrongIds = [selected.value.id, card.id];
		shaking.value = wrongIds.join(',');
		selected.value = null;
		setTimeout(() => {
			shaking.value = null;
		}, 480);
	}
}

async function sendUpdate() {
	if (props.disabled) {
		emit('submitted');
		return;
	}
	await updateQuest(
		{
			type: props.step.type,
			index: props.step.index,
			...(props.step.altIndex !== undefined ? { altIndex: props.step.altIndex } : {})
		},
		lat.value,
		lng.value
	).catch(() => {});
	await new Promise((r) => setTimeout(r, 800));
	emit('submitted');
}

onMounted(init);

onBeforeUnmount(() => {
	if (cdInterval) clearInterval(cdInterval);
	if (timerInterval) clearInterval(timerInterval);
});
</script>

<style scoped>
@keyframes shake {
	0%,
	100% {
		transform: translateX(0);
	}
	20% {
		transform: translateX(-8px);
	}
	40% {
		transform: translateX(8px);
	}
	60% {
		transform: translateX(-5px);
	}
	80% {
		transform: translateX(5px);
	}
}
.animate-shake {
	animation: shake 0.45s ease-in-out;
}
</style>
