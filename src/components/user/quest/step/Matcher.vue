<template>
	<div class="flex flex-col w-full! select-none! gap-3!">
		<UserQuestStepCountdown
			v-if="phase === 'countdown'"
			:value="countdown"
			:disabled="props.disabled"
		/>

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

			<div
				ref="boardEl"
				class="relative! w-full! rounded-2xl! border! border-neutral-900! bg-neutral-950/40! overflow-hidden!"
				:style="{ height: `${boardHeight}px` }"
			>
				<div
					v-for="card in cards"
					:key="card.id"
					:data-card-id="card.id"
					class="absolute!"
					:style="cardStyle(card)"
					@pointerdown="drag.start($event, card)"
				>
					<div
						class="rounded-xl! border-2! text-sm! font-medium! text-center! shadow-lg! flex items-center justify-center! px-3! py-2! transition-all duration-300 w-full!"
						:class="[
							cardClass(card),
							card.matched || card.fading || card.celebrate
								? 'pointer-events-none'
								: 'cursor-grab active:cursor-grabbing!'
						]"
					>
						<span class="pointer-events-none wrap-break-word">{{ card.text }}</span>
					</div>
				</div>
			</div>
		</template>

		<div
			v-else-if="phase === 'win'"
			class="flex flex-col items-center gap-4! py-12!"
		>
			<UIcon
				name="i-lucide-trophy"
				class="size-16 text-success"
			/>
			<h3 class="text-xl! font-bold!">All Matched!</h3>
			<p class="text-sm! text-neutral-400!">Completed in {{ 60 - timeLeft }}s</p>

			<div
				v-if="submitting"
				class="flex items-center gap-2! text-sm! text-neutral-400!"
			>
				<UIcon
					name="i-lucide-loader-circle"
					class="size-4 animate-spin"
				/>
				<span>Saving progress…</span>
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
				@click="submit"
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
			<p class="text-sm! text-neutral-400!">{{ remainingPairs }} pair(s) remaining.</p>
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
import { shuffle } from 'utils';

interface Card {
	id: string;
	text: string;
	def: string;
	side: 'left' | 'right';
	celebrate: boolean;
	fading: boolean;
	matched: boolean;
	x: number;
	y: number;
	rot: number;
	z: number;
}

type Phase = 'countdown' | 'playing' | 'win' | 'lose';

interface Props {
	step: QuestStep & {
		icon: string;
		completed: boolean;
		index: number;
		altIndex?: number;
		isCurrentQuest: boolean;
	};
	submit?: boolean;
	disabled?: boolean;
	serverRequest?: typeof makeServerRequest;
	questTitle?: string;
	questReward?: number;
}

const props = withDefaults(defineProps<Props>(), { submit: true });
const emit = defineEmits<{ submitted: [] }>();

const { submit, submitting, submitError } = useStepSubmission(props, emit);

const phase = ref<Phase>('countdown');
const countdown = ref(3);
const timeLeft = ref(60);
const cards = ref<Card[]>([]);
const shaking = ref(new Set<string>());
const boardEl = ref<HTMLElement | null>(null);
const boardHeight = ref(420);
const dragId = ref<string | null>(null);
const dragOffset = ref({ x: 0, y: 0 });
const dragPos = ref({ x: 0, y: 0 });
const lastPointer = ref({ x: 0, y: 0 });
const scrollTarget = ref<HTMLElement | Window | null>(null);
const selected = ref<string | null>(null);
const zCounter = ref(1);

const lowTime = computed(() => timeLeft.value <= 10 && phase.value === 'playing');
const remainingPairs = computed(() => cards.value.filter((c) => !c.matched).length / 2);

const { width: boardWidth, height: boardElHeight } = useElementSize(boardEl);

const countdownTick = useIntervalFn(
	() => {
		countdown.value--;
		if (countdown.value <= 0) {
			countdownTick.pause();
			phase.value = 'playing';
			nextTick(() => rescatter());
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

usePauseOnHidden(countdownTick, gameTick);

const autoScroll = useDragAutoScroll({
	pointer: lastPointer,
	target: scrollTarget,
	onScroll: () => {
		// page shifted under the finger so refresh the drag position from the cached offset
		const board = boardEl.value;
		if (!board) return;
		const rect = board.getBoundingClientRect();
		const cardW = Math.min(160, rect.width * 0.42);
		const cardH = 64;
		const nx = lastPointer.value.x - rect.left - dragOffset.value.x;
		const ny = lastPointer.value.y - rect.top - dragOffset.value.y;
		dragPos.value = {
			x: Math.max(0, Math.min(rect.width - cardW, nx)),
			y: Math.max(0, Math.min(rect.height - cardH, ny))
		};
	}
});

const drag = useLongPressDrag<Card>({
	onActivate: (card, ctx) => {
		const board = boardEl.value;
		if (!board) return;
		const boardRect = board.getBoundingClientRect();
		dragId.value = card.id;
		dragOffset.value = {
			x: ctx.x - (boardRect.left + card.x),
			y: ctx.y - (boardRect.top + card.y)
		};
		dragPos.value = { x: card.x, y: card.y };
		lastPointer.value = { x: ctx.x, y: ctx.y };
		scrollTarget.value = autoScroll.findScrollableAncestor(board);
		zCounter.value++;
		const z = zCounter.value;
		cards.value = cards.value.map((c) => (c.id === card.id ? { ...c, z } : c));
	},
	onMove: (e, _card, ctx) => {
		const board = boardEl.value;
		if (!board || !boardWidth.value || !boardElHeight.value) return;
		lastPointer.value = { x: e.clientX, y: e.clientY };
		const rect = board.getBoundingClientRect();
		const cardW = Math.min(160, rect.width * 0.42);
		const cardH = 64;
		const x = e.clientX - rect.left - dragOffset.value.x;
		const y = e.clientY - rect.top - dragOffset.value.y;
		dragPos.value = {
			x: Math.max(0, Math.min(rect.width - cardW, x)),
			y: Math.max(0, Math.min(rect.height - cardH, y))
		};
		if (ctx.moved) autoScroll.start();
	},
	onCommit: (e, card, ctx) => {
		autoScroll.stop();
		scrollTarget.value = null;

		// pointercancel (system gesture, screen rotate) restores instead of committing
		if (ctx.wasCancel) {
			dragId.value = null;
			return;
		}

		// long-press fired but the finger never moved - treat as tap
		if (!ctx.moved) {
			dragId.value = null;
			handleTap(card);
			return;
		}

		const newX = dragPos.value.x;
		const newY = dragPos.value.y;
		let targetCard: Card | undefined;
		if (e.type === 'pointerup') {
			// temporarily hide the dragged element from hit-testing so elementFromPoint returns the card below
			const draggedEl = document.querySelector(`[data-card-id="${card.id}"]`) as HTMLElement | null;
			if (draggedEl) {
				const prevPe = draggedEl.style.pointerEvents;
				draggedEl.style.pointerEvents = 'none';
				const under = document.elementFromPoint(e.clientX, e.clientY);
				draggedEl.style.pointerEvents = prevPe;
				const targetEl = under?.closest('[data-card-id]') as HTMLElement | null;
				if (targetEl) {
					const id = targetEl.dataset.cardId;
					if (id && id !== card.id) targetCard = cards.value.find((c) => c.id === id);
				}
			}
		}
		dragId.value = null;
		selected.value = null;
		cards.value = cards.value.map((c) => (c.id === card.id ? { ...c, x: newX, y: newY } : c));
		if (targetCard && !targetCard.matched) tryMatch(card, targetCard);
	},
	onTap: (card) => handleTap(card)
});

function handleTap(card: Card) {
	if (card.matched || card.fading || card.celebrate) return;
	if (shaking.value.has(card.id)) return;
	if (props.disabled) return;
	const prevId = selected.value;
	if (prevId === card.id) {
		selected.value = null;
		return;
	}
	if (prevId) {
		const prev = cards.value.find((c) => c.id === prevId);
		selected.value = null;
		if (prev && !prev.matched) tryMatch(prev, card);
	} else {
		selected.value = card.id;
	}
}

function rand(min: number, max: number) {
	return min + Math.random() * (max - min);
}

function scatterPositions(count: number, width: number, height: number) {
	const cardW = Math.min(160, width * 0.42);
	const cardH = 64;
	const padX = 12;
	const padY = 12;
	const minGap = 10;
	const positions: { x: number; y: number; rot: number }[] = [];
	if (count === 0) return positions;

	const cols = Math.max(1, Math.floor((width - 2 * padX + minGap) / (cardW + minGap)));
	const rows = Math.ceil(count / cols);
	const cellW = (width - 2 * padX) / cols;
	const cellH = Math.max(cardH + minGap, (height - 2 * padY) / rows);
	const jitterX = Math.max(0, (cellW - cardW) / 2 - 4);
	const jitterY = Math.max(0, (cellH - cardH) / 2 - 4);

	// randomize cell -> card so DOM order doesn't determine visual layout
	const allCells = Array.from({ length: rows * cols }, (_, i) => i);
	const cellOrder = shuffle(allCells).slice(0, count);

	for (let i = 0; i < count; i++) {
		const cellIdx = cellOrder[i] ?? i;
		const row = Math.floor(cellIdx / cols);
		const col = cellIdx % cols;
		const cellLeft = padX + col * cellW;
		const cellTop = padY + row * cellH;
		const baseX = cellLeft + (cellW - cardW) / 2;
		const baseY = cellTop + (cellH - cardH) / 2;
		const x = baseX + rand(-jitterX, jitterX);
		const y = baseY + rand(-jitterY, jitterY);
		positions.push({ x, y, rot: rand(-7, 7) });
	}
	return positions;
}

function rescatter() {
	const board = boardEl.value;
	if (!board) return;
	const rect = board.getBoundingClientRect();
	if (!rect.width || !rect.height) return;
	const active = cards.value.filter((c) => !c.matched);
	const positions = scatterPositions(active.length, rect.width, rect.height);
	let pi = 0;
	cards.value = cards.value.map((c) => {
		if (c.matched) return c;
		const p = positions[pi++];
		if (!p) return c;
		return { ...c, x: p.x, y: p.y, rot: p.rot };
	});
}

// re-clamp existing positions to new board bounds instead of reshuffling mid-game
function clampToBounds() {
	const board = boardEl.value;
	if (!board) return;
	const rect = board.getBoundingClientRect();
	if (!rect.width || !rect.height) return;
	const cardW = Math.min(160, rect.width * 0.42);
	const cardH = 64;
	cards.value = cards.value.map((c) => {
		if (c.matched) return c;
		const x = Math.max(0, Math.min(rect.width - cardW, c.x));
		const y = Math.max(0, Math.min(rect.height - cardH, c.y));
		if (x === c.x && y === c.y) return c;
		return { ...c, x, y };
	});
}

function init() {
	countdownTick.pause();
	gameTick.pause();
	drag.cancel();
	dragId.value = null;
	selected.value = null;
	shaking.value = new Set();

	const params = props.step.parameters as [string, [string, string][]] | undefined;
	if (!params || !Array.isArray(params[1])) return;
	const pairs = params[1];

	// generous height so cards don't occlude each other; the page scrolls
	const totalCards = pairs.length * 2;
	boardHeight.value = Math.min(1200, Math.max(640, 100 + totalCards * 110));

	const left: Omit<Card, 'x' | 'y' | 'rot' | 'z'>[] = pairs.map(([term, def], i) => ({
		id: `L${i}`,
		text: term,
		def,
		side: 'left',
		celebrate: false,
		fading: false,
		matched: false
	}));
	const right: Omit<Card, 'x' | 'y' | 'rot' | 'z'>[] = pairs.map(([, def], i) => ({
		id: `R${i}`,
		text: def,
		def,
		side: 'right',
		celebrate: false,
		fading: false,
		matched: false
	}));
	const shuffled = shuffle([...left, ...right]);
	cards.value = shuffled.map((c) => ({ ...c, x: 0, y: 0, rot: 0, z: 1 }));

	timeLeft.value = 60;
	phase.value = 'countdown';
	countdown.value = 3;
	zCounter.value = 1;

	if (props.disabled) return;
	countdownTick.resume();
}

function cardClass(card: Card) {
	if (card.matched) return 'opacity-0';
	if (card.fading) return 'border-success bg-success/25 text-success opacity-0 shadow-success/40';
	if (card.celebrate)
		return 'border-success bg-success/25 text-success shadow-lg! shadow-success/40';
	if (props.disabled)
		return 'border-neutral-800 bg-neutral-900/40 text-neutral-600 cursor-not-allowed opacity-50';
	if (shaking.value.has(card.id)) return 'border-red-500 bg-red-500/10 text-red-300 animate-shake';
	if (dragId.value === card.id) return 'border-primary bg-primary/30 text-white shadow-2xl!';
	if (selected.value === card.id) return 'border-primary bg-primary/20 text-white';
	// terms (left) read lighter than definitions (right) for at-a-glance contrast
	if (card.side === 'left') return 'border-neutral-500 bg-neutral-700/80 text-white';
	return 'border-neutral-800 bg-neutral-950/85 text-neutral-300';
}

function cardStyle(card: Card): Record<string, string> {
	const isPressed = dragId.value === card.id;
	const isMoving = isPressed && drag.isMoved.value;
	const isPending = drag.pendingPayload.value?.id === card.id;
	const x = isMoving ? dragPos.value.x : card.x;
	const y = isMoving ? dragPos.value.y : card.y;
	const rot = isMoving ? 0 : card.rot;
	const scale = isPressed ? 1.05 : selected.value === card.id ? 1.03 : isPending ? 1.04 : 1;
	// matched/fading/celebrate cards stay positioned (opacity 0 during fade); pointer-events:none
	// stops them swallowing taps and z:0 drops them under any still-active cards
	const inert = card.matched || card.fading || card.celebrate;
	return {
		left: '0',
		top: '0',
		width: 'min(160px, 42%)',
		transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`,
		transition: isMoving ? 'none' : 'transform 0.25s ease, opacity 0.4s ease',
		zIndex: String(isPressed ? 999 : inert ? 0 : card.z),
		pointerEvents: inert ? 'none' : 'auto'
	};
}

function tryMatch(a: Card, b: Card) {
	const norm = (s: string) => s.trim().toLowerCase();
	if (a.side !== b.side && norm(a.def) === norm(b.def)) {
		const ida = a.id;
		const idb = b.id;
		// pause time now if this match clears the board so the celebration animation can't get clipped by a zero-tick
		const remaining = cards.value.reduce((n, c) => n + (c.matched ? 0 : 1), 0);
		if (remaining <= 2) gameTick.pause();
		// phase 1 - green celebrate (visible)
		cards.value = cards.value.map((c) =>
			c.id === ida || c.id === idb ? { ...c, celebrate: true } : c
		);
		// phase 2 - fade to transparent
		useTimeoutFn(() => {
			cards.value = cards.value.map((c) =>
				c.id === ida || c.id === idb ? { ...c, fading: true } : c
			);
			// phase 3 - matched (removed from play)
			useTimeoutFn(() => {
				cards.value = cards.value.map((c) =>
					c.id === ida || c.id === idb
						? { ...c, matched: true, celebrate: false, fading: false }
						: c
				);
				if (cards.value.every((c) => c.matched)) {
					gameTick.pause();
					phase.value = 'win';
					submit();
				}
			}, 300);
		}, 550);
	} else {
		const next = new Set(shaking.value);
		next.add(a.id);
		next.add(b.id);
		shaking.value = next;
		// short shake so a quick retry isn't blocked
		useTimeoutFn(() => {
			const after = new Set(shaking.value);
			after.delete(a.id);
			after.delete(b.id);
			shaking.value = after;
		}, 300);
	}
}

watchDebounced(
	boardWidth,
	() => {
		if (phase.value !== 'playing') return;
		// don't disturb an in-progress drag
		if (drag.activePayload.value || drag.pendingPayload.value) return;
		clampToBounds();
	},
	{ debounce: 150 }
);

onKeyStroke('Escape', () => {
	if (selected.value) selected.value = null;
});

onMounted(init);
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
	animation: shake 0.3s ease-in-out;
}
</style>
