import { useAuthStore } from 'stores/auth';

export function useTimeOnPage(field: string, metadata: Record<string, any> = {}) {
	const authStore = useAuthStore();
	const timeOnPage = ref(0);
	const isTimerRunning = ref(false);
	const timerPending = ref(false);

	const startTimer = async () => {
		if (isTimerRunning.value || timerPending.value) return;
		timerPending.value = true;

		try {
			const res = await makeServerRequest<void>(null, '/api/user/timer', authStore.sessionToken, {
				method: 'POST',
				body: { action: 'start', field, metadata }
			});

			if (!res.success) {
				console.error('Failed to start timer:', res.message);
				return;
			}

			isTimerRunning.value = true;
		} finally {
			timerPending.value = false;
		}
	};

	const stopTimer = async () => {
		if (!isTimerRunning.value || timerPending.value) return;
		timerPending.value = true;

		try {
			const res = await makeServerRequest<{ durationMs: number }>(
				null,
				'/api/user/timer',
				authStore.sessionToken,
				{
					method: 'POST',
					body: { action: 'stop', field, metadata }
				}
			);

			if (!res.success || !res.data) {
				console.error('Failed to stop timer:', res.message);
				return;
			}

			isTimerRunning.value = false;
			timeOnPage.value += res.data.durationMs;
		} finally {
			timerPending.value = false;
		}
	};

	// visibilitychange covers both tab-switching and window focus/blur;
	// using it alone avoids the double-fire that occurs when pairing it with focus/blur.
	useEventListener(
		() => (import.meta.client ? document : null),
		'visibilitychange',
		() => {
			if (document.visibilityState === 'hidden') stopTimer();
			else startTimer();
		}
	);

	return {
		timeOnPage,
		isTimerRunning,
		startTimer,
		stopTimer
	};
}

// long press drag

export interface ActivateContext {
	target: HTMLElement;
	pointerId: number;
	x: number;
	y: number;
}

export interface MoveContext {
	moved: boolean;
}

export interface CommitContext {
	moved: boolean;
	wasCancel: boolean;
	pointerDownTarget: HTMLElement;
}

export interface UseLongPressDragOptions<T> {
	onActivate: (payload: T, ctx: ActivateContext) => void;
	onMove?: (e: PointerEvent, payload: T, ctx: MoveContext) => void;
	onCommit?: (e: PointerEvent, payload: T, ctx: CommitContext) => void;
	onTap?: (payload: T) => void;
	holdMs?: number;
	moveTolerance?: number;
	dragThreshold?: number;
}

export interface LongPressDragHandle<T> {
	start: (e: PointerEvent, payload: T) => void;
	cancel: () => void;
	pendingPayload: Readonly<Ref<T | null>>;
	activePayload: Readonly<Ref<T | null>>;
	isMoved: Readonly<Ref<boolean>>;
}

interface Pending<T> {
	payload: T;
	startX: number;
	startY: number;
	pointerId: number;
	target: HTMLElement;
	timer: ReturnType<typeof setTimeout>;
}

interface Active {
	target: HTMLElement;
}

// touch: long-press to drag, otherwise tap/scroll; mouse/pen: drag immediately
export function useLongPressDrag<T>(opts: UseLongPressDragOptions<T>): LongPressDragHandle<T> {
	const holdMs = opts.holdMs ?? 180;
	const moveTolerance = opts.moveTolerance ?? 14;
	const dragThreshold = opts.dragThreshold ?? 8;

	const pending = shallowRef<Pending<T> | null>(null);
	const pendingPayload = shallowRef<T | null>(null);
	const activePayload = shallowRef<T | null>(null);
	const active = shallowRef<Active | null>(null);
	const activeStart = ref({ x: 0, y: 0 });
	const isMoved = ref(false);

	function preventTouchMove(e: TouchEvent) {
		e.preventDefault();
	}

	function releaseGlobals() {
		if (import.meta.client) document.removeEventListener('touchmove', preventTouchMove);
	}

	function activate(payload: T, target: HTMLElement, pointerId: number, x: number, y: number) {
		target.setPointerCapture?.(pointerId);
		activePayload.value = payload;
		active.value = { target };
		activeStart.value = { x, y };
		isMoved.value = false;
		if (import.meta.client) {
			// touch-action lives at touchstart so we keep the page from scrolling via non-passive preventDefault
			document.addEventListener('touchmove', preventTouchMove, { passive: false });
		}
		opts.onActivate(payload, { target, pointerId, x, y });
	}

	function cancel() {
		if (pending.value) {
			clearTimeout(pending.value.timer);
			pending.value = null;
			pendingPayload.value = null;
		}
		activePayload.value = null;
		active.value = null;
		isMoved.value = false;
		releaseGlobals();
	}

	function start(e: PointerEvent, payload: T) {
		// ignore secondary pointers so a second finger can't open a parallel drag
		if (pending.value || activePayload.value) return;

		if (e.pointerType !== 'touch') {
			activate(payload, e.target as HTMLElement, e.pointerId, e.clientX, e.clientY);
			e.preventDefault();
			return;
		}

		const target = e.target as HTMLElement;
		const startX = e.clientX;
		const startY = e.clientY;
		const pointerId = e.pointerId;
		const timer = setTimeout(() => {
			const p = pending.value;
			if (!p) return;
			pending.value = null;
			pendingPayload.value = null;
			activate(p.payload, p.target, p.pointerId, p.startX, p.startY);
		}, holdMs);
		pending.value = { payload, startX, startY, pointerId, target, timer };
		pendingPayload.value = payload;
	}

	useEventListener('pointermove', (e: PointerEvent) => {
		const p = pending.value;
		if (p) {
			// finger drifted past tolerance before the hold fired - that's a scroll attempt
			const dx = e.clientX - p.startX;
			const dy = e.clientY - p.startY;
			if (Math.hypot(dx, dy) > moveTolerance) {
				clearTimeout(p.timer);
				pending.value = null;
				pendingPayload.value = null;
			}
			return;
		}
		const payload = activePayload.value;
		if (!payload) return;
		if (!isMoved.value) {
			const dx = e.clientX - activeStart.value.x;
			const dy = e.clientY - activeStart.value.y;
			if (Math.hypot(dx, dy) > dragThreshold) isMoved.value = true;
		}
		opts.onMove?.(e, payload, { moved: isMoved.value });
	});

	useEventListener(['pointerup', 'pointercancel'], (e: PointerEvent) => {
		const p = pending.value;
		if (p) {
			const wasTap = e.type === 'pointerup';
			const payload = p.payload;
			clearTimeout(p.timer);
			pending.value = null;
			pendingPayload.value = null;
			if (wasTap) opts.onTap?.(payload);
			return;
		}
		const payload = activePayload.value;
		if (!payload) return;
		const moved = isMoved.value;
		const wasCancel = e.type === 'pointercancel';
		const pointerDownTarget = active.value?.target ?? (e.target as HTMLElement);
		activePayload.value = null;
		active.value = null;
		isMoved.value = false;
		releaseGlobals();
		opts.onCommit?.(e, payload, { moved, wasCancel, pointerDownTarget });
	});

	onBeforeUnmount(cancel);

	return { start, cancel, pendingPayload, activePayload, isMoved };
}

export function suppressNextClickOn(target: HTMLElement, maxWaitMs = 200) {
	if (!import.meta.client) return;
	let consumed = false;

	const handler = (e: MouseEvent) => {
		if (consumed) return;
		consumed = true;
		e.stopPropagation();
		e.preventDefault();
		target.removeEventListener('click', handler, true);
	};
	target.addEventListener('click', handler, true);
	setTimeout(() => {
		if (!consumed) {
			consumed = true;
			target.removeEventListener('click', handler, true);
		}
	}, maxWaitMs);
}

// pause on hidden

interface PauseableTimer {
	isActive: Readonly<Ref<boolean>>;
	pause: () => void;
	resume: () => void;
}

// pause active timers when the tab is hidden, resume only the ones we paused
export function usePauseOnHidden(...timers: PauseableTimer[]) {
	if (!import.meta.client) return;
	const paused = new WeakSet<PauseableTimer>();
	useEventListener(document, 'visibilitychange', () => {
		if (document.hidden) {
			for (const t of timers) {
				if (t.isActive.value) {
					t.pause();
					paused.add(t);
				}
			}
		} else {
			for (const t of timers) {
				if (paused.has(t)) {
					t.resume();
					paused.delete(t);
				}
			}
		}
	});
}

// drag auto scroll

export interface UseDragAutoScrollOptions {
	pointer: Ref<{ x: number; y: number }>;
	target: Ref<HTMLElement | Window | null>;
	zone?: number;
	minSpeed?: number;
	maxSpeed?: number;
	onScroll?: () => void;
}

export interface DragAutoScrollHandle {
	start: () => void;
	stop: () => void;
	isActive: Readonly<Ref<boolean>>;
	findScrollableAncestor: (el: HTMLElement | null) => HTMLElement | Window;
}

// raf-driven page scroll when the pointer enters an edge zone of the target
export function useDragAutoScroll(opts: UseDragAutoScrollOptions): DragAutoScrollHandle {
	const zone = opts.zone ?? 90;
	const minSpeed = opts.minSpeed ?? 4;
	const maxSpeed = opts.maxSpeed ?? 22;

	const raf = useRafFn(
		() => {
			const target = opts.target.value;
			if (!target) return;
			let topEdge: number;
			let bottomEdge: number;
			if (target === window) {
				topEdge = zone;
				bottomEdge = window.innerHeight - zone;
			} else {
				const rect = (target as HTMLElement).getBoundingClientRect();
				topEdge = rect.top + zone;
				bottomEdge = rect.bottom - zone;
			}
			const y = opts.pointer.value.y;
			const direction = y < topEdge ? -1 : y > bottomEdge ? 1 : 0;
			if (direction === 0) return;
			// ease by distance into the edge zone so fingers near the boundary scroll faster
			const edgeDist = direction < 0 ? topEdge - y : y - bottomEdge;
			const speed = Math.min(maxSpeed, Math.max(minSpeed, edgeDist / 4));
			(target as Window | HTMLElement).scrollBy({ top: speed * direction, behavior: 'instant' });
			opts.onScroll?.();
		},
		{ immediate: false }
	);

	function start() {
		if (!raf.isActive.value) raf.resume();
	}
	function stop() {
		if (raf.isActive.value) raf.pause();
	}

	// elementFromPoint each frame is flaky on mobile - it can return a teleported ghost
	// or overlay and walk up to the wrong ancestor; cache the container once at drag start
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

	onBeforeUnmount(stop);

	return { start, stop, isActive: raf.isActive, findScrollableAncestor };
}

// form drafts

const DEFAULT_DEBOUNCE_MS = 600;
const STORAGE_PREFIX = 'earth-app:draft';

export interface UseFormDraftOptions {
	// kind of content being drafted (used in the storage key + restore toast copy)
	kind: 'article' | 'prompt' | 'event';
	// optional ID — when present, lets us key drafts per-user so a shared browser stays sane.
	userId?: MaybeRefOrGetter<string | null | undefined>;
	// extra suffix on the key when the same form is used for multiple entities (eg. edit page).
	// Only emit drafts for create flows; edit drafts get confusing fast.
	scope?: string;
	// debounce delay between state change and storage write. ms.
	debounceMs?: number;
	// custom restoration toast title; default reads "Draft Restored".
	restoreToastTitle?: string;
}

export function useFormDraft<T extends object>(state: T, opts: UseFormDraftOptions) {
	const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS;
	const toast = useToast();
	const restored = ref(false);

	const storageKey = computed(() => {
		const uid = opts.userId !== undefined ? toValue(opts.userId) : null;
		const userSegment = uid ? `:user:${uid}` : '';
		const scopeSegment = opts.scope ? `:${opts.scope}` : '';
		return `${STORAGE_PREFIX}:${opts.kind}${userSegment}${scopeSegment}`;
	});

	const readStorage = (): Partial<T> | null => {
		if (!import.meta.client) return null;
		try {
			const raw = window.localStorage.getItem(storageKey.value);
			if (!raw) return null;
			const parsed = JSON.parse(raw);
			return parsed && typeof parsed === 'object' ? (parsed as Partial<T>) : null;
		} catch {
			return null;
		}
	};

	const writeStorage = (payload: Partial<T>) => {
		if (!import.meta.client) return;
		try {
			window.localStorage.setItem(storageKey.value, JSON.stringify(payload));
		} catch {
			// quota errors, private-mode safari, etc. — silently drop; autosave is best-effort
		}
	};

	const clear = () => {
		if (!import.meta.client) return;
		try {
			window.localStorage.removeItem(storageKey.value);
		} catch {
			// ignore
		}
	};

	// restore on mount (client-only)
	onMounted(() => {
		const stored = readStorage();
		if (!stored) return;
		let restoredAny = false;
		for (const k of Object.keys(stored) as (keyof T)[]) {
			const v = stored[k];
			if (v === undefined) continue;
			// shallow assign — nested objects are replaced, which matches the typical state shape
			(state as any)[k] = v;
			restoredAny = true;
		}
		if (restoredAny && !restored.value) {
			restored.value = true;
			toast.add({
				title: opts.restoreToastTitle ?? 'Draft Restored',
				description: 'Your unfinished draft was picked up from where you left off.',
				icon: 'mdi:content-save-outline',
				color: 'info',
				duration: 4000,
				actions: [
					{
						label: 'Discard',
						color: 'neutral',
						variant: 'soft',
						onClick: () => {
							clear();
							toast.add({
								title: 'Draft Discarded',
								description: 'The saved draft has been cleared.',
								icon: 'mdi:delete-outline',
								color: 'neutral',
								duration: 2500
							});
						}
					}
				]
			});
		}
	});

	// debounced persistence on any state change
	let writeTimer: ReturnType<typeof setTimeout> | null = null;
	watch(
		() => state,
		() => {
			if (!import.meta.client) return;
			if (writeTimer) clearTimeout(writeTimer);
			writeTimer = setTimeout(() => {
				// toRaw to avoid leaking Vue reactivity proxies into storage
				writeStorage(toRaw(state));
			}, debounceMs);
		},
		{ deep: true }
	);

	onBeforeUnmount(() => {
		if (writeTimer) clearTimeout(writeTimer);
	});

	return {
		clear,
		hasRestored: readonly(restored),
		storageKey: readonly(storageKey)
	};
}

// speech-to-text transport that hosts (e.g. sky) can pass into Text.vue's
// nativeStt prop to override the default Web SpeechRecognition fallback
export interface NativeSttTransport {
	isAvailable: () => Promise<boolean>;
	requestPermission: () => Promise<boolean>;
	start: (opts: {
		language: string;
		onPartial: (text: string) => void;
		onFinal: (text: string) => void;
	}) => Promise<void>;
	stop: () => Promise<void>;
}
