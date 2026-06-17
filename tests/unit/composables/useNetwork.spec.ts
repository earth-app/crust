import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	enqueueMutation,
	isOffline,
	networkOffline,
	pendingMutations,
	registerMutationDispatcher,
	replayPendingMutations,
	runOrQueue
} from '~/composables/useNetwork';

// offline-queue replay/retry semantics are impossible to drive from e2e (no real
// offline→online transition with persisted mutations), so they're covered here.

const STORAGE_KEY = 'earth-app:offline-queue';
const readQueue = () => JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');

describe('useNetwork offline queue', () => {
	beforeEach(() => {
		// module-level singleton state — reset between tests
		pendingMutations.value = [];
		networkOffline.value = false;
		window.localStorage.clear();
	});

	describe('enqueueMutation', () => {
		it('appends a mutation and persists it to localStorage', () => {
			enqueueMutation('mark-read', { id: 'n1' });

			expect(pendingMutations.value).toHaveLength(1);
			const entry = pendingMutations.value[0]!;
			expect(entry.kind).toBe('mark-read');
			expect(entry.payload).toEqual({ id: 'n1' });
			expect(entry.attempts).toBe(0);
			expect(readQueue()).toHaveLength(1);
		});
	});

	describe('runOrQueue', () => {
		it('queues without running the executor when offline', async () => {
			networkOffline.value = true;
			const executor = vi.fn();

			const res = await runOrQueue('mark-read', { id: 'n1' }, executor);

			expect(res).toEqual({ executed: false, queued: true });
			expect(executor).not.toHaveBeenCalled();
			expect(pendingMutations.value).toHaveLength(1);
		});

		it('runs the executor and returns its result when online', async () => {
			const executor = vi.fn().mockResolvedValue('done');

			const res = await runOrQueue('mark-read', undefined, executor);

			expect(res).toEqual({ executed: true, queued: false, result: 'done' });
			expect(pendingMutations.value).toHaveLength(0);
		});

		it('queues on a network-shaped error', async () => {
			const executor = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

			const res = await runOrQueue('dismiss-onboarding', undefined, executor);

			expect(res).toEqual({ executed: false, queued: true });
			expect(pendingMutations.value).toHaveLength(1);
		});

		it('queues when the error carries a network status code', async () => {
			const executor = vi.fn().mockRejectedValue({ statusCode: 0 });

			const res = await runOrQueue('mark-read', undefined, executor);

			expect(res.queued).toBe(true);
		});

		it('rethrows a non-network error and does not queue', async () => {
			const executor = vi.fn().mockRejectedValue(new Error('validation rejected'));

			await expect(runOrQueue('mark-read', undefined, executor)).rejects.toThrow(
				/validation rejected/
			);
			expect(pendingMutations.value).toHaveLength(0);
		});
	});

	describe('replayPendingMutations', () => {
		it('does nothing while offline', async () => {
			networkOffline.value = true;
			enqueueMutation('mark-read');
			const dispatcher = vi.fn().mockResolvedValue(true);
			registerMutationDispatcher('mark-read', dispatcher);

			await replayPendingMutations();

			expect(dispatcher).not.toHaveBeenCalled();
			expect(pendingMutations.value).toHaveLength(1);
		});

		it('removes a mutation whose dispatcher succeeds', async () => {
			enqueueMutation('mark-read', { id: 'n1' });
			registerMutationDispatcher('mark-read', vi.fn().mockResolvedValue(true));

			await replayPendingMutations();

			expect(pendingMutations.value).toHaveLength(0);
			expect(readQueue()).toHaveLength(0);
		});

		it('keeps a failing mutation and increments its attempt counter', async () => {
			enqueueMutation('mark-read', { id: 'n1' });
			registerMutationDispatcher('mark-read', vi.fn().mockResolvedValue(false));

			await replayPendingMutations();

			expect(pendingMutations.value).toHaveLength(1);
			expect(pendingMutations.value[0]!.attempts).toBe(1);
		});

		it('drops a mutation after the max attempts are exhausted', async () => {
			enqueueMutation('mark-read', { id: 'n1' });
			registerMutationDispatcher('mark-read', vi.fn().mockResolvedValue(false));

			// MAX_ATTEMPTS is 5 — five failed replays should evict it
			for (let i = 0; i < 5; i++) await replayPendingMutations();

			expect(pendingMutations.value).toHaveLength(0);
		});

		it('treats a thrown dispatcher like a failure (counts an attempt)', async () => {
			enqueueMutation('mark-read', { id: 'n1' });
			registerMutationDispatcher('mark-read', vi.fn().mockRejectedValue(new Error('boom')));

			await replayPendingMutations();

			expect(pendingMutations.value).toHaveLength(1);
			expect(pendingMutations.value[0]!.attempts).toBe(1);
		});

		it('removes only the successful kinds and leaves the rest queued', async () => {
			enqueueMutation('mark-read', { id: 'n1' });
			enqueueMutation('dismiss-onboarding');
			registerMutationDispatcher('mark-read', vi.fn().mockResolvedValue(true));
			registerMutationDispatcher('dismiss-onboarding', vi.fn().mockResolvedValue(false));

			await replayPendingMutations();

			expect(pendingMutations.value).toHaveLength(1);
			expect(pendingMutations.value[0]!.kind).toBe('dismiss-onboarding');
		});
	});

	it('isOffline mirrors networkOffline', () => {
		networkOffline.value = true;
		expect(isOffline.value).toBe(true);
		networkOffline.value = false;
		expect(isOffline.value).toBe(false);
	});
});
