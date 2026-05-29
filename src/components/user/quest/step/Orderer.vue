<template>
	<div class="flex flex-col w-full! select-none! gap-4!">
		<div
			v-if="phase === 'countdown'"
			class="flex items-center justify-center min-h-80!"
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
			<div class="flex items-center gap-2!">
				<span
					class="text-xs! font-mono! tabular-nums! w-8!"
					:class="lowTime ? 'text-red-400!' : ''"
					>{{ timeLeft }}s</span
				>
				<div class="flex-1! h-1.5! bg-neutral-800! rounded-full! overflow-hidden!">
					<div
						class="h-full! rounded-full! transition-all duration-1000"
						:class="lowTime ? 'bg-red-500!' : 'bg-primary!'"
						:style="{ width: `${(timeLeft / 60) * 100}%` }"
					/>
				</div>
			</div>

			<p
				v-if="step.description"
				class="text-sm! text-neutral-300! text-center!"
			>
				{{ step.description }}
			</p>

			<div class="flex flex-col gap-1.5!">
				<p class="text-xs! text-neutral-500! uppercase tracking-wider!">Items</p>
				<div
					data-bank
					class="flex flex-wrap gap-2! min-h-12! rounded-xl! border! border-dashed! border-neutral-800! p-2! transition-colors"
					:class="
						dragSource?.kind === 'slot' && dragOverBank ? 'border-primary/50 bg-primary/5' : ''
					"
				>
					<button
						v-for="tile in bank"
						:key="tile"
						class="px-3! py-2! rounded-xl! border-2! text-sm! font-medium! transition-all duration-150 cursor-grab active:cursor-grabbing! pointer-coarse:touch-none!"
						:class="
							selectedTile === tile || draggingTile === tile
								? 'border-primary bg-primary/20 text-white scale-105'
								: 'border-neutral-700 bg-neutral-900/60 text-neutral-200 active:scale-95'
						"
						@pointerdown="onTilePointerDown($event, tile, { kind: 'bank' })"
						@click.stop="selectTile(tile)"
					>
						{{ tile }}
					</button>
					<span
						v-if="bank.length === 0"
						class="text-xs! text-neutral-600! italic! py-2! px-1!"
						>All placed</span
					>
				</div>
			</div>

			<div class="flex flex-col gap-1.5!">
				<p class="text-xs! text-neutral-500! uppercase tracking-wider!">Order</p>
				<div
					v-for="(slot, i) in slots"
					:key="i"
					:data-slot-index="i"
					class="flex items-center gap-2! min-h-12! rounded-xl! border-2! px-3! py-2! transition-all duration-150 pointer-coarse:touch-none!"
					:class="slotClass(slot, i)"
					@click="onSlotClick(i)"
				>
					<span class="text-xs! text-neutral-500! w-4! shrink-0 tabular-nums!">{{ i + 1 }}</span>
					<span
						v-if="slot && !(dragSource?.kind === 'slot' && dragSource.index === i)"
						class="text-sm! font-medium! text-white! flex-1! cursor-grab active:cursor-grabbing!"
						@pointerdown="onTilePointerDown($event, slot, { kind: 'slot', index: i })"
						@click.stop
						>{{ slot }}</span
					>
					<span
						v-else
						class="text-xs! italic! flex-1"
						:class="
							selectedTile || draggingTile || dragOverSlot === i
								? 'text-primary/70'
								: 'text-neutral-600'
						"
						>{{ selectedTile || draggingTile || dragOverSlot === i ? 'Drop here' : 'Empty' }}</span
					>
				</div>
			</div>

			<Teleport
				v-if="draggingTile"
				to="body"
			>
				<div
					class="fixed pointer-events-none z-50 px-3! py-2! rounded-xl! border-2! border-primary bg-primary/30 text-white text-sm! font-medium! shadow-2xl!"
					:style="ghostStyle"
				>
					{{ draggingTile }}
				</div>
			</Teleport>
		</template>

		<div
			v-else-if="phase === 'win'"
			class="flex flex-col items-center gap-4! py-12!"
		>
			<UIcon
				name="i-lucide-list-ordered"
				class="size-16 text-success"
			/>
			<h3 class="text-xl! font-bold!">Correct Order!</h3>
			<p class="text-sm! text-neutral-400!">Completed in {{ 60 - timeLeft }}s</p>

			<div
				v-if="submitting"
				class="flex items-center gap-2! text-sm! text-neutral-400!"
			>
				<UIcon
					name="i-lucide-loader-circle"
					class="size-4 animate-spin"
				/>
				<span>Saving Progress...</span>
			</div>

			<UAlert
				v-if="submitError"
				color="error"
				variant="soft"
				icon="i-lucide-triangle-alert"
				:description="submitError"
				class="w-full mt-2"
			/>
			<button
				v-if="submitError && !submitting"
				class="mt-2! px-6! py-2! rounded-xl! border border-neutral-700 bg-neutral-900 text-white text-sm! font-medium! active:scale-95 transition-transform"
				@click="sendUpdate"
			>
				Try Again
			</button>
		</div>

		<div
			v-else-if="phase === 'lose'"
			class="flex flex-col items-center gap-4! py-12!"
		>
			<UIcon
				name="i-lucide-timer-off"
				class="size-14 text-red-400"
			/>
			<h3 class="text-xl! font-bold! text-red-400!">Time's up!</h3>
			<p class="text-sm! text-neutral-400!">Better luck next time.</p>
			<button
				class="mt-2! px-6! py-2! rounded-xl! border border-neutral-700 bg-neutral-900 text-white text-sm! font-medium! active:scale-95 transition-transform"
				@click="init"
			>
				Try Again
			</button>
		</div>
	</div>
</template>

<script setup lang="ts">
type Phase = 'countdown' | 'playing' | 'win' | 'lose';
type DragSource = { kind: 'bank' } | { kind: 'slot'; index: number };

interface Props {
	step: QuestStep & {
		icon: string;
		completed: boolean;
		index: number;
		altIndex?: number;
		isCurrentQuest: boolean;
	};
	disabled?: boolean;
	submit?: boolean;
	serverRequest?: typeof makeServerRequest;
}

const props = withDefaults(defineProps<Props>(), { submit: true });

const emit = defineEmits<{ submitted: [] }>();

const { user } = useAuth(props.serverRequest || makeServerRequest);
const userId = computed(() => user.value?.id);
const { updateQuest } = useUser(userId, props.serverRequest || makeServerRequest);
const { lat, lng } = useQuestGeolocation();

const phase = ref<Phase>('countdown');
const countdown = ref(3);
const timeLeft = ref(60);
const correctOrder = ref<string[]>([]);
const bank = ref<string[]>([]);
const slots = ref<(string | null)[]>([]);
const selectedTile = ref<string | null>(null);
const submitting = ref(false);
const submitError = ref('');

const draggingTile = ref<string | null>(null);
const dragSource = ref<DragSource | null>(null);
const dragPos = ref({ x: 0, y: 0 });
const dragOverSlot = ref<number | null>(null);
const dragOverBank = ref(false);

const lowTime = computed(() => timeLeft.value <= 10 && phase.value === 'playing');
const wrongSlots = computed(() =>
	slots.value.reduce<number[]>((acc, s, i) => {
		if (s !== null && s !== correctOrder.value[i]) acc.push(i);
		return acc;
	}, [])
);

const ghostStyle = computed(() => ({
	left: `${dragPos.value.x}px`,
	top: `${dragPos.value.y}px`,
	transform: 'translate(-50%, -50%)'
}));

const countdownTick = useIntervalFn(
	() => {
		countdown.value--;
		if (countdown.value <= 0) {
			countdownTick.pause();
			phase.value = 'playing';
			gameTick.resume();
		}
	},
	1000,
	{ immediate: false }
);

const gameTick = useIntervalFn(
	() => {
		timeLeft.value--;
		if (timeLeft.value <= 0) {
			gameTick.pause();
			phase.value = 'lose';
		}
	},
	1000,
	{ immediate: false }
);

function shuffle<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const tmp = a[i] as T;
		a[i] = a[j] as T;
		a[j] = tmp;
	}
	return a;
}

function init() {
	countdownTick.pause();
	gameTick.pause();

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
	countdownTick.resume();
}

function slotClass(slot: string | null, i: number) {
	if (slot !== null && wrongSlots.value.includes(i))
		return 'border-red-500 bg-red-500/10 text-red-300 cursor-pointer';
	if (dragOverSlot.value === i) return 'border-primary border-dashed bg-primary/10 cursor-pointer';
	if (slot) return 'border-neutral-600 bg-neutral-900/60 cursor-pointer';
	if (selectedTile.value || draggingTile.value)
		return 'border-primary/30 border-dashed cursor-pointer';
	return 'border-neutral-800 cursor-default';
}

function selectTile(tile: string) {
	if (props.disabled || draggingTile.value) return;
	selectedTile.value = selectedTile.value === tile ? null : tile;
}

function onTilePointerDown(e: PointerEvent, tile: string, source: DragSource) {
	if (props.disabled) return;
	if (phase.value !== 'playing') return;
	(e.target as Element).setPointerCapture?.(e.pointerId);
	draggingTile.value = tile;
	dragSource.value = source;
	dragPos.value = { x: e.clientX, y: e.clientY };
	selectedTile.value = null;
	e.preventDefault();
}

function onSlotClick(i: number) {
	if (props.disabled || draggingTile.value) return;
	// Click on a slot only places the currently-selected bank tile. Removing a placed tile
	// is drag-only (to bank or outside any drop zone) - keeps drag and click consistent.
	if (!selectedTile.value) return;
	const current = slots.value[i];
	if (current) bank.value.push(current);
	slots.value[i] = selectedTile.value;
	bank.value = bank.value.filter((t) => t !== selectedTile.value);
	selectedTile.value = null;
	validate();
}

function findTargetUnderPointer(clientX: number, clientY: number) {
	const under = import.meta.client ? document.elementFromPoint(clientX, clientY) : null;
	if (!under) return { slot: null as number | null, bank: false };
	const slotEl = under.closest('[data-slot-index]') as HTMLElement | null;
	if (slotEl) {
		const idx = Number(slotEl.dataset.slotIndex);
		return { slot: idx, bank: false };
	}
	const bankEl = under.closest('[data-bank]');
	if (bankEl) return { slot: null, bank: true };
	return { slot: null, bank: false };
}

const lastPointer = ref({ x: 0, y: 0 });

const SCROLL_ZONE = 90;
const SCROLL_SPEED = 14;

function findScrollableUnder(x: number, y: number): HTMLElement | Window {
	if (!import.meta.client) return window;
	let el = document.elementFromPoint(x, y) as HTMLElement | null;
	while (el && el !== document.body && el !== document.documentElement) {
		const style = getComputedStyle(el);
		if (
			(style.overflowY === 'auto' || style.overflowY === 'scroll') &&
			el.scrollHeight > el.clientHeight
		) {
			return el;
		}
		el = el.parentElement;
	}
	return window;
}

const autoScroll = useRafFn(
	() => {
		if (!draggingTile.value) return;
		const target = findScrollableUnder(lastPointer.value.x, lastPointer.value.y);
		// Compute top/bottom edges from the scrollable container so it works inside modals,
		// where viewport-based edges would never trigger near the modal's bottom.
		let topEdge: number;
		let bottomEdge: number;
		if (target === window) {
			topEdge = SCROLL_ZONE;
			bottomEdge = window.innerHeight - SCROLL_ZONE;
		} else {
			const rect = (target as HTMLElement).getBoundingClientRect();
			topEdge = rect.top + SCROLL_ZONE;
			bottomEdge = rect.bottom - SCROLL_ZONE;
		}
		const y = lastPointer.value.y;
		const direction = y < topEdge ? -1 : y > bottomEdge ? 1 : 0;
		if (direction === 0) return;
		(target as Window | HTMLElement).scrollBy({
			top: SCROLL_SPEED * direction,
			behavior: 'instant'
		});
		// Page moved under the pointer - refresh drop target.
		const dropTarget = findTargetUnderPointer(lastPointer.value.x, lastPointer.value.y);
		dragOverSlot.value = dropTarget.slot;
		dragOverBank.value = dropTarget.bank;
	},
	{ immediate: false }
);

useEventListener('pointermove', (e: PointerEvent) => {
	if (!draggingTile.value) return;
	dragPos.value = { x: e.clientX, y: e.clientY };
	lastPointer.value = { x: e.clientX, y: e.clientY };
	const target = findTargetUnderPointer(e.clientX, e.clientY);
	dragOverSlot.value = target.slot;
	dragOverBank.value = target.bank;
	if (!autoScroll.isActive.value) autoScroll.resume();
});

useEventListener(['pointerup', 'pointercancel'], (e: PointerEvent) => {
	if (!draggingTile.value) return;
	const tile = draggingTile.value;
	const source = dragSource.value;
	const target =
		e.type === 'pointerup'
			? findTargetUnderPointer(e.clientX, e.clientY)
			: { slot: null as number | null, bank: false };
	draggingTile.value = null;
	dragSource.value = null;
	dragOverSlot.value = null;
	dragOverBank.value = false;
	if (autoScroll.isActive.value) autoScroll.pause();
	if (!source) return;
	commitDrop(tile, source, target);
});

function commitDrop(
	tile: string,
	source: DragSource,
	target: { slot: number | null; bank: boolean }
) {
	if (target.slot !== null) {
		const targetIdx = target.slot;
		if (source.kind === 'bank') {
			const current = slots.value[targetIdx];
			if (current) bank.value.push(current);
			slots.value[targetIdx] = tile;
			bank.value = bank.value.filter((t) => t !== tile);
		} else {
			const srcIdx = source.index;
			if (srcIdx === targetIdx) return;
			const tmp = slots.value[targetIdx] ?? null;
			slots.value[targetIdx] = tile;
			slots.value[srcIdx] = tmp;
		}
		validate();
		return;
	}
	if (target.bank && source.kind === 'slot') {
		bank.value.push(tile);
		slots.value[source.index] = null;
		return;
	}
	// Released outside any drop zone - for slot tiles, return to bank so they aren't stranded.
	if (source.kind === 'slot') {
		bank.value.push(tile);
		slots.value[source.index] = null;
	}
}

function validate() {
	if (slots.value.some((s) => s === null)) return;
	if (wrongSlots.value.length === 0) {
		gameTick.pause();
		phase.value = 'win';
		sendUpdate();
	}
}

async function sendUpdate() {
	if (props.disabled || props.submit === false) {
		emit('submitted');
		return;
	}
	if (!userId.value) {
		submitError.value = 'Your account is still loading…';
		return;
	}
	submitError.value = '';
	submitting.value = true;
	try {
		const res = await updateQuest(
			{
				type: props.step.type,
				index: props.step.index,
				...(props.step.altIndex !== undefined ? { altIndex: props.step.altIndex } : {})
			},
			lat.value,
			lng.value
		);
		if (res.validated) {
			await new Promise((r) => setTimeout(r, 800));
			emit('submitted');
		} else {
			submitError.value = res.message || 'Could not save your progress. Please try again.';
		}
	} catch (e: any) {
		submitError.value =
			e?.data?.message || e?.statusMessage || e?.message || 'Submission failed. Please try again.';
	} finally {
		submitting.value = false;
	}
}

onMounted(init);
</script>
