import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from 'stores/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, reactive, ref } from 'vue';
import {
	suppressNextClickOn,
	useDragAutoScroll,
	useFormDraft,
	useLongPressDrag,
	usePauseOnHidden,
	useTimeOnPage
} from '~/composables/useUtilities';

// makeServerRequest is auto-imported by useTimeOnPage; everything else
// (useToast / useEventListener / useRafFn) stays real via the spread.
vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return { ...actual, makeServerRequest: vi.fn() };
});

import { makeServerRequest } from 'utils';

// run a composable inside a real (mounted) component so onMounted /
// onBeforeUnmount fire and useEventListener cleans up on unmount.
function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
	let result!: T;
	const app = createApp({
		setup() {
			result = composable();
			return () => h('div');
		}
	});
	const el = document.createElement('div');
	document.body.appendChild(el);
	app.mount(el);
	return {
		result,
		unmount: () => {
			app.unmount();
			el.remove();
		}
	};
}

// build a pointer-ish event without relying on a PointerEvent constructor
function pointerEvent(
	type: string,
	opts: {
		x?: number;
		y?: number;
		pointerType?: string;
		pointerId?: number;
		target?: EventTarget;
	} = {}
) {
	const ev = new Event(type, { bubbles: true, cancelable: true });
	Object.assign(ev, {
		clientX: opts.x ?? 0,
		clientY: opts.y ?? 0,
		pointerType: opts.pointerType ?? 'mouse',
		pointerId: opts.pointerId ?? 1
	});
	if (opts.target) Object.defineProperty(ev, 'target', { value: opts.target, configurable: true });
	return ev as unknown as PointerEvent;
}

describe('useTimeOnPage', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		// timer only runs for authenticated users (recompute gates on sessionToken)
		useAuthStore().setSessionToken('test-token');
		vi.clearAllMocks();
	});

	it('startTimer flips running on a successful start', async () => {
		(makeServerRequest as any).mockResolvedValue({ success: true });
		const t = useTimeOnPage('reading');

		await t.startTimer();

		expect(t.isTimerRunning.value).toBe(true);
		expect((makeServerRequest as any).mock.calls[0][3].body).toMatchObject({
			action: 'start',
			field: 'reading'
		});
	});

	it('startTimer is a no-op while already running', async () => {
		(makeServerRequest as any).mockResolvedValue({ success: true });
		const t = useTimeOnPage('reading');
		await t.startTimer();
		await t.startTimer(); // already running

		expect(makeServerRequest).toHaveBeenCalledTimes(1);
	});

	it('does not flip running when the start request fails', async () => {
		(makeServerRequest as any).mockResolvedValue({ success: false, message: 'nope' });
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const t = useTimeOnPage('reading');

		await t.startTimer();
		expect(t.isTimerRunning.value).toBe(false);
		spy.mockRestore();
	});

	it('stopTimer accumulates the returned duration and clears running', async () => {
		(makeServerRequest as any)
			.mockResolvedValueOnce({ success: true })
			.mockResolvedValueOnce({ success: true, data: { durationMs: 4200 } });
		const t = useTimeOnPage('reading');

		await t.startTimer();
		await t.stopTimer();

		expect(t.isTimerRunning.value).toBe(false);
		expect(t.timeOnPage.value).toBe(4200);
		expect((makeServerRequest as any).mock.calls[1][3].body).toMatchObject({ action: 'stop' });
	});

	it('stopTimer is a no-op when no timer is running', async () => {
		const t = useTimeOnPage('reading');
		await t.stopTimer();
		expect(makeServerRequest).not.toHaveBeenCalled();
	});
});

describe('suppressNextClickOn', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});
	afterEach(() => vi.useRealTimers());

	it('swallows the next click (stops propagation + default) then lets later clicks through', () => {
		const parent = document.createElement('div');
		const btn = document.createElement('button');
		parent.appendChild(btn);
		document.body.appendChild(parent);
		const parentClick = vi.fn();
		parent.addEventListener('click', parentClick);

		suppressNextClickOn(btn);

		const first = new MouseEvent('click', { bubbles: true, cancelable: true });
		btn.dispatchEvent(first);
		expect(first.defaultPrevented).toBe(true);
		expect(parentClick).not.toHaveBeenCalled(); // propagation stopped

		const second = new MouseEvent('click', { bubbles: true, cancelable: true });
		btn.dispatchEvent(second);
		expect(second.defaultPrevented).toBe(false);
		expect(parentClick).toHaveBeenCalledTimes(1); // handler already detached

		parent.remove();
	});

	it('detaches itself after the max wait window with no click', () => {
		vi.useFakeTimers();
		const parent = document.createElement('div');
		const btn = document.createElement('button');
		parent.appendChild(btn);
		document.body.appendChild(parent);
		const parentClick = vi.fn();
		parent.addEventListener('click', parentClick);

		suppressNextClickOn(btn, 200);
		vi.advanceTimersByTime(200);

		const click = new MouseEvent('click', { bubbles: true, cancelable: true });
		btn.dispatchEvent(click);
		expect(click.defaultPrevented).toBe(false);
		expect(parentClick).toHaveBeenCalledTimes(1);

		parent.remove();
	});
});

describe('usePauseOnHidden', () => {
	const setHidden = (hidden: boolean) => {
		Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
		document.dispatchEvent(new Event('visibilitychange'));
	};

	beforeEach(() => {
		setActivePinia(createPinia());
		Object.defineProperty(document, 'hidden', { value: false, configurable: true });
	});

	it('pauses active timers when hidden and resumes them when visible', () => {
		const timer = { isActive: ref(true), pause: vi.fn(), resume: vi.fn() };
		usePauseOnHidden(timer);

		setHidden(true);
		expect(timer.pause).toHaveBeenCalledTimes(1);

		setHidden(false);
		expect(timer.resume).toHaveBeenCalledTimes(1);
	});

	it('leaves inactive timers alone (never resumes a timer it did not pause)', () => {
		const timer = { isActive: ref(false), pause: vi.fn(), resume: vi.fn() };
		usePauseOnHidden(timer);

		setHidden(true);
		setHidden(false);

		expect(timer.pause).not.toHaveBeenCalled();
		expect(timer.resume).not.toHaveBeenCalled();
	});
});

describe('useDragAutoScroll', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it('findScrollableAncestor returns the nearest overflow-scrolling ancestor', () => {
		const scroller = document.createElement('div');
		scroller.style.overflowY = 'auto';
		Object.defineProperty(scroller, 'scrollHeight', { value: 1000, configurable: true });
		Object.defineProperty(scroller, 'clientHeight', { value: 100, configurable: true });
		const child = document.createElement('div');
		scroller.appendChild(child);
		document.body.appendChild(scroller);

		const { result, unmount } = withSetup(() =>
			useDragAutoScroll({ pointer: ref({ x: 0, y: 0 }), target: ref(null) })
		);
		expect(result.findScrollableAncestor(child)).toBe(scroller);
		unmount();
		scroller.remove();
	});

	it('falls back to window when nothing scrolls', () => {
		const plain = document.createElement('div');
		document.body.appendChild(plain);
		const { result, unmount } = withSetup(() =>
			useDragAutoScroll({ pointer: ref({ x: 0, y: 0 }), target: ref(null) })
		);
		expect(result.findScrollableAncestor(plain)).toBe(window);
		unmount();
		plain.remove();
	});

	it('start/stop toggle the raf active flag', () => {
		const { result, unmount } = withSetup(() =>
			useDragAutoScroll({ pointer: ref({ x: 0, y: 0 }), target: ref(window) })
		);
		expect(result.isActive.value).toBe(false);
		result.start();
		expect(result.isActive.value).toBe(true);
		result.stop();
		expect(result.isActive.value).toBe(false);
		unmount();
	});
});

describe('useLongPressDrag', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
	});
	afterEach(() => vi.useRealTimers());

	it('mouse: activates immediately on pointerdown and commits on pointerup', () => {
		const onActivate = vi.fn();
		const onCommit = vi.fn();
		const onMove = vi.fn();
		const { result, unmount } = withSetup(() =>
			useLongPressDrag<string>({ onActivate, onCommit, onMove })
		);
		const target = document.createElement('div');

		result.start(pointerEvent('pointerdown', { pointerType: 'mouse', target }), 'card-1');
		expect(onActivate).toHaveBeenCalledTimes(1);
		expect(result.activePayload.value).toBe('card-1');

		// drag past the threshold marks it moved
		window.dispatchEvent(pointerEvent('pointermove', { x: 50, y: 50 }));
		expect(result.isMoved.value).toBe(true);
		expect(onMove).toHaveBeenCalled();

		window.dispatchEvent(pointerEvent('pointerup', { x: 50, y: 50 }));
		expect(onCommit).toHaveBeenCalledTimes(1);
		expect(onCommit.mock.calls[0]![2]).toMatchObject({ moved: true, wasCancel: false });
		expect(result.activePayload.value).toBeNull();
		unmount();
	});

	it('touch: waits for the hold delay before activating', () => {
		vi.useFakeTimers();
		const onActivate = vi.fn();
		const { result, unmount } = withSetup(() =>
			useLongPressDrag<string>({ onActivate, holdMs: 180 })
		);
		const target = document.createElement('div');

		result.start(pointerEvent('pointerdown', { pointerType: 'touch', target }), 'card-1');
		// pending, not yet active
		expect(result.pendingPayload.value).toBe('card-1');
		expect(onActivate).not.toHaveBeenCalled();

		vi.advanceTimersByTime(180);
		expect(onActivate).toHaveBeenCalledTimes(1);
		expect(result.activePayload.value).toBe('card-1');
		unmount();
	});

	it('touch: a quick pointerup before the hold fires a tap, never activates', () => {
		vi.useFakeTimers();
		const onActivate = vi.fn();
		const onTap = vi.fn();
		const { result, unmount } = withSetup(() =>
			useLongPressDrag<string>({ onActivate, onTap, holdMs: 180 })
		);
		const target = document.createElement('div');

		result.start(pointerEvent('pointerdown', { pointerType: 'touch', target }), 'card-1');
		window.dispatchEvent(pointerEvent('pointerup'));

		vi.advanceTimersByTime(180);
		expect(onTap).toHaveBeenCalledWith('card-1');
		expect(onActivate).not.toHaveBeenCalled();
		unmount();
	});

	it('touch: drifting past tolerance before the hold cancels the pickup (treated as scroll)', () => {
		vi.useFakeTimers();
		const onActivate = vi.fn();
		const { result, unmount } = withSetup(() =>
			useLongPressDrag<string>({ onActivate, holdMs: 180, moveTolerance: 14 })
		);
		const target = document.createElement('div');

		result.start(pointerEvent('pointerdown', { pointerType: 'touch', target }), 'card-1');
		window.dispatchEvent(pointerEvent('pointermove', { x: 40, y: 0 })); // > tolerance
		expect(result.pendingPayload.value).toBeNull();

		vi.advanceTimersByTime(180);
		expect(onActivate).not.toHaveBeenCalled();
		unmount();
	});

	it('ignores a second pointerdown while a drag is already pending/active', () => {
		const onActivate = vi.fn();
		const { result, unmount } = withSetup(() => useLongPressDrag<string>({ onActivate }));
		const target = document.createElement('div');

		result.start(pointerEvent('pointerdown', { pointerType: 'mouse', target }), 'first');
		result.start(pointerEvent('pointerdown', { pointerType: 'mouse', target }), 'second');

		expect(onActivate).toHaveBeenCalledTimes(1);
		expect(result.activePayload.value).toBe('first');
		unmount();
	});
});

describe('useFormDraft', () => {
	const KEY = 'earth-app:draft:article';

	beforeEach(() => {
		setActivePinia(createPinia());
		window.localStorage.clear();
		useToast().clear();
	});
	afterEach(() => vi.useRealTimers());

	it('builds the storage key from kind, user and scope', () => {
		const state = reactive({ title: '' });
		const { result, unmount } = withSetup(() =>
			useFormDraft(state, { kind: 'prompt', userId: 'u1', scope: 'edit' })
		);
		expect(result.storageKey.value).toBe('earth-app:draft:prompt:user:u1:edit');
		unmount();
	});

	it('restores a saved draft on mount and toasts', async () => {
		window.localStorage.setItem(KEY, JSON.stringify({ title: 'Half-written', body: 'draft body' }));
		const state = reactive({ title: '', body: '' });

		const { result, unmount } = withSetup(() => useFormDraft(state, { kind: 'article' }));
		await nextTick(); // flush the onMounted restore

		expect(state.title).toBe('Half-written');
		expect(state.body).toBe('draft body');
		expect(result.hasRestored.value).toBe(true);
		expect(useToast().toasts.value.some((t) => /draft/i.test(String(t.title)))).toBe(true);
		unmount();
	});

	it('debounce-writes state changes to storage', async () => {
		vi.useFakeTimers();
		const state = reactive({ title: '', body: '' });
		const { unmount } = withSetup(() => useFormDraft(state, { kind: 'article', debounceMs: 600 }));
		await nextTick();

		state.title = 'New thoughts';
		await nextTick(); // flush the watcher so the debounce timer is scheduled
		expect(window.localStorage.getItem(KEY)).toBeNull(); // not yet (debounced)

		vi.advanceTimersByTime(600);
		expect(JSON.parse(window.localStorage.getItem(KEY)!).title).toBe('New thoughts');
		unmount();
	});

	it('clear() removes the persisted draft', () => {
		window.localStorage.setItem(KEY, JSON.stringify({ title: 'x' }));
		const state = reactive({ title: '' });
		const { result, unmount } = withSetup(() => useFormDraft(state, { kind: 'article' }));

		result.clear();
		expect(window.localStorage.getItem(KEY)).toBeNull();
		unmount();
	});
});
