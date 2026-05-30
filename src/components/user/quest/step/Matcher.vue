<template>
	<div class="flex flex-col w-full! select-none! gap-3!">
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

			<div
				ref="boardEl"
				class="relative! w-full! rounded-2xl! border! border-neutral-900! bg-neutral-950/40! overflow-hidden!"
				:style="{ height: `${boardHeight}px` }"
			>
				<div
					v-for="card in cards"
					:key="card.id"
					:ref="(el) => setCardRef(card.id, el as HTMLElement | null)"
					:data-card-id="card.id"
					class="absolute! pointer-coarse:touch-none!"
					:style="cardStyle(card)"
					@pointerdown="onPointerDown(card, $event)"
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
			<p class="text-sm! text-neutral-400!">
				{{ cards.filter((c) => !c.matched).length / 2 }} pair(s) remaining.
			</p>
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
const cards = ref<Card[]>([]);
const submitting = ref(false);
const submitError = ref('');
const shaking = ref<string | null>(null);
const boardEl = ref<HTMLElement | null>(null);
const boardHeight = ref(420);
const cardRefs = new Map<string, HTMLElement>();
const dragId = ref<string | null>(null);
const dragOffset = ref({ x: 0, y: 0 });
const dragPos = ref({ x: 0, y: 0 });
const pointerStart = ref({ x: 0, y: 0 });
const moved = ref(false);
const selected = ref<string | null>(null);
const zCounter = ref(1);

const MOVE_THRESHOLD = 8;

const lowTime = computed(() => timeLeft.value <= 10 && phase.value === 'playing');

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

function setCardRef(id: string, el: HTMLElement | null) {
	if (el) cardRefs.set(id, el);
	else cardRefs.delete(id);
}

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

	// randomize cell -> card mapping so DOM order doesn't determine visual layout
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

function init() {
	countdownTick.pause();
	gameTick.pause();

	const params = props.step.parameters as [string, [string, string][]] | undefined;
	if (!params || !Array.isArray(params[1])) return;
	const pairs = params[1];

	// Size the board responsively based on number of cards.
	// Generous height - the page can scroll (plus auto-scroll while dragging), so giving
	// each card room to breathe avoids occlusion when a card sits partially under another.
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

	// Initial positions get computed once the board is mounted; place at 0,0 first.
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
	if (shaking.value?.split(',').includes(card.id))
		return 'border-red-500 bg-red-500/10 text-red-300 animate-shake';
	if (dragId.value === card.id) return 'border-primary bg-primary/30 text-white shadow-2xl!';
	if (selected.value === card.id) return 'border-primary bg-primary/20 text-white';
	// Terms (left) are visually lighter than definitions (right) so the two card kinds
	// are distinguishable at a glance.
	if (card.side === 'left') return 'border-neutral-500 bg-neutral-700/80 text-white';
	return 'border-neutral-800 bg-neutral-950/85 text-neutral-300';
}

function cardStyle(card: Card): Record<string, string> {
	const isPressed = dragId.value === card.id;
	const isMoving = isPressed && moved.value;
	const x = isMoving ? dragPos.value.x : card.x;
	const y = isMoving ? dragPos.value.y : card.y;
	const rot = isMoving ? 0 : card.rot;
	const scale = isPressed ? 1.05 : selected.value === card.id ? 1.03 : 1;
	return {
		left: '0',
		top: '0',
		width: 'min(160px, 42%)',
		transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`,
		transition: isMoving ? 'none' : 'transform 0.25s ease, opacity 0.4s ease',
		zIndex: String(isPressed ? 999 : card.z)
	};
}

function onPointerDown(card: Card, e: PointerEvent) {
	// ignore secondary touches so a second finger can't start a parallel drag
	if (dragId.value) return;
	if (
		card.matched ||
		card.fading ||
		card.celebrate ||
		shaking.value?.split(',').includes(card.id) ||
		props.disabled
	)
		return;
	if (phase.value !== 'playing') return;
	const board = boardEl.value;
	if (!board) return;

	(e.target as Element).setPointerCapture?.(e.pointerId);
	const boardRect = board.getBoundingClientRect();
	dragId.value = card.id;
	dragOffset.value = {
		x: e.clientX - (boardRect.left + card.x),
		y: e.clientY - (boardRect.top + card.y)
	};
	dragPos.value = { x: card.x, y: card.y };
	pointerStart.value = { x: e.clientX, y: e.clientY };
	lastPointer.value = { x: e.clientX, y: e.clientY };
	moved.value = false;
	scrollTarget.value = findScrollableAncestor(board);

	zCounter.value++;
	const z = zCounter.value;
	cards.value = cards.value.map((c) => (c.id === card.id ? { ...c, z } : c));
}

const lastPointer = ref({ x: 0, y: 0 });
const scrollTarget = ref<HTMLElement | Window | null>(null);
const SCROLL_ZONE = 90;
const MIN_SCROLL_SPEED = 4;
const MAX_SCROLL_SPEED = 22;

function findScrollableAncestor(el: HTMLElement | null): HTMLElement | Window {
	if (!import.meta.client || !el) return window;
	let cur: HTMLElement | null = el.parentElement;
	while (cur && cur !== document.body && cur !== document.documentElement) {
		const style = getComputedStyle(cur);
		if (
			(style.overflowY === 'auto' || style.overflowY === 'scroll') &&
			cur.scrollHeight > cur.clientHeight
		) {
			return cur;
		}
		cur = cur.parentElement;
	}
	return window;
}

const autoScroll = useRafFn(
	() => {
		if (!dragId.value || !moved.value) return;
		const target = scrollTarget.value;
		if (!target) return;
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
		const py = lastPointer.value.y;
		const direction = py < topEdge ? -1 : py > bottomEdge ? 1 : 0;
		if (direction === 0) return;

		const edgeDist = direction < 0 ? topEdge - py : py - bottomEdge;
		const speed = Math.min(MAX_SCROLL_SPEED, Math.max(MIN_SCROLL_SPEED, edgeDist / 4));
		(target as Window | HTMLElement).scrollBy({
			top: speed * direction,
			behavior: 'instant'
		});

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
	},
	{ immediate: false }
);

useEventListener('pointermove', (e: PointerEvent) => {
	if (!dragId.value || !boardWidth.value || !boardElHeight.value) return;
	const board = boardEl.value;
	if (!board) return;
	lastPointer.value = { x: e.clientX, y: e.clientY };
	if (!moved.value) {
		const dx = e.clientX - pointerStart.value.x;
		const dy = e.clientY - pointerStart.value.y;
		if (Math.hypot(dx, dy) > MOVE_THRESHOLD) moved.value = true;
	}
	const rect = board.getBoundingClientRect();
	const cardW = Math.min(160, rect.width * 0.42);
	const cardH = 64;
	const x = e.clientX - rect.left - dragOffset.value.x;
	const y = e.clientY - rect.top - dragOffset.value.y;
	dragPos.value = {
		x: Math.max(0, Math.min(rect.width - cardW, x)),
		y: Math.max(0, Math.min(rect.height - cardH, y))
	};
	if (moved.value && !autoScroll.isActive.value) autoScroll.resume();
});

useEventListener(['pointerup', 'pointercancel'], (e: PointerEvent) => {
	const draggedId = dragId.value;
	if (!draggedId) return;
	if (autoScroll.isActive.value) autoScroll.pause();
	scrollTarget.value = null;

	const src = cards.value.find((c) => c.id === draggedId);
	if (!src) {
		dragId.value = null;
		return;
	}

	// Tap (no movement past threshold) → toggle selection, attempt match with prior tap.
	if (!moved.value && e.type === 'pointerup') {
		dragId.value = null;
		const prevId = selected.value;
		if (prevId === draggedId) {
			selected.value = null;
		} else if (prevId) {
			const prev = cards.value.find((c) => c.id === prevId);
			selected.value = null;
			if (prev && !prev.matched) tryMatch(prev, src);
		} else {
			selected.value = draggedId;
		}
		return;
	}

	// Drag → commit new resting position; detect drop on another card.
	const newX = dragPos.value.x;
	const newY = dragPos.value.y;

	let targetCard: Card | undefined;
	if (e.type === 'pointerup') {
		const draggedEl = cardRefs.get(draggedId);
		if (draggedEl) {
			const prevPe = draggedEl.style.pointerEvents;
			draggedEl.style.pointerEvents = 'none';
			const under = document.elementFromPoint(e.clientX, e.clientY);
			draggedEl.style.pointerEvents = prevPe;
			const targetEl = under?.closest('[data-card-id]') as HTMLElement | null;
			if (targetEl) {
				const id = targetEl.dataset.cardId;
				if (id && id !== draggedId) targetCard = cards.value.find((c) => c.id === id);
			}
		}
	}

	dragId.value = null;
	selected.value = null;
	cards.value = cards.value.map((c) => (c.id === draggedId ? { ...c, x: newX, y: newY } : c));

	if (targetCard && !targetCard.matched) tryMatch(src, targetCard);
});

function tryMatch(a: Card, b: Card) {
	const norm = (s: string) => s.trim().toLowerCase();
	if (a.side !== b.side && norm(a.def) === norm(b.def)) {
		const ida = a.id;
		const idb = b.id;
		// Phase 1 - green celebrate (visible).
		cards.value = cards.value.map((c) =>
			c.id === ida || c.id === idb ? { ...c, celebrate: true } : c
		);
		// Phase 2 - fade to transparent after the celebrate beat.
		useTimeoutFn(() => {
			cards.value = cards.value.map((c) =>
				c.id === ida || c.id === idb ? { ...c, fading: true } : c
			);
			// Phase 3 - fully matched (removed from play).
			useTimeoutFn(() => {
				cards.value = cards.value.map((c) =>
					c.id === ida || c.id === idb
						? { ...c, matched: true, celebrate: false, fading: false }
						: c
				);
				if (cards.value.every((c) => c.matched)) {
					gameTick.pause();
					phase.value = 'win';
					sendUpdate();
				}
			}, 300);
		}, 550);
	} else {
		shaking.value = [a.id, b.id].join(',');
		useTimeoutFn(() => {
			shaking.value = null;
		}, 480);
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

watchDebounced(
	boardWidth,
	() => {
		if (phase.value === 'playing') rescatter();
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
	animation: shake 0.45s ease-in-out;
}
</style>
