<template>
	<div class="flex flex-col w-full! select-none! gap-4!">
		<UserQuestStepCountdown
			v-if="phase === 'countdown'"
			:value="countdown"
			:disabled="props.disabled"
		/>

		<template v-else-if="phase === 'playing'">
			<div
				v-if="!untimed"
				class="flex items-center gap-2!"
			>
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
				v-if="step?.description"
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
						v-for="(tile, idx) in bank"
						:key="`${tile}-${idx}`"
						class="px-3! py-2! rounded-xl! border-2! text-sm! font-medium! transition-all duration-150 cursor-grab active:cursor-grabbing!"
						:class="[
							selectedIndex === idx || (dragSource?.kind === 'bank' && dragSource.bankIndex === idx)
								? 'border-primary bg-primary/20 text-white scale-105'
								: 'border-neutral-700 bg-neutral-900/60 text-neutral-200 active:scale-95',
							pendingHighlight === `bank:${idx}` ? 'scale-105 border-primary/60!' : ''
						]"
						@pointerdown="drag.start($event, { tile, source: { kind: 'bank', bankIndex: idx } })"
						@click.stop="selectBankTile(idx)"
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
					class="flex items-center gap-2! min-h-12! rounded-xl! border-2! px-3! py-2! transition-all duration-150"
					:class="slotClass(slot, i)"
					@click="onSlotClick(i)"
				>
					<span class="text-xs! text-neutral-500! w-4! shrink-0 tabular-nums!">{{ i + 1 }}</span>
					<span
						v-if="slot && !(dragSource?.kind === 'slot' && dragSource.index === i)"
						class="text-sm! font-medium! text-white! flex-1! cursor-grab active:cursor-grabbing! transition-transform"
						:class="pendingHighlight === `slot:${i}` ? 'scale-105' : ''"
						@pointerdown="drag.start($event, { tile: slot, source: { kind: 'slot', index: i } })"
						@click.stop
						>{{ slot }}</span
					>
					<span
						v-else
						class="text-xs! italic! flex-1"
						:class="
							selectedIndex !== null || draggingPayload || dragOverSlot === i
								? 'text-primary/70'
								: 'text-neutral-600'
						"
						>{{
							selectedIndex !== null || draggingPayload || dragOverSlot === i
								? 'Drop here'
								: 'Empty'
						}}</span
					>
				</div>
			</div>

			<Teleport
				v-if="draggingPayload"
				to="body"
			>
				<div
					class="fixed pointer-events-none z-50 px-3! py-2! rounded-xl! border-2! border-primary bg-primary/30 text-white text-sm! font-medium! shadow-2xl!"
					:style="ghostStyle"
				>
					{{ draggingPayload.tile }}
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
import { shuffle } from 'utils';

type Phase = 'countdown' | 'playing' | 'win' | 'lose';
// source uses an index for bank tiles so duplicate names don't collide on removal
type DragSource = { kind: 'bank'; bankIndex: number } | { kind: 'slot'; index: number };
interface DragPayload {
	tile: string;
	source: DragSource;
}

interface Props extends QuestStepContextProps {
	// quest-context input. step.parameters[0] supplies the canonical-order items.
	step?: QuestTimelineStep;
	// quiz-context input: items in canonical (correct) order. Component shuffles on init.
	// Either `step` or `items` must be supplied.
	items?: string[];
	serverRequest?: typeof makeServerRequest;
	// quiz mode: no countdown, no timer, no auto-submit. Parent reads order via update:order.
	untimed?: boolean;
}

const props = withDefaults(defineProps<Props>(), { submit: true, untimed: false });
const emit = defineEmits<{
	submitted: [];
	// emits the current ordered list (with empty slots filtered) every time a slot changes
	'update:order': [order: string[]];
}>();

const { submit, submitting, submitError } = useStepSubmission(props, emit);

const phase = ref<Phase>('countdown');
const countdown = ref(3);
const timeLeft = ref(60);
const correctOrder = ref<string[]>([]);
const bank = ref<string[]>([]);
const slots = ref<(string | null)[]>([]);
const selectedIndex = ref<number | null>(null);
const dragPos = ref({ x: 0, y: 0 });
const lastPointer = ref({ x: 0, y: 0 });
const dragOverSlot = ref<number | null>(null);
const dragOverBank = ref(false);
const scrollTarget = ref<HTMLElement | Window | null>(null);

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

usePauseOnHidden(countdownTick, gameTick);

const autoScroll = useDragAutoScroll({
	pointer: lastPointer,
	target: scrollTarget,
	onScroll: () => {
		const t = findTargetUnderPointer(lastPointer.value.x, lastPointer.value.y);
		dragOverSlot.value = t.slot;
		dragOverBank.value = t.bank;
	}
});

const drag = useLongPressDrag<DragPayload>({
	onActivate: (payload, ctx) => {
		dragPos.value = { x: ctx.x, y: ctx.y };
		lastPointer.value = { x: ctx.x, y: ctx.y };
		scrollTarget.value = autoScroll.findScrollableAncestor(ctx.target as HTMLElement);
		selectedIndex.value = null;
	},
	onMove: (e, _payload) => {
		dragPos.value = { x: e.clientX, y: e.clientY };
		lastPointer.value = { x: e.clientX, y: e.clientY };
		const t = findTargetUnderPointer(e.clientX, e.clientY);
		dragOverSlot.value = t.slot;
		dragOverBank.value = t.bank;
		autoScroll.start();
	},
	onCommit: (e, payload, ctx) => {
		autoScroll.stop();
		scrollTarget.value = null;
		const target =
			!ctx.wasCancel && e.type === 'pointerup'
				? findTargetUnderPointer(e.clientX, e.clientY)
				: { slot: null as number | null, bank: false };
		dragOverSlot.value = null;
		dragOverBank.value = false;
		// pointercancel = system gesture interrupted; leave board untouched
		if (!ctx.wasCancel) commitDrop(payload, target);
		// swallow the synthetic click the browser fires after touch pointerup on the same element
		if (e.pointerType === 'touch') suppressNextClickOn(ctx.pointerDownTarget);
	}
});

// template aliases for the active drag payload
const draggingPayload = computed(() => drag.activePayload.value);
const dragSource = computed(() => drag.activePayload.value?.source ?? null);
const pendingHighlight = computed(() => {
	const p = drag.pendingPayload.value;
	if (!p) return null;
	if (p.source.kind === 'bank') return `bank:${p.source.bankIndex}`;
	return `slot:${p.source.index}`;
});

function findTargetUnderPointer(clientX: number, clientY: number) {
	const under = import.meta.client ? document.elementFromPoint(clientX, clientY) : null;
	if (!under) return { slot: null as number | null, bank: false };
	const slotEl = under.closest('[data-slot-index]') as HTMLElement | null;
	if (slotEl) return { slot: Number(slotEl.dataset.slotIndex), bank: false };
	if (under.closest('[data-bank]')) return { slot: null, bank: true };
	return { slot: null, bank: false };
}

function selectBankTile(idx: number) {
	if (props.disabled || drag.activePayload.value || drag.pendingPayload.value) return;
	selectedIndex.value = selectedIndex.value === idx ? null : idx;
}

function onSlotClick(i: number) {
	if (props.disabled || drag.activePayload.value || drag.pendingPayload.value) return;
	if (selectedIndex.value === null) return;
	const idx = selectedIndex.value;
	const tile = bank.value[idx];
	if (!tile) return;
	const current = slots.value[i];
	if (current) bank.value.push(current);
	slots.value[i] = tile;
	bank.value.splice(idx, 1);
	selectedIndex.value = null;
	validate();
}

function commitDrop(payload: DragPayload, target: { slot: number | null; bank: boolean }) {
	const { tile, source } = payload;
	if (target.slot !== null) {
		const targetIdx = target.slot;
		if (source.kind === 'bank') {
			const current = slots.value[targetIdx];
			if (current) bank.value.push(current);
			slots.value[targetIdx] = tile;
			// remove by exact bank index so a duplicate name doesn't strip both copies
			bank.value.splice(source.bankIndex, 1);
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
	// released outside any drop zone - slot tiles fall back to bank so they aren't stranded
	if (source.kind === 'slot') {
		bank.value.push(tile);
		slots.value[source.index] = null;
	}
}

function emitOrder() {
	emit(
		'update:order',
		slots.value.filter((s): s is string => s !== null)
	);
}

function validate() {
	if (props.untimed) {
		// quiz mode: emit the running order; never auto-submit, never reach 'win'/'lose'
		emitOrder();
		return;
	}
	if (slots.value.some((s) => s === null)) return;
	if (wrongSlots.value.length === 0) {
		gameTick.pause();
		phase.value = 'win';
		submit();
	}
}

function slotClass(slot: string | null, i: number) {
	// in quiz/untimed mode we must not paint wrong slots red — that would leak the answer key
	if (!props.untimed && slot !== null && wrongSlots.value.includes(i))
		return 'border-red-500 bg-red-500/10 text-red-300 cursor-pointer';
	if (dragOverSlot.value === i) return 'border-primary border-dashed bg-primary/10 cursor-pointer';
	if (slot) return 'border-neutral-600 bg-neutral-900/60 cursor-pointer';
	if (selectedIndex.value !== null || draggingPayload.value)
		return 'border-primary/30 border-dashed cursor-pointer';
	return 'border-neutral-800 cursor-default';
}

function init() {
	countdownTick.pause();
	gameTick.pause();
	drag.cancel();
	selectedIndex.value = null;
	dragOverSlot.value = null;
	dragOverBank.value = false;

	// quiz path: explicit items prop. quest path: step.parameters[0]
	let items: string[] | undefined;
	if (Array.isArray(props.items)) {
		items = props.items;
	} else {
		const params = props.step?.parameters as [string[]] | undefined;
		if (params && Array.isArray(params[0])) items = params[0];
	}
	if (!items) return;

	correctOrder.value = items;
	bank.value = shuffle([...items]);
	slots.value = Array(items.length).fill(null);
	timeLeft.value = 60;

	if (props.untimed) {
		// skip the timed game loop entirely; start in playing mode and stay there
		phase.value = 'playing';
		emitOrder();
		return;
	}

	phase.value = 'countdown';
	countdown.value = 3;
	if (props.disabled) return;
	countdownTick.resume();
}

onMounted(init);
</script>
