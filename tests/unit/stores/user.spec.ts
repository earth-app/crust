import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from 'stores/auth';
import { isValidUser, useUserStore } from 'stores/user';
import type { User } from 'types/user';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// mock the network layer (imported at module load from the utils alias). keep pure
// helpers (valid, etc) real via the spread; paginatedAPIRequest is mocked too so the
// event/submission fetches don't fan out through the real cache machinery
vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return {
		...actual,
		makeAPIRequest: vi.fn(),
		makeClientAPIRequest: vi.fn(),
		makeServerRequest: vi.fn(),
		paginatedAPIRequest: vi.fn(),
		invalidateAPICache: vi.fn()
	};
});

import { makeAPIRequest, makeClientAPIRequest, paginatedAPIRequest } from 'utils';

const mkUser = (id: string, username: string, over: Partial<User> = {}): User =>
	({
		id,
		username,
		is_admin: false,
		account: { account_type: 'FREE' },
		...over
	}) as unknown as User;

// drive the auth store's currentUser without going through the network
const setAuthUser = (user: User | null) => {
	const auth = useAuthStore();
	(auth as any).currentUser = user;
	return auth;
};

describe('user store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		// resetAllMocks (not clearAllMocks) so a prior test's mockResolvedValue can't leak into a
		// later test's default undefined-return expectation
		vi.resetAllMocks();
	});

	describe('isValidUser', () => {
		it('accepts an object with a non-empty string id and string username', () => {
			expect(isValidUser({ id: 'u1', username: 'alice' })).toBe(true);
		});

		it('rejects null / non-objects / arrays', () => {
			expect(isValidUser(null)).toBe(false);
			expect(isValidUser(undefined)).toBe(false);
			expect(isValidUser('nope')).toBe(false);
			expect(isValidUser(42)).toBe(false);
			// partial-serialization [] must be rejected
			expect(isValidUser([])).toBe(false);
		});

		it('rejects missing/empty id or non-string username', () => {
			expect(isValidUser({ username: 'alice' })).toBe(false);
			expect(isValidUser({ id: '', username: 'alice' })).toBe(false);
			expect(isValidUser({ id: 'u1' })).toBe(false);
			expect(isValidUser({ id: 'u1', username: 42 })).toBe(false);
		});
	});

	describe('get / has / isLoading three-state', () => {
		it('get returns undefined for an empty identifier and unseen ids', () => {
			const store = useUserStore();
			expect(store.get('')).toBeUndefined();
			expect(store.get('never-seen')).toBeUndefined();
			expect(store.has('')).toBe(false);
			expect(store.has('never-seen')).toBe(false);
		});

		it('get returns the loaded user once cached', () => {
			const store = useUserStore();
			const u = mkUser('u1', 'alice');
			store.cache.set('u1', u);
			expect(store.get('u1')).toEqual(u);
			expect(store.has('u1')).toBe(true);
		});

		it('get returns null (not-found) when cached as null', () => {
			const store = useUserStore();
			store.cache.set('ghost', null);
			expect(store.get('ghost')).toBeNull();
			// has is true even for a null entry — distinguishes not-found from never-seen
			expect(store.has('ghost')).toBe(true);
		});

		it('get returns undefined (loading) while a fetch is in flight with nothing valid cached', () => {
			const store = useUserStore();
			store.loading.add('u1');
			// no cache entry yet -> stay in loading branch
			expect(store.get('u1')).toBeUndefined();
		});

		it('get returns the cached value even while loading if a valid one already exists', () => {
			const store = useUserStore();
			const u = mkUser('u1', 'alice');
			store.cache.set('u1', u);
			store.loading.add('u1');
			expect(store.get('u1')).toEqual(u);
		});

		it('get stays in loading (undefined) when a null is cached and a refetch is running', () => {
			const store = useUserStore();
			store.cache.set('u1', null);
			store.loading.add('u1');
			// cache.get('u1') is null (falsy) -> the loading guard wins, returns undefined
			expect(store.get('u1')).toBeUndefined();
		});

		it('isLoading is false for null/undefined/empty identifiers', () => {
			const store = useUserStore();
			expect(store.isLoading(null)).toBe(false);
			expect(store.isLoading(undefined)).toBe(false);
			expect(store.isLoading('')).toBe(false);
		});
	});

	describe('users computed (dedup)', () => {
		it('skips nulls and dedups by id across multiple keys', () => {
			const store = useUserStore();
			const alice = mkUser('u1', 'alice');
			// same user under both id and username keys
			store.cache.set('u1', alice);
			store.cache.set('alice', alice);
			store.cache.set('@alice', alice);
			store.cache.set('ghost', null);
			store.cache.set('u2', mkUser('u2', 'bob'));

			const ids = store.users.map((u) => u.id);
			expect(ids).toEqual(['u1', 'u2']);
		});
	});

	describe('getChipColor / getMaxEventAttendees', () => {
		it('getChipColor maps account types and returns undefined for unknown/none', () => {
			const store = useUserStore();
			expect(store.getChipColor(null)).toBeUndefined();
			expect(
				store.getChipColor(mkUser('u', 'a', { account: { account_type: 'PRO' } as any }))
			).toBe('secondary');
			expect(
				store.getChipColor(mkUser('u', 'a', { account: { account_type: 'WRITER' } as any }))
			).toBe('primary');
			expect(
				store.getChipColor(mkUser('u', 'a', { account: { account_type: 'ORGANIZER' } as any }))
			).toBe('warning');
			expect(
				store.getChipColor(mkUser('u', 'a', { account: { account_type: 'ADMINISTRATOR' } as any }))
			).toBe('error');
			expect(
				store.getChipColor(mkUser('u', 'a', { account: { account_type: 'FREE' } as any }))
			).toBeUndefined();
		});

		it('getMaxEventAttendees maps tiers, defaults 1000, and 0 for no user', () => {
			const store = useUserStore();
			expect(store.getMaxEventAttendees(null)).toBe(0);
			expect(
				store.getMaxEventAttendees(mkUser('u', 'a', { account: { account_type: 'FREE' } as any }))
			).toBe(1000);
			expect(
				store.getMaxEventAttendees(mkUser('u', 'a', { account: { account_type: 'PRO' } as any }))
			).toBe(5000);
			expect(
				store.getMaxEventAttendees(mkUser('u', 'a', { account: { account_type: 'WRITER' } as any }))
			).toBe(5000);
			expect(
				store.getMaxEventAttendees(
					mkUser('u', 'a', { account: { account_type: 'ORGANIZER' } as any })
				)
			).toBe(1_000_000);
			expect(
				store.getMaxEventAttendees(
					mkUser('u', 'a', { account: { account_type: 'ADMINISTRATOR' } as any })
				)
			).toBe(Infinity);
		});
	});

	describe('fetchUser', () => {
		it('returns null for an empty identifier without touching the network', async () => {
			const store = useUserStore();
			const res = await store.fetchUser('');
			expect(res).toBeNull();
			expect(makeAPIRequest).not.toHaveBeenCalled();
		});

		it('caches a valid user under id + username on success', async () => {
			const store = useUserStore();
			setAuthUser(null);
			const alice = mkUser('u1', 'alice');
			vi.mocked(makeAPIRequest).mockResolvedValue({ success: true, data: alice });

			const res = await store.fetchUser('u1');

			expect(res).toEqual(alice);
			expect(store.cache.get('u1')).toEqual(alice);
			// username also keyed for cross-lookup
			expect(store.cache.get('alice')).toEqual(alice);
		});

		it('returns the cached user without refetching when not forced', async () => {
			const store = useUserStore();
			setAuthUser(null);
			const alice = mkUser('u1', 'alice');
			store.cache.set('u1', alice);

			const res = await store.fetchUser('u1');

			expect(res).toEqual(alice);
			expect(makeAPIRequest).not.toHaveBeenCalled();
		});

		it('caches null (not-found) for a malformed payload on a non-self identifier', async () => {
			const store = useUserStore();
			setAuthUser(null);
			// [] partial-serialization shape — valid() may pass but isValidUser rejects
			vi.mocked(makeAPIRequest).mockResolvedValue({ success: true, data: [] as any });

			const res = await store.fetchUser('stranger');

			expect(res).toBeNull();
			expect(store.cache.get('stranger')).toBeNull();
		});

		it('caches null on a failed (success:false) response', async () => {
			const store = useUserStore();
			setAuthUser(null);
			vi.mocked(makeAPIRequest).mockResolvedValue({ success: false, message: 'not found' });

			const res = await store.fetchUser('stranger');

			expect(res).toBeNull();
			expect(store.cache.get('stranger')).toBeNull();
		});

		it('does NOT poison the cache with null for the self identifier on a malformed payload', async () => {
			const store = useUserStore();
			const me = mkUser('me1', 'gregory');
			setAuthUser(me);
			// server hands back garbage for self (anon/partial poisoning)
			vi.mocked(makeAPIRequest).mockResolvedValue({ success: true, data: [] as any });

			const res = await store.fetchUser('me1');

			// falls back to the auth store's currentUser rather than caching null
			expect(res).toEqual(me);
			expect(store.cache.get('me1')).toEqual(me);
			expect(store.cache.get('me1')).not.toBeNull();
		});

		it('matches self by @username (case-insensitive) for the poison guard', async () => {
			const store = useUserStore();
			const me = mkUser('me1', 'Gregory');
			setAuthUser(me);
			vi.mocked(makeAPIRequest).mockResolvedValue({ success: true, data: [] as any });

			const res = await store.fetchUser('@gregory');

			expect(res).toEqual(me);
			expect(store.cache.get('@gregory')).toEqual(me);
		});

		it('falls back to the auth user (not null) when the self fetch throws', async () => {
			const store = useUserStore();
			const me = mkUser('me1', 'gregory');
			setAuthUser(me);
			vi.mocked(makeAPIRequest).mockRejectedValue(new Error('network'));

			const res = await store.fetchUser('me1');

			expect(res).toEqual(me);
			expect(store.cache.get('me1')).toEqual(me);
		});

		it('caches null when a NON-self fetch throws', async () => {
			const store = useUserStore();
			setAuthUser(null);
			vi.mocked(makeAPIRequest).mockRejectedValue(new Error('network'));

			const res = await store.fetchUser('stranger');

			expect(res).toBeNull();
			expect(store.cache.get('stranger')).toBeNull();
		});

		it('dedups concurrent unforced fetches onto one request', async () => {
			const store = useUserStore();
			setAuthUser(null);
			const alice = mkUser('u1', 'alice');
			let resolve!: (v: any) => void;
			vi.mocked(makeAPIRequest).mockReturnValue(new Promise((res) => (resolve = res)) as any);

			const p1 = store.fetchUser('u1');
			const p2 = store.fetchUser('u1');
			resolve({ success: true, data: alice });
			const [r1, r2] = await Promise.all([p1, p2]);

			expect(r1).toEqual(alice);
			expect(r2).toEqual(alice);
			expect(makeAPIRequest).toHaveBeenCalledTimes(1);
		});
	});

	describe('event / badge / points fetches handle failure as empty', () => {
		it('fetchAttendingEvents stores [] on failure', async () => {
			const store = useUserStore();
			setAuthUser(null);
			vi.mocked(paginatedAPIRequest).mockResolvedValue({ success: false, message: 'x' } as any);

			const res = await store.fetchAttendingEvents('u1');

			expect(res).toEqual([]);
			expect(store.attendingEvents.get('u1')).toEqual([]);
		});

		it('fetchHostingEvents stores the list on success', async () => {
			const store = useUserStore();
			setAuthUser(null);
			const events = [{ id: 'e1' }];
			vi.mocked(paginatedAPIRequest).mockResolvedValue({ success: true, data: events } as any);

			const res = await store.fetchHostingEvents('u1');

			expect(res).toEqual(events);
			expect(store.hostingEvents.get('u1')).toEqual(events);
		});

		it('fetchBadges stores [] on a failed response', async () => {
			const store = useUserStore();
			setAuthUser(null);
			vi.mocked(makeAPIRequest).mockResolvedValue({ success: false, message: 'x' });

			const res = await store.fetchBadges('u1');

			expect(res).toEqual([]);
			expect(store.badges.get('u1')).toEqual([]);
		});

		it('fetchPoints returns [0, []] and stores zeros on failure', async () => {
			const store = useUserStore();
			setAuthUser(null);
			vi.mocked(makeAPIRequest).mockResolvedValue({ success: false, message: 'x' });

			const [pts, history] = await store.fetchPoints('u1');

			expect(pts).toBe(0);
			expect(history).toEqual([]);
			expect(store.points.get('u1')).toBe(0);
			expect(store.pointsHistory.get('u1')).toEqual([]);
		});

		it('fetchPoints stores the returned points + history on success', async () => {
			const store = useUserStore();
			setAuthUser(null);
			vi.mocked(makeAPIRequest).mockResolvedValue({
				success: true,
				data: { points: 42, history: [{ reason: 'quest', difference: 10 }] }
			});

			const [pts, history] = await store.fetchPoints('u1');

			expect(pts).toBe(42);
			expect(history).toEqual([{ reason: 'quest', difference: 10 }]);
		});

		it('empty identifier short-circuits the event/points fetches to empties', async () => {
			const store = useUserStore();
			setAuthUser(null);
			expect(await store.fetchAttendingEvents('')).toEqual([]);
			expect(await store.fetchBadges('')).toEqual([]);
			expect(await store.fetchPoints('')).toEqual([0, []]);
			// no network for any of these
			expect(paginatedAPIRequest).not.toHaveBeenCalled();
			expect(makeAPIRequest).not.toHaveBeenCalled();
		});
	});

	describe('fetchUserQuest + normalizeQuestState', () => {
		it('stores null for a quest payload missing questId/quest (normalized away)', async () => {
			const store = useUserStore();
			setAuthUser(null);
			vi.mocked(makeAPIRequest).mockResolvedValue({
				success: true,
				data: { questId: '', quest: null } as any
			});

			const res = await store.fetchUserQuest('u1');

			expect(res).toBeNull();
			expect(store.quest.get('u1')).toBeNull();
		});

		it('stores a normalized quest state on a complete payload', async () => {
			const store = useUserStore();
			setAuthUser(null);
			const state = {
				questId: 'q1',
				quest: { id: 'q1', steps: [] },
				currentStepIndex: 0,
				completed: false,
				progress: []
			};
			vi.mocked(makeAPIRequest).mockResolvedValue({ success: true, data: state as any });

			const res = await store.fetchUserQuest('u1');

			expect(res).toEqual(state);
			expect(store.quest.get('u1')).toEqual(state);
		});

		it('returns the cached quest without refetching when not forced', async () => {
			const store = useUserStore();
			setAuthUser(null);
			store.quest.set('u1', null);

			const res = await store.fetchUserQuest('u1');

			expect(res).toBeNull();
			expect(makeAPIRequest).not.toHaveBeenCalled();
		});

		it('deletes the quest entry and returns null for an empty identifier', async () => {
			const store = useUserStore();
			setAuthUser(null);
			store.quest.set('', { questId: 'q', quest: {} } as any);
			const res = await store.fetchUserQuest('');
			expect(res).toBeNull();
			expect(store.quest.has('')).toBe(false);
		});
	});

	describe('quest mutations', () => {
		it('endQuest clears local state and bumps the sync version on success', async () => {
			const store = useUserStore();
			setAuthUser(null);
			store.quest.set('u1', { questId: 'q1', quest: { id: 'q1' } } as any);
			vi.mocked(makeClientAPIRequest).mockResolvedValue({
				success: true,
				data: { message: 'ended' }
			});

			const res = await store.endQuest('u1');

			expect(res.message).toBe('ended');
			expect(store.quest.get('u1')).toBeNull();
		});

		it('endQuest returns an error message on failure and leaves state alone', async () => {
			const store = useUserStore();
			setAuthUser(null);
			const active = { questId: 'q1', quest: { id: 'q1' } } as any;
			store.quest.set('u1', active);
			vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: false, message: 'nope' });

			const res = await store.endQuest('u1');

			expect(res.message).toBe('nope');
			expect(store.quest.get('u1')).toEqual(active);
		});

		it('startQuest rejects an empty identifier without a network call', async () => {
			const store = useUserStore();
			setAuthUser(null);
			const res = await store.startQuest('', 'q1');
			expect(res.message).toBe('Invalid identifier');
			expect(makeClientAPIRequest).not.toHaveBeenCalled();
		});

		it('updateQuest reports failure when the server request fails', async () => {
			const store = useUserStore();
			setAuthUser(null);
			const serverRequest = vi.fn().mockResolvedValue({ success: false, message: 'bad' });

			const res = await store.updateQuest('u1', { type: 't', index: 0 }, null, null, serverRequest);

			expect(res).toEqual({ message: 'bad', completed: false, validated: false });
		});

		it('updateQuest does not mutate local progress when validated:false', async () => {
			const store = useUserStore();
			setAuthUser(null);
			const before = {
				questId: 'q1',
				quest: { id: 'q1', steps: [{ type: 't' }] },
				currentStepIndex: 0,
				completed: false,
				progress: []
			};
			store.quest.set('u1', { ...before } as any);
			const serverRequest = vi.fn().mockResolvedValue({
				success: true,
				data: { message: 'ok', completed: false, validated: false }
			});

			await store.updateQuest('u1', { type: 't', index: 0 }, 1, 2, serverRequest);

			// validated false -> applyLocalQuestProgress skipped, progress untouched
			expect((store.quest.get('u1') as any).progress).toEqual([]);
		});
	});

	describe('fetchQuestsList', () => {
		it('populates questsList + questsCache on success', async () => {
			const store = useUserStore();
			setAuthUser(null);
			vi.mocked(makeAPIRequest).mockResolvedValue({
				success: true,
				data: { total: 2, quests: [{ id: 'q1' }, { id: 'q2' }] }
			} as any);

			const quests = await store.fetchQuestsList();

			expect(quests.map((q: any) => q.id)).toEqual(['q1', 'q2']);
			expect([...(store.questsList ?? [])]).toEqual(['q1', 'q2']);
			expect(store.questsCache.get('q1')).toBeTruthy();
		});

		it('sets an empty Set on failure', async () => {
			const store = useUserStore();
			setAuthUser(null);
			vi.mocked(makeAPIRequest).mockResolvedValue({ success: false, message: 'x' });

			const quests = await store.fetchQuestsList();

			expect(quests).toEqual([]);
			expect(store.questsList?.size).toBe(0);
		});
	});

	describe('clear', () => {
		it('clears a single identifier across every per-user map and bumps sync version', () => {
			const store = useUserStore();
			store.cache.set('u1', mkUser('u1', 'alice'));
			store.loading.add('u1');
			store.attendingEvents.set('u1', []);
			store.badges.set('u1', []);
			store.points.set('u1', 10);
			store.quest.set('u1', null);
			store.masteryStatuses.set('u1:b1', {} as any);
			store.masteryLists.set('u1', {} as any);

			store.clear('u1');

			expect(store.cache.has('u1')).toBe(false);
			expect(store.loading.has('u1')).toBe(false);
			expect(store.attendingEvents.has('u1')).toBe(false);
			expect(store.badges.has('u1')).toBe(false);
			expect(store.points.has('u1')).toBe(false);
			expect(store.quest.has('u1')).toBe(false);
			// mastery keyed by `${id}:` prefix
			expect(store.masteryStatuses.has('u1:b1')).toBe(false);
			expect(store.masteryLists.has('u1')).toBe(false);
		});

		it('full clear empties everything and resets questsList to null', () => {
			const store = useUserStore();
			store.cache.set('u1', mkUser('u1', 'alice'));
			store.points.set('u1', 10);
			store.questsCache.set('q1', { id: 'q1' } as any);
			store.questsList = new Set(['q1']);
			store.lockedMasteries.add('b1');

			store.clear();

			expect(store.cache.size).toBe(0);
			expect(store.points.size).toBe(0);
			expect(store.questsCache.size).toBe(0);
			expect(store.questsList).toBeNull();
			expect(store.lockedMasteries.size).toBe(0);
		});
	});

	describe('mastery', () => {
		it('getMasteryStatus rejects empty ids without a network call', async () => {
			const store = useUserStore();
			setAuthUser(null);
			expect(await store.getMasteryStatus('', 'b1')).toBeNull();
			expect(await store.getMasteryStatus('u1', '')).toBeNull();
			expect(makeAPIRequest).not.toHaveBeenCalled();
		});

		it('getMasteryStatus caches the status, records locked badges, and caches the quest', async () => {
			const store = useUserStore();
			setAuthUser(null);
			vi.mocked(makeAPIRequest).mockResolvedValue({
				success: true,
				data: { locked: true, quest: { id: 'q1' } } as any
			});

			const res = await store.getMasteryStatus('u1', 'b1');

			expect(res).toBeTruthy();
			expect(store.masteryStatuses.get('u1:b1')).toBeTruthy();
			expect(store.lockedMasteries.has('b1')).toBe(true);
			expect(store.questsCache.get('q1')).toBeTruthy();
			// loading flag cleared in finally
			expect(store.masteryLoading.has('u1:b1')).toBe(false);
		});

		it('fetchMasteryList stores the list and caches each item quest on success', async () => {
			const store = useUserStore();
			setAuthUser(null);
			vi.mocked(makeAPIRequest).mockResolvedValue({
				success: true,
				data: { active: 1, cap: 3, items: [{ quest: { id: 'q1' } }] } as any
			});

			const res = await store.fetchMasteryList('u1');

			expect(res).toBeTruthy();
			expect(store.masteryLists.get('u1')).toBeTruthy();
			expect(store.questsCache.get('q1')).toBeTruthy();
			expect(store.masteryListLoading.has('u1')).toBe(false);
		});

		it('generateMastery throws cap_reached from the cached preflight without a network call', async () => {
			const store = useUserStore();
			setAuthUser(null);
			store.masteryLists.set('u1', { active: 3, cap: 3, items: [] } as any);
			const fetchSpy = vi.fn();
			vi.stubGlobal('$fetch', fetchSpy);

			await expect(store.generateMastery('u1', 'b1')).rejects.toMatchObject({
				code: 'cap_reached'
			});
			expect(fetchSpy).not.toHaveBeenCalled();
			vi.unstubAllGlobals();
		});

		it('generateMastery throws locked when the badge is already locked', async () => {
			const store = useUserStore();
			setAuthUser(null);
			store.lockedMasteries.add('b1');

			await expect(store.generateMastery('u1', 'b1')).rejects.toMatchObject({ code: 'locked' });
		});

		it('generateMastery throws unknown for empty identifiers', async () => {
			const store = useUserStore();
			setAuthUser(null);
			await expect(store.generateMastery('', 'b1')).rejects.toMatchObject({ code: 'unknown' });
		});
	});

	describe('invalidateSelf', () => {
		// the fan-out at the end of invalidateSelf is fire-and-forget; point every request
		// mock at a clean failure so the detached promises settle without throwing
		const stubFanoutFailure = () => {
			vi.mocked(makeAPIRequest).mockResolvedValue({ success: false, message: 'x' });
			vi.mocked(paginatedAPIRequest).mockResolvedValue({ success: false, message: 'x' } as any);
		};

		it('is a no-op when there is no auth user', () => {
			const store = useUserStore();
			setAuthUser(null);
			store.cache.set('ghost', null);
			store.invalidateSelf();
			// nothing wiped, no refetch fan-out
			expect(makeAPIRequest).not.toHaveBeenCalled();
		});

		it('wipes a poisoned-null self entry and resets questsList', async () => {
			const store = useUserStore();
			stubFanoutFailure();
			const me = mkUser('me1', 'gregory');
			setAuthUser(me);
			// anon SSR poisoned the self id with null
			store.cache.set('me1', null);
			store.cache.set('@gregory', null);
			// an unrelated cached user must survive
			const other = mkUser('u2', 'bob');
			store.cache.set('u2', other);
			store.questsList = new Set(['q1']);

			store.invalidateSelf();

			expect(store.cache.has('me1')).toBe(false);
			expect(store.cache.has('@gregory')).toBe(false);
			expect(store.cache.get('u2')).toEqual(other);
			expect(store.questsList).toBeNull();

			// let the detached fan-out promises settle so they don't leak past the test
			await new Promise((r) => setTimeout(r, 0));
		});
	});
});
