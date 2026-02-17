import { defineStore } from 'pinia';
import type { User } from '~/shared/types/user';
import { makeAPIRequest, makeClientAPIRequest, paginatedAPIRequest } from '~/shared/util';
import { useAuthStore } from './auth';
import { useUserStore } from './user';

export const useFriendsStore = defineStore('friends', () => {
	const friendsCache = reactive(new Map<string, User[]>());
	const circleCache = reactive(new Map<string, User[]>());
	const fetchPromises = reactive(new Map<string, Promise<void>>());

	const getFriends = (id: string = 'current'): User[] => {
		return friendsCache.get(id) || [];
	};

	const getCircle = (id: string = 'current'): User[] => {
		return circleCache.get(id) || [];
	};

	const friendsCount = (id: string = 'current'): number => {
		return friendsCache.get(id)?.length || 0;
	};

	const circleCount = (id: string = 'current'): number => {
		return circleCache.get(id)?.length || 0;
	};

	const fetchFriends = async (id: string = 'current', limit: number = 100, search: string = '') => {
		const authStore = useAuthStore();
		if (!authStore.sessionToken) {
			friendsCache.set(id, []);
			return;
		}

		const cacheKey = `friends-${id}`;
		if (fetchPromises.has(cacheKey)) {
			await fetchPromises.get(cacheKey);
			return;
		}

		const fetchPromise = (async () => {
			try {
				const res = await paginatedAPIRequest<User>(
					`/v2/users/${id}/friends`,
					authStore.sessionToken,
					{},
					limit,
					search
				);

				if (res.success && res.data && !('message' in res.data)) {
					friendsCache.set(id, res.data);

					// Preload friends into user cache
					const userStore = useUserStore();
					for (const friend of res.data) {
						userStore.cache.set(friend.id, friend);
					}
				} else {
					console.error('Failed to fetch friends:', res.message);
					friendsCache.set(id, []);
				}
			} catch (error) {
				console.error('Failed to fetch friends:', error);
				friendsCache.set(id, []);
			} finally {
				fetchPromises.delete(cacheKey);
			}
		})();

		fetchPromises.set(cacheKey, fetchPromise);
		await fetchPromise;
	};

	const fetchFriendsPage = async (
		id: string = 'current',
		page: number,
		limit: number,
		search: string = ''
	) => {
		const authStore = useAuthStore();
		if (!authStore.sessionToken) {
			return { success: false, message: 'Unauthenticated. Please log in to continue.' };
		}

		return await makeAPIRequest<{ items: User[]; total: number }>(
			`friends-${id}-page-${page}-limit-${limit}-search-${search}`,
			`/v2/users/${id}/friends?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`,
			authStore.sessionToken
		);
	};

	const addFriend = async (id: string = 'current', friend: string) => {
		const authStore = useAuthStore();
		if (!authStore.sessionToken) {
			return { success: false, message: 'Unauthenticated. Please log in to continue.' };
		}

		const res = await makeClientAPIRequest<{ user: User; friend: User; is_mutual: boolean }>(
			`/v2/users/${id}/friends?friend=${encodeURIComponent(friend)}`,
			authStore.sessionToken,
			{ method: 'PUT' }
		);

		if (res.success && res.data && !('message' in res.data)) {
			const friendUser = res.data.friend;
			const currentFriends = friendsCache.get(id) || [];
			friendsCache.set(id, [...currentFriends, friendUser]);

			// Add to user cache
			const userStore = useUserStore();
			userStore.cache.set(friendUser.id, friendUser);
		}

		return res;
	};

	const removeFriend = async (id: string = 'current', friend: string) => {
		const authStore = useAuthStore();
		if (!authStore.sessionToken) {
			return { success: false, message: 'Unauthenticated. Please log in to continue.' };
		}

		const res = await makeClientAPIRequest<{ user: User; friend: User; is_mutual: boolean }>(
			`/v2/users/${id}/friends?friend=${encodeURIComponent(friend)}`,
			authStore.sessionToken,
			{ method: 'DELETE' }
		);

		if (res.success && res.data && !('message' in res.data)) {
			const friendUser = res.data.friend;
			const currentFriends = friendsCache.get(id) || [];
			friendsCache.set(
				id,
				currentFriends.filter((f) => f.id !== friendUser.id)
			);

			const currentCircle = circleCache.get(id) || [];
			circleCache.set(
				id,
				currentCircle.filter((f) => f.id !== friendUser.id)
			);
		}

		return res;
	};

	const fetchCircle = async (id: string = 'current', limit: number = 100) => {
		const authStore = useAuthStore();
		if (!authStore.sessionToken) {
			circleCache.set(id, []);
			return;
		}

		const cacheKey = `circle-${id}`;
		if (fetchPromises.has(cacheKey)) {
			await fetchPromises.get(cacheKey);
			return;
		}

		const fetchPromise = (async () => {
			try {
				const res = await paginatedAPIRequest<User>(
					`/v2/users/${id}/circle`,
					authStore.sessionToken,
					{},
					limit
				);

				if (res.success && res.data && !('message' in res.data)) {
					circleCache.set(id, res.data);

					// Preload circle users into user cache
					const userStore = useUserStore();
					for (const user of res.data) {
						userStore.cache.set(user.id, user);
					}
				} else {
					console.error('Failed to fetch circle:', res.message);
					circleCache.set(id, []);
				}
			} catch (error) {
				console.error('Failed to fetch circle:', error);
				circleCache.set(id, []);
			} finally {
				fetchPromises.delete(cacheKey);
			}
		})();

		fetchPromises.set(cacheKey, fetchPromise);
		await fetchPromise;
	};

	const fetchCirclePage = async (id: string = 'current', page: number, limit: number) => {
		const authStore = useAuthStore();
		if (!authStore.sessionToken) {
			return { success: false, message: 'Unauthenticated. Please log in to continue.' };
		}

		return await makeAPIRequest<{ items: User[]; total: number }>(
			`circle-${id}-page-${page}-limit-${limit}`,
			`/v2/users/${id}/circle?page=${page}&limit=${limit}`,
			authStore.sessionToken
		);
	};

	const addToCircle = async (id: string = 'current', friend: string) => {
		const authStore = useAuthStore();
		if (!authStore.sessionToken) {
			return { success: false, message: 'Unauthenticated. Please log in to continue.' };
		}

		const res = await makeClientAPIRequest<{ user: User; friend: User; is_mutual: boolean }>(
			`/v2/users/${id}/circle?friend=${encodeURIComponent(friend)}`,
			authStore.sessionToken,
			{ method: 'PUT' }
		);

		if (res.success && res.data && !('message' in res.data)) {
			const friendUser = res.data.friend;
			const currentCircle = circleCache.get(id) || [];
			circleCache.set(id, [...currentCircle, friendUser]);

			// Add to user cache
			const userStore = useUserStore();
			userStore.cache.set(friendUser.id, friendUser);
		}

		return res;
	};

	const removeFromCircle = async (id: string = 'current', friend: string) => {
		const authStore = useAuthStore();
		if (!authStore.sessionToken) {
			return { success: false, message: 'Unauthenticated. Please log in to continue.' };
		}

		const res = await makeClientAPIRequest<{ user: User; friend: User; is_mutual: boolean }>(
			`/v2/users/${id}/circle?friend=${encodeURIComponent(friend)}`,
			authStore.sessionToken,
			{ method: 'DELETE' }
		);

		if (res.success && res.data && !('message' in res.data)) {
			const friendUser = res.data.friend;
			const currentCircle = circleCache.get(id) || [];
			circleCache.set(
				id,
				currentCircle.filter((f) => f.id !== friendUser.id)
			);
		}

		return res;
	};

	const clear = (id?: string) => {
		if (id) {
			friendsCache.delete(id);
			circleCache.delete(id);
		} else {
			friendsCache.clear();
			circleCache.clear();
		}
	};

	return {
		friendsCache,
		circleCache,
		getFriends,
		getCircle,
		friendsCount,
		circleCount,
		fetchFriends,
		fetchFriendsPage,
		addFriend,
		removeFriend,
		fetchCircle,
		fetchCirclePage,
		addToCircle,
		removeFromCircle,
		clear
	};
});
