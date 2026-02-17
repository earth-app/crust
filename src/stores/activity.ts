import { defineStore } from 'pinia';
import type { Activity } from '~/shared/types/activity';
import { makeAPIRequest, makeClientAPIRequest } from '~/shared/util';
import { useAuthStore } from './auth';

export const useActivityStore = defineStore('activity', () => {
	const MAX_CACHE_SIZE = 200; // Limit cache to prevent memory leaks
	const cache = reactive(new Map<string, Activity>());
	const fetchQueue = new Map<string, Promise<void>>();
	const count = ref<number | undefined>(undefined);

	// LRU cache eviction
	const evictOldestIfNeeded = () => {
		if (cache.size >= MAX_CACHE_SIZE) {
			const firstKey = cache.keys().next().value;
			if (firstKey) cache.delete(firstKey);
		}
	};

	const get = (id: string): Activity | undefined => {
		return cache.get(id);
	};

	const has = (id: string): boolean => {
		return cache.has(id);
	};

	const fetchActivity = async (id: string, force: boolean = false): Promise<Activity | null> => {
		if (!id) return null;

		if (cache.has(id) && !force && !fetchQueue.has(id)) {
			return cache.get(id)!;
		}

		const existingFetch = fetchQueue.get(id);
		if (existingFetch && !force) {
			await existingFetch;
			return cache.get(id) || null;
		}

		// create new fetch promise
		const fetchPromise = (async () => {
			try {
				const authStore = useAuthStore();

				const res = await makeAPIRequest<Activity>(
					`activity-${id}`,
					`/v2/activities/${id}?include_aliases=true`,
					authStore.sessionToken
				);

				if (res.success && res.data) {
					if ('message' in res.data) {
						console.warn(`Failed to fetch activity ${id}:`, res.data.message);
						return;
					}

					cache.set(id, res.data);
				} else {
					console.warn(`Failed to fetch activity ${id}:`, res.message);
				}
			} catch (error) {
				console.warn(`Failed to fetch activity ${id}:`, error);
			} finally {
				fetchQueue.delete(id);
			}
		})();

		fetchQueue.set(id, fetchPromise);
		await fetchPromise;

		return cache.get(id) || null;
	};

	const setActivities = (activities: Activity[]) => {
		for (const activity of activities) {
			evictOldestIfNeeded();
			cache.set(activity.id, activity);
		}
	};

	const fetchCount = async (): Promise<number | undefined> => {
		try {
			const authStore = useAuthStore();
			const res = await makeClientAPIRequest<{ items: string[]; total: number }>(
				`/v2/activities/list?page=1&limit=1`,
				authStore.sessionToken
			);

			if (res.success && res.data && !('message' in res.data)) {
				count.value = res.data.total;
				return res.data.total;
			}

			count.value = undefined;
			return undefined;
		} catch (error) {
			console.warn('Failed to fetch activities count:', error);
			count.value = undefined;
			return undefined;
		}
	};

	const createActivity = async (activity: Activity) => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<Activity>('/v2/activities', authStore.sessionToken, {
			method: 'POST',
			body: activity
		});

		if (res.success && res.data && !('message' in res.data)) {
			cache.set(res.data.id, res.data);
		}

		return res;
	};

	const updateActivity = async (activity: Activity) => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<Activity>(
			`/v2/activities/${activity.id}`,
			authStore.sessionToken,
			{
				method: 'PATCH',
				body: activity
			}
		);

		if (res.success && res.data && !('message' in res.data)) {
			cache.set(res.data.id, res.data);
		}

		return res;
	};

	const deleteActivity = async (id: string) => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<void>(`/v2/activities/${id}`, authStore.sessionToken, {
			method: 'DELETE'
		});

		if (res.success) {
			cache.delete(id);
		}

		return res;
	};

	const clear = (id?: string) => {
		if (id) {
			cache.delete(id);
		} else {
			cache.clear();
		}
	};

	return {
		cache,
		count,
		get,
		has,
		fetchActivity,
		setActivities,
		fetchCount,
		createActivity,
		updateActivity,
		deleteActivity,
		clear
	};
});
