import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from 'stores/auth';
import { useFriendsStore } from 'stores/friends';
import { useUserStore } from 'stores/user';
import type { User } from 'types/user';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// network helpers are imported at module-load from the `utils` alias, so mock the
// module and keep the pure helpers (valid, etc) real via spreading the actual export
vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return {
		...actual,
		makeAPIRequest: vi.fn(),
		makeClientAPIRequest: vi.fn(),
		paginatedAPIRequest: vi.fn()
	};
});

import { makeAPIRequest, makeClientAPIRequest, paginatedAPIRequest } from 'utils';

// minimal but isValidUser-passing user (needs string id + string username)
function user(id: string, extra: Partial<User> = {}): User {
	return { id, username: `user-${id}`, ...extra } as unknown as User;
}

// the friend-mutation routes return { user, friend, is_mutual }
function mutationOk(friend: User) {
	return { success: true, data: { user: user('me'), friend, is_mutual: false } };
}

const ids = (users: User[]) => users.map((u) => u.id);

function authed(token: string | null = 'tok') {
	const auth = useAuthStore();
	auth.sessionToken = token;
	return auth;
}

describe('friends store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
	});

	describe('getters with empty state', () => {
		it('returns empty arrays / zero counts before any fetch', () => {
			const store = useFriendsStore();
			expect(store.getFriends()).toEqual([]);
			expect(store.getCircle()).toEqual([]);
			expect(store.friendsCount()).toBe(0);
			expect(store.circleCount()).toBe(0);
			// defaults to the 'current' bucket
			expect(store.getFriends('current')).toEqual([]);
		});
	});

	describe('fetchFriends', () => {
		it('short-circuits to empty when unauthenticated', async () => {
			authed(null);
			const store = useFriendsStore();

			await store.fetchFriends('alice');

			expect(paginatedAPIRequest).not.toHaveBeenCalled();
			expect(store.getFriends('alice')).toEqual([]);
			expect(store.friendsCount('alice')).toBe(0);
		});

		it('caches valid friends and preloads them into the user cache', async () => {
			authed();
			const store = useFriendsStore();
			const userStore = useUserStore();

			vi.mocked(paginatedAPIRequest).mockResolvedValue({
				success: true,
				data: [user('a'), user('b')]
			});

			await store.fetchFriends('current');

			expect(ids(store.getFriends('current'))).toEqual(['a', 'b']);
			expect(store.friendsCount('current')).toBe(2);
			expect(userStore.cache.get('a')?.id).toBe('a');
			expect(userStore.cache.get('b')?.id).toBe('b');
		});

		it('filters out malformed (non-user-shaped) entries', async () => {
			authed();
			const store = useFriendsStore();

			vi.mocked(paginatedAPIRequest).mockResolvedValue({
				success: true,
				// [] is the stripped-user shape mantle can ship; also a missing-username obj
				data: [user('good'), [] as unknown as User, { id: 'x' } as unknown as User]
			});

			await store.fetchFriends('current');

			expect(ids(store.getFriends('current'))).toEqual(['good']);
		});

		it('sets an empty list when the response is invalid', async () => {
			authed();
			const store = useFriendsStore();

			vi.mocked(paginatedAPIRequest).mockResolvedValue({
				success: false,
				message: 'boom'
			});

			await store.fetchFriends('current');

			expect(store.getFriends('current')).toEqual([]);
		});

		it('sets an empty list when the request throws', async () => {
			authed();
			const store = useFriendsStore();

			vi.mocked(paginatedAPIRequest).mockRejectedValue(new Error('network'));

			await store.fetchFriends('current');

			expect(store.getFriends('current')).toEqual([]);
		});

		it('dedupes concurrent fetches for the same id', async () => {
			authed();
			const store = useFriendsStore();

			let resolveFn: (v: any) => void = () => {};
			vi.mocked(paginatedAPIRequest).mockReturnValue(
				new Promise((resolve) => {
					resolveFn = resolve;
				}) as any
			);

			const p1 = store.fetchFriends('current');
			const p2 = store.fetchFriends('current');

			resolveFn({ success: true, data: [user('a')] });
			await Promise.all([p1, p2]);

			// in-flight promise sharing means only one network call fired
			expect(paginatedAPIRequest).toHaveBeenCalledTimes(1);
			expect(ids(store.getFriends('current'))).toEqual(['a']);
		});

		it('allows a fresh fetch after a prior one settled', async () => {
			authed();
			const store = useFriendsStore();

			vi.mocked(paginatedAPIRequest).mockResolvedValue({
				success: true,
				data: [user('a')]
			});

			await store.fetchFriends('current');
			await store.fetchFriends('current');

			// the in-flight guard is cleared in finally, so a second sequential call re-fetches
			expect(paginatedAPIRequest).toHaveBeenCalledTimes(2);
		});
	});

	describe('fetchFriendsPage', () => {
		it('rejects when unauthenticated without calling the network', async () => {
			authed(null);
			const store = useFriendsStore();

			const res = await store.fetchFriendsPage('current', 1, 10);

			expect(res.success).toBe(false);
			expect(makeAPIRequest).not.toHaveBeenCalled();
		});

		it('passes through the raw paged response', async () => {
			authed();
			const store = useFriendsStore();

			vi.mocked(makeAPIRequest).mockResolvedValue({
				success: true,
				data: { items: [user('a')], total: 1 }
			});

			const res = await store.fetchFriendsPage('current', 2, 10, 'bob');

			expect(res.success).toBe(true);
			expect((res.data as any).total).toBe(1);
			// paged fetch is a passthrough — it does NOT mutate the friends cache
			expect(store.getFriends('current')).toEqual([]);
		});
	});

	describe('addFriend', () => {
		it('rejects when unauthenticated', async () => {
			authed(null);
			const store = useFriendsStore();

			const res = await store.addFriend('current', 'bob');

			expect(res.success).toBe(false);
			expect(makeClientAPIRequest).not.toHaveBeenCalled();
		});

		it('appends the returned friend and seeds the user cache', async () => {
			authed();
			const store = useFriendsStore();
			const userStore = useUserStore();

			vi.mocked(makeClientAPIRequest).mockResolvedValue(mutationOk(user('bob')));

			await store.addFriend('current', 'bob');

			expect(ids(store.getFriends('current'))).toEqual(['bob']);
			expect(userStore.cache.get('bob')?.id).toBe('bob');
		});

		it('does not append when the returned friend is malformed', async () => {
			authed();
			const store = useFriendsStore();

			vi.mocked(makeClientAPIRequest).mockResolvedValue({
				success: true,
				data: { user: user('me'), friend: [] as unknown as User, is_mutual: false }
			});

			await store.addFriend('current', 'bob');

			expect(store.getFriends('current')).toEqual([]);
		});

		it('appends onto an existing cached list', async () => {
			authed();
			const store = useFriendsStore();
			store.friendsCache.set('current', [user('a')]);

			vi.mocked(makeClientAPIRequest).mockResolvedValue(mutationOk(user('b')));

			await store.addFriend('current', 'b');

			expect(ids(store.getFriends('current'))).toEqual(['a', 'b']);
		});
	});

	describe('removeFriend', () => {
		it('rejects when unauthenticated', async () => {
			authed(null);
			const store = useFriendsStore();

			const res = await store.removeFriend('current', 'bob');

			expect(res.success).toBe(false);
			expect(makeClientAPIRequest).not.toHaveBeenCalled();
		});

		it('removes the friend from both the friends and circle caches', async () => {
			authed();
			const store = useFriendsStore();
			store.friendsCache.set('current', [user('a'), user('b')]);
			store.circleCache.set('current', [user('a'), user('c')]);

			vi.mocked(makeClientAPIRequest).mockResolvedValue(mutationOk(user('a')));

			await store.removeFriend('current', 'a');

			expect(ids(store.getFriends('current'))).toEqual(['b']);
			expect(ids(store.getCircle('current'))).toEqual(['c']);
		});

		it('leaves caches untouched when the call fails', async () => {
			authed();
			const store = useFriendsStore();
			store.friendsCache.set('current', [user('a')]);

			vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: false, message: 'no' });

			await store.removeFriend('current', 'a');

			expect(ids(store.getFriends('current'))).toEqual(['a']);
		});
	});

	describe('fetchCircle', () => {
		it('short-circuits to empty when unauthenticated', async () => {
			authed(null);
			const store = useFriendsStore();

			await store.fetchCircle('alice');

			expect(paginatedAPIRequest).not.toHaveBeenCalled();
			expect(store.getCircle('alice')).toEqual([]);
		});

		it('caches valid circle members and preloads the user cache', async () => {
			authed();
			const store = useFriendsStore();
			const userStore = useUserStore();

			vi.mocked(paginatedAPIRequest).mockResolvedValue({
				success: true,
				data: [user('a'), [] as unknown as User]
			});

			await store.fetchCircle('current');

			expect(ids(store.getCircle('current'))).toEqual(['a']);
			expect(store.circleCount('current')).toBe(1);
			expect(userStore.cache.get('a')?.id).toBe('a');
		});

		it('empties the circle on an invalid response', async () => {
			authed();
			const store = useFriendsStore();
			store.circleCache.set('current', [user('stale')]);

			vi.mocked(paginatedAPIRequest).mockResolvedValue({ success: false, message: 'x' });

			await store.fetchCircle('current');

			expect(store.getCircle('current')).toEqual([]);
		});

		it('dedupes concurrent circle fetches', async () => {
			authed();
			const store = useFriendsStore();

			let resolveFn: (v: any) => void = () => {};
			vi.mocked(paginatedAPIRequest).mockReturnValue(
				new Promise((resolve) => {
					resolveFn = resolve;
				}) as any
			);

			const p1 = store.fetchCircle('current');
			const p2 = store.fetchCircle('current');

			resolveFn({ success: true, data: [user('a')] });
			await Promise.all([p1, p2]);

			expect(paginatedAPIRequest).toHaveBeenCalledTimes(1);
		});
	});

	describe('addToCircle / removeFromCircle', () => {
		it('addToCircle appends and seeds the user cache', async () => {
			authed();
			const store = useFriendsStore();
			const userStore = useUserStore();

			vi.mocked(makeClientAPIRequest).mockResolvedValue(mutationOk(user('z')));

			await store.addToCircle('current', 'z');

			expect(ids(store.getCircle('current'))).toEqual(['z']);
			expect(userStore.cache.get('z')?.id).toBe('z');
		});

		it('addToCircle ignores a malformed friend', async () => {
			authed();
			const store = useFriendsStore();

			vi.mocked(makeClientAPIRequest).mockResolvedValue({
				success: true,
				data: {
					user: user('me'),
					friend: { id: 'no-username' } as unknown as User,
					is_mutual: false
				}
			});

			await store.addToCircle('current', 'z');

			expect(store.getCircle('current')).toEqual([]);
		});

		it('addToCircle rejects when unauthenticated', async () => {
			authed(null);
			const store = useFriendsStore();

			const res = await store.addToCircle('current', 'z');

			expect(res.success).toBe(false);
			expect(makeClientAPIRequest).not.toHaveBeenCalled();
		});

		it('removeFromCircle removes only the circle entry', async () => {
			authed();
			const store = useFriendsStore();
			store.friendsCache.set('current', [user('a')]);
			store.circleCache.set('current', [user('a'), user('b')]);

			vi.mocked(makeClientAPIRequest).mockResolvedValue(mutationOk(user('a')));

			await store.removeFromCircle('current', 'a');

			// circle loses 'a', friends list is left intact
			expect(ids(store.getCircle('current'))).toEqual(['b']);
			expect(ids(store.getFriends('current'))).toEqual(['a']);
		});

		it('removeFromCircle rejects when unauthenticated', async () => {
			authed(null);
			const store = useFriendsStore();

			const res = await store.removeFromCircle('current', 'a');

			expect(res.success).toBe(false);
		});
	});

	describe('clear', () => {
		it('clears a single id bucket only', () => {
			const store = useFriendsStore();
			store.friendsCache.set('a', [user('1')]);
			store.friendsCache.set('b', [user('2')]);
			store.circleCache.set('a', [user('3')]);

			store.clear('a');

			expect(store.getFriends('a')).toEqual([]);
			expect(store.getCircle('a')).toEqual([]);
			expect(ids(store.getFriends('b'))).toEqual(['2']);
		});

		it('clears every bucket when no id is given', () => {
			const store = useFriendsStore();
			store.friendsCache.set('a', [user('1')]);
			store.circleCache.set('b', [user('2')]);

			store.clear();

			expect(store.getFriends('a')).toEqual([]);
			expect(store.getCircle('b')).toEqual([]);
		});
	});
});
