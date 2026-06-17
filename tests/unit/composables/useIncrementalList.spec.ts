import { afterEach, describe, expect, it, vi } from 'vitest';
import { useIncrementalList } from '~/composables/useIncrementalList';

// useIncrementalList reveals fetched items one-at-a-time (staggered) and uses a
// monotonic token so a superseding load()/reset() cancels an in-flight reveal.
// e2e never exercises the cancellation/stagger edges, so they live here.

const snap = <T>(list: readonly T[]) => [...list];

describe('useIncrementalList', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('starts empty with the initial expected count', () => {
		const list = useIncrementalList<number>({ initialExpectedCount: 5 });
		expect(snap(list.items)).toEqual([]);
		expect(list.expectedCount).toBe(5);
		expect(list.remaining).toBe(5);
		expect(list.isLoading).toBe(false);
		expect(list.error).toBeNull();
	});

	it('pushes the whole batch at once when stagger is 0', async () => {
		const list = useIncrementalList<number>({ staggerMs: 0 });
		await list.load(async () => [1, 2, 3]);

		expect(snap(list.items)).toEqual([1, 2, 3]);
		// expected count reconciles to what actually arrived
		expect(list.expectedCount).toBe(3);
		expect(list.remaining).toBe(0);
		expect(list.isLoading).toBe(false);
	});

	it('replaces existing items by default but appends with keepExisting', async () => {
		const list = useIncrementalList<number>({ staggerMs: 0 });
		await list.load(async () => [1, 2]);
		await list.load(async () => [3, 4]);
		expect(snap(list.items)).toEqual([3, 4]);

		await list.load(async () => [5, 6], { keepExisting: true });
		expect(snap(list.items)).toEqual([3, 4, 5, 6]);
		expect(list.expectedCount).toBe(4);
	});

	it('clamps the expected count to what arrived when the loader returns empty', async () => {
		const list = useIncrementalList<number>({ staggerMs: 0, initialExpectedCount: 10 });
		await list.load(async () => []);
		expect(snap(list.items)).toEqual([]);
		expect(list.expectedCount).toBe(0);
		expect(list.remaining).toBe(0);
	});

	it('honors an expectedHint so the skeleton count is known before items arrive', async () => {
		const list = useIncrementalList<number>({ staggerMs: 0 });
		const p = list.load(async () => [1, 2, 3], { expectedHint: 3 });
		// hint applied synchronously, before the loader resolves
		expect(list.expectedCount).toBe(3);
		await p;
		expect(list.expectedCount).toBe(3);
	});

	it('records an error and clears loading when the loader throws', async () => {
		const list = useIncrementalList<number>({ staggerMs: 0, initialExpectedCount: 4 });
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

		await list.load(async () => {
			throw new Error('kaboom');
		});

		expect(typeof list.error).toBe('string');
		expect(list.error).toBeTruthy();
		expect(list.isLoading).toBe(false);
		// expected count collapses to the (empty) item count so the UI stops waiting
		expect(list.expectedCount).toBe(0);
		spy.mockRestore();
	});

	it('reveals items one at a time on the stagger cadence', async () => {
		vi.useFakeTimers();
		const list = useIncrementalList<string>({ staggerMs: 100 });

		const p = list.load(async () => ['a', 'b', 'c']);
		// flush the loader microtask: first item is pushed before the first sleep
		await vi.advanceTimersByTimeAsync(0);
		expect(snap(list.items)).toEqual(['a']);
		expect(list.isLoading).toBe(true);

		await vi.advanceTimersByTimeAsync(100);
		expect(snap(list.items)).toEqual(['a', 'b']);

		await vi.advanceTimersByTimeAsync(100);
		expect(snap(list.items)).toEqual(['a', 'b', 'c']);

		// trailing sleep after the last item still keeps it loading until it elapses
		await vi.advanceTimersByTimeAsync(100);
		expect(list.isLoading).toBe(false);
		await p;
	});

	it('cancels an in-flight staggered reveal when a new load supersedes it', async () => {
		vi.useFakeTimers();
		const list = useIncrementalList<string>({ staggerMs: 100 });

		const p1 = list.load(async () => ['a', 'b', 'c']);
		await vi.advanceTimersByTimeAsync(0);
		expect(snap(list.items)).toEqual(['a']);

		// supersede mid-reveal — clears items and bumps the token
		const p2 = list.load(async () => ['x', 'y']);
		await vi.advanceTimersByTimeAsync(0);
		expect(snap(list.items)).toEqual(['x']);

		await vi.advanceTimersByTimeAsync(100); // y
		await vi.advanceTimersByTimeAsync(100); // trailing sleep
		await Promise.all([p1, p2]);

		// the first load's b/c never leak in
		expect(snap(list.items)).toEqual(['x', 'y']);
		expect(list.isLoading).toBe(false);
	});

	it('reset cancels an in-flight reveal and restores the expected count', async () => {
		vi.useFakeTimers();
		const list = useIncrementalList<string>({ staggerMs: 100, initialExpectedCount: 2 });

		const p = list.load(async () => ['a', 'b', 'c']);
		await vi.advanceTimersByTimeAsync(0);
		expect(snap(list.items)).toEqual(['a']);

		list.reset(7);
		expect(snap(list.items)).toEqual([]);
		expect(list.expectedCount).toBe(7);
		expect(list.isLoading).toBe(false);
		expect(list.error).toBeNull();

		// let the orphaned reveal run out — it must not repopulate the list
		await vi.advanceTimersByTimeAsync(300);
		await p;
		expect(snap(list.items)).toEqual([]);
	});

	it('reset falls back to the initial expected count when none is given', async () => {
		const list = useIncrementalList<number>({ staggerMs: 0, initialExpectedCount: 3 });
		await list.load(async () => [1, 2]);
		list.reset();
		expect(list.expectedCount).toBe(3);
	});
});
