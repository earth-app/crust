import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from 'stores/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OnboardingState } from '~/composables/useOnboarding';
import { ONBOARDING_CHECKLIST, useOnboarding } from '~/composables/useOnboarding';

// makeClientAPIRequest is auto-imported; valid() stays real via the spread
vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return { ...actual, makeClientAPIRequest: vi.fn() };
});

import { makeClientAPIRequest } from 'utils';

const ok = <T>(data: T) => ({ success: true as const, data });
const fail = (message = 'boom') => ({ success: false as const, message });

const stateOf = (over: Partial<OnboardingState> = {}): OnboardingState => ({
	user_id: 'u1',
	completed_steps: [],
	interests: [],
	started_at: 1,
	finished_at: null,
	dismissed_at: null,
	updated_at: 1,
	...over
});

const STEP_IDS = ONBOARDING_CHECKLIST.map((s) => s.id);
const TOTAL = ONBOARDING_CHECKLIST.length;

describe('useOnboarding', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
		useAuthStore().currentUser = { id: 'u1' } as any;
		// module-level singleton state — reset between tests (clears state/fetched/error/lastUserId)
		const ob = useOnboarding();
		ob.reset();
		ob.loading.value = false;
	});

	describe('computed progress with no state yet', () => {
		it('reports zero done, the full total, and the first checklist step as next', () => {
			const { progress, nextStep, isComplete, isDismissed } = useOnboarding();
			expect(progress.value).toEqual({ done: 0, total: TOTAL });
			expect(nextStep.value.id).toBe(STEP_IDS[0]);
			expect(isComplete.value).toBe(false);
			expect(isDismissed.value).toBe(false);
		});
	});

	describe('fetchState', () => {
		it('does nothing when signed out', async () => {
			useAuthStore().currentUser = null;
			await useOnboarding().fetchState();
			expect(makeClientAPIRequest).not.toHaveBeenCalled();
		});

		it('loads state and marks fetched', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(
				ok({ state: stateOf({ completed_steps: [STEP_IDS[0]!] }) })
			);
			const ob = useOnboarding();

			await ob.fetchState();

			expect(ob.fetched.value).toBe(true);
			expect(ob.progress.value).toEqual({ done: 1, total: TOTAL });
			// next step is the first not-yet-completed checklist entry
			expect(ob.nextStep.value.id).toBe(STEP_IDS[1]);
		});

		it('skips a second fetch unless forced', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(ok({ state: stateOf() }));
			const ob = useOnboarding();

			await ob.fetchState();
			await ob.fetchState(); // cached
			expect(makeClientAPIRequest).toHaveBeenCalledTimes(1);

			await ob.fetchState(true); // forced
			expect(makeClientAPIRequest).toHaveBeenCalledTimes(2);
		});
	});

	describe('isComplete', () => {
		it('is true when finished_at is set', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(ok({ state: stateOf({ finished_at: 123 }) }));
			const ob = useOnboarding();
			await ob.fetchState();
			expect(ob.isComplete.value).toBe(true);
		});

		it('is true when every checklist step is completed', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(
				ok({ state: stateOf({ completed_steps: [...STEP_IDS] }) })
			);
			const ob = useOnboarding();
			await ob.fetchState();
			expect(ob.isComplete.value).toBe(true);
		});
	});

	describe('completeStep', () => {
		it('records a new step and updates state', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(
				ok({ state: stateOf({ completed_steps: ['pick_interests'] }) })
			);
			const ob = useOnboarding();

			const done = await ob.completeStep('pick_interests');

			expect(done).toBe(true);
			const [path, , opts] = (makeClientAPIRequest as any).mock.calls[0];
			expect(path).toBe('/v2/users/current/onboarding/step');
			expect(opts.method).toBe('POST');
			expect(opts.body).toEqual({ step: 'pick_interests' });
			expect(ob.state.value?.completed_steps).toContain('pick_interests');
		});

		it('short-circuits an already-completed step without a request', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(
				ok({ state: stateOf({ completed_steps: ['welcome'] }) })
			);
			const ob = useOnboarding();
			await ob.fetchState();
			(makeClientAPIRequest as any).mockClear();

			const done = await ob.completeStep('welcome');
			expect(done).toBe(true);
			expect(makeClientAPIRequest).not.toHaveBeenCalled();
		});

		it('dedupes concurrent calls for the same step (in-flight guard)', async () => {
			let resolve!: (v: unknown) => void;
			(makeClientAPIRequest as any).mockReturnValue(
				new Promise((r) => {
					resolve = r;
				})
			);
			const ob = useOnboarding();

			const first = ob.completeStep('first_friend');
			const second = ob.completeStep('first_friend'); // racing the in-flight POST

			expect(await second).toBe(false); // bailed on the guard
			resolve(ok({ state: stateOf({ completed_steps: ['first_friend'] }) }));
			expect(await first).toBe(true);
			expect(makeClientAPIRequest).toHaveBeenCalledTimes(1);
		});

		it('returns false when the request fails', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(fail());
			const ob = useOnboarding();
			expect(await ob.completeStep('first_activity')).toBe(false);
		});

		it('returns false (caught) when the request throws', async () => {
			(makeClientAPIRequest as any).mockRejectedValue(new Error('network'));
			const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const ob = useOnboarding();
			expect(await ob.completeStep('first_activity')).toBe(false);
			spy.mockRestore();
		});
	});

	describe('setPersona', () => {
		it('posts the persona and interests and stores the returned state', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(
				ok({ state: stateOf({ persona: 'explorer', interests: ['hiking'] }) })
			);
			const ob = useOnboarding();

			const done = await ob.setPersona('explorer', ['hiking']);

			expect(done).toBe(true);
			const [path, , opts] = (makeClientAPIRequest as any).mock.calls[0];
			expect(path).toBe('/v2/users/current/onboarding/persona');
			expect(opts.body).toEqual({ persona: 'explorer', interests: ['hiking'] });
			expect(ob.state.value?.persona).toBe('explorer');
		});
	});

	describe('dismiss', () => {
		it('returns true and marks the onboarding dismissed on success', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(
				ok({ state: stateOf({ dismissed_at: 999 }) })
			);
			const ob = useOnboarding();

			expect(await ob.dismiss()).toBe(true);
			expect(ob.isDismissed.value).toBe(true);
		});

		it('returns false and stays undismissed when the request fails', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(fail());
			const ob = useOnboarding();
			ob.state.value = stateOf();

			expect(await ob.dismiss()).toBe(false);
			expect(ob.isDismissed.value).toBe(false);
		});
	});

	describe('fetchState failure', () => {
		it('keeps prior state and flags error on a failed refetch', async () => {
			(makeClientAPIRequest as any).mockResolvedValueOnce(
				ok({ state: stateOf({ completed_steps: ['welcome'] }) })
			);
			const ob = useOnboarding();
			await ob.fetchState();
			expect(ob.error.value).toBe(false);

			(makeClientAPIRequest as any).mockResolvedValueOnce(fail());
			await ob.fetchState(true);

			expect(ob.error.value).toBe(true);
			// prior state is preserved, not wiped
			expect(ob.state.value?.completed_steps).toContain('welcome');
		});

		it('flags error (and stays retryable) when the request throws', async () => {
			const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			(makeClientAPIRequest as any).mockRejectedValueOnce(new Error('net'));
			const ob = useOnboarding();
			await ob.fetchState();
			expect(ob.error.value).toBe(true);

			// a retry that succeeds clears the error
			(makeClientAPIRequest as any).mockResolvedValueOnce(ok({ state: stateOf() }));
			await ob.fetchState(true);
			expect(ob.error.value).toBe(false);
			spy.mockRestore();
		});

		it('coerces a malformed payload to safe arrays so watchers cannot throw', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(
				ok({
					state: {
						user_id: 'u1',
						started_at: 1,
						finished_at: null,
						dismissed_at: null,
						updated_at: 1
					}
				})
			);
			const ob = useOnboarding();
			await ob.fetchState();

			expect(ob.state.value?.completed_steps).toEqual([]);
			expect(ob.state.value?.interests).toEqual([]);
			expect(ob.progress.value).toEqual({ done: 0, total: TOTAL });
		});
	});

	describe('cross-user reset', () => {
		it('drops the previous user state so User B never inherits User A', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(
				ok({ state: stateOf({ user_id: 'u1', dismissed_at: 111 }) })
			);
			const ob = useOnboarding();
			await ob.fetchState();
			expect(ob.isDismissed.value).toBe(true);

			// user B signs in
			useAuthStore().currentUser = { id: 'u2' } as any;
			(makeClientAPIRequest as any).mockResolvedValue(ok({ state: stateOf({ user_id: 'u2' }) }));
			await ob.fetchState();

			expect(ob.state.value?.user_id).toBe('u2');
			expect(ob.isDismissed.value).toBe(false);
		});
	});

	describe('completeStep merge', () => {
		it('unions out-of-order concurrent completions so no step is dropped', async () => {
			let resolveA!: (v: unknown) => void;
			let resolveB!: (v: unknown) => void;
			(makeClientAPIRequest as any)
				.mockImplementationOnce(() => new Promise((r) => (resolveA = r)))
				.mockImplementationOnce(() => new Promise((r) => (resolveB = r)));
			const ob = useOnboarding();
			ob.state.value = stateOf({ completed_steps: [] });

			const pA = ob.completeStep('first_activity');
			const pB = ob.completeStep('first_friend');

			// B resolves first, then A resolves last with a snapshot missing first_friend
			resolveB(ok({ state: stateOf({ completed_steps: ['first_friend'] }) }));
			await pB;
			resolveA(ok({ state: stateOf({ completed_steps: ['first_activity'] }) }));
			await pA;

			expect(ob.state.value?.completed_steps).toContain('first_activity');
			expect(ob.state.value?.completed_steps).toContain('first_friend');
		});
	});

	describe('isComplete ignores the optional avatar row', () => {
		it('is complete when all required steps are done even without generate_avatar', async () => {
			const required = STEP_IDS.filter((id) => id !== 'generate_avatar');
			(makeClientAPIRequest as any).mockResolvedValue(
				ok({ state: stateOf({ completed_steps: required }) })
			);
			const ob = useOnboarding();
			await ob.fetchState();

			expect(ob.state.value?.completed_steps).not.toContain('generate_avatar');
			expect(ob.isComplete.value).toBe(true);
		});
	});

	describe('flat progress getters', () => {
		it('exposes completedCount and totalSteps for the dashboard card', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(
				ok({ state: stateOf({ completed_steps: ['welcome', 'pick_interests'] }) })
			);
			const ob = useOnboarding();
			await ob.fetchState();

			expect(ob.completedCount.value).toBe(2);
			expect(ob.totalSteps.value).toBe(TOTAL);
		});
	});
});
