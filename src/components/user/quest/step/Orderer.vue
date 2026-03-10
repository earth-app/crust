<template>
	<div class="flex flex-col w-full select-none gap-4">
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

			<p
				v-if="step.description"
				class="text-sm text-neutral-300 text-center"
			>
				{{ step.description }}
			</p>

			<div class="flex flex-col gap-1.5">
				<p class="text-xs text-neutral-500 uppercase tracking-wider">Order</p>
				<div
					v-for="(slot, i) in slots"
					:key="i"
					class="flex items-center gap-2 min-h-12 rounded-xl border-2 px-3 py-2 transition-all duration-150"
					:class="slotClass(slot, i)"
					@click="placeOrRemove(i)"
					@dragover.prevent="dragOverSlot = i"
					@dragleave="dragOverSlot = null"
					@drop.prevent="onDropSlot(i)"
				>
					<span class="text-xs text-neutral-500 w-4 shrink-0 tabular-nums">{{ i + 1 }}</span>
					<span
						v-if="slot"
						class="text-sm font-medium text-white"
						>{{ slot }}</span
					>
					<span
						v-else
						class="text-xs italic"
						:class="selectedTile || dragOverSlot === i ? 'text-primary/70' : 'text-neutral-600'"
						>{{ selectedTile || dragOverSlot === i ? 'Drop here' : 'Empty' }}</span
					>
				</div>
			</div>

			<div class="flex flex-col gap-1.5">
				<p class="text-xs text-neutral-500 uppercase tracking-wider">Items</p>
				<div class="flex flex-wrap gap-2">
					<button
						v-for="tile in bank"
						:key="tile"
						class="px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all duration-150 cursor-grab active:cursor-grabbing"
						:class="
							selectedTile === tile
								? 'border-primary bg-primary/20 text-white scale-105'
								: 'border-neutral-700 bg-neutral-900/60 text-neutral-200 active:scale-95'
						"
						draggable="true"
						@dragstart="onDragStartTile(tile)"
						@dragend="draggingTile = null"
						@click="selectTile(tile)"
					>
						{{ tile }}
					</button>
					<span
						v-if="bank.length === 0"
						class="text-xs text-neutral-600 italic py-2"
						>All placed</span
					>
				</div>
			</div>
		</template>

		<div
			v-else-if="phase === 'win'"
			class="flex flex-col items-center gap-4 py-12"
		>
			<UIcon
				name="i-lucide-list-ordered"
				class="size-16 text-success"
			/>
			<h3 class="text-xl font-bold">Correct Order!</h3>
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
			<p class="text-sm text-neutral-400">Better luck next time.</p>
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
const correctOrder = ref<string[]>([]);
const bank = ref<string[]>([]);
const slots = ref<(string | null)[]>([]);
const selectedTile = ref<string | null>(null);
const draggingTile = ref<string | null>(null);
const dragOverSlot = ref<number | null>(null);

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

	const params = props.step.parameters as [string[]] | undefined;
	if (!params || !Array.isArray(params[0])) return;
	const items = params[0];
	correctOrder.value = items;
	bank.value = shuffle([...items]);
	slots.value = Array(items.length).fill(null);
	selectedTile.value = null;
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

function slotClass(slot: string | null, i: number) {
	if (dragOverSlot.value === i) return 'border-primary border-dashed bg-primary/10 cursor-pointer';
	if (slot) return 'border-primary/50 bg-primary/10 cursor-pointer';
	if (selectedTile.value) return 'border-primary/30 border-dashed cursor-pointer';
	return 'border-neutral-800 cursor-default';
}

function selectTile(tile: string) {
	if (props.disabled) return;
	selectedTile.value = selectedTile.value === tile ? null : tile;
}

function onDragStartTile(tile: string) {
	if (props.disabled) return;
	draggingTile.value = tile;
	selectedTile.value = null;
}

function onDropSlot(slotIndex: number) {
	if (props.disabled) return;
	dragOverSlot.value = null;
	const tile = draggingTile.value;
	draggingTile.value = null;
	if (!tile) return;
	const current = slots.value[slotIndex];
	if (current) bank.value.push(current);
	slots.value[slotIndex] = tile;
	bank.value = bank.value.filter((t) => t !== tile);
	validate();
}

function placeOrRemove(slotIndex: number) {
	if (props.disabled) return;
	const current = slots.value[slotIndex];
	if (current && selectedTile.value) {
		// Swap: return current occupant to bank, place selected tile
		bank.value.push(current);
		slots.value[slotIndex] = selectedTile.value;
		bank.value = bank.value.filter((t) => t !== selectedTile.value);
		selectedTile.value = null;
		validate();
		return;
	}
	if (current) {
		bank.value.push(current);
		slots.value[slotIndex] = null;
		return;
	}
	if (!selectedTile.value) return;
	slots.value[slotIndex] = selectedTile.value;
	bank.value = bank.value.filter((t) => t !== selectedTile.value);
	selectedTile.value = null;
	validate();
}

function validate() {
	if (slots.value.some((s) => s === null)) return;
	if (slots.value.every((s, i) => s === correctOrder.value[i])) {
		clearInterval(timerInterval!);
		phase.value = 'win';
		sendUpdate();
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
