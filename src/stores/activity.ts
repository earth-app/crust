import { defineStore } from 'pinia';
import type { Activity } from 'types/activity';
import { makeAPIRequest, makeClientAPIRequest } from 'utils';
import { reactive, ref } from 'vue';
import { useAuthStore } from './auth';

const RANDOM_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const useActivityStore = defineStore('activity', () => {
	const MAX_CACHE_SIZE = 200; // Limit cache to prevent memory leaks
	// null marks "fetched and confirmed not found / failed".
	const cache = reactive(new Map<string, Activity | null>());
	const loading = reactive(new Set<string>());
	const fetchQueue = new Map<string, Promise<void>>();
	const count = ref<number | undefined>(undefined);
	const randomCache = reactive(new Map<string, { items: Activity[]; timestamp: number }>());

	// LRU cache eviction
	const evictOldestIfNeeded = () => {
		if (cache.size >= MAX_CACHE_SIZE) {
			const firstKey = cache.keys().next().value;
			if (firstKey) cache.delete(firstKey);
		}
	};

	const get = (id: string): Activity | null | undefined => {
		if (!id) return undefined;
		if (loading.has(id) && !cache.get(id)) return undefined;
		return cache.get(id);
	};

	const has = (id: string): boolean => {
		return cache.has(id);
	};

	const isLoading = (id: string | null | undefined): boolean => {
		if (!id) return false;
		return loading.has(id);
	};

	const getRandomCached = (count: number): Activity[] | null => {
		const entry = randomCache.get(`random-${count}`);
		if (entry && Date.now() - entry.timestamp < RANDOM_CACHE_TTL) {
			return entry.items;
		}
		return null;
	};

	const setRandomCached = (count: number, items: Activity[]) => {
		randomCache.set(`random-${count}`, { items, timestamp: Date.now() });
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

		loading.add(id);

		// create new fetch promise
		const fetchPromise = (async () => {
			try {
				const authStore = useAuthStore();

				const res = await makeAPIRequest<Activity>(
					`activity-${id}`,
					`/v2/activities/${id}?include_aliases=true`,
					authStore.sessionToken
				);

				if (valid(res)) {
					cache.set(id, res.data);
				} else {
					cache.set(id, null);
					if (res.message) console.warn(`Failed to fetch activity ${id}:`, res.message);
				}
			} catch (error) {
				cache.set(id, null);
				console.warn(`Failed to fetch activity ${id}:`, error);
			} finally {
				loading.delete(id);
				fetchQueue.delete(id);
			}
		})();

		fetchQueue.set(id, fetchPromise);
		await fetchPromise;

		return cache.get(id) || null;
	};

	const setActivities = (activities: Activity[]) => {
		for (const activity of activities) {
			if (cache.get(activity.id)) continue;

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

			if (valid(res)) {
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

		if (valid(res)) {
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

		if (valid(res)) {
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
		isLoading,
		getRandomCached,
		setRandomCached,
		fetchActivity,
		setActivities,
		fetchCount,
		createActivity,
		updateActivity,
		deleteActivity,
		clear
	};
});
