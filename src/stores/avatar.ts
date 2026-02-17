import { defineStore } from 'pinia';
import { useAuthStore } from './auth';

interface AvatarSizes {
	avatar: string;
	avatar32: string;
	avatar128: string;
}

export const useAvatarStore = defineStore('avatar', () => {
	const cache = reactive(new Map<string, AvatarSizes>());
	const fetchQueue = new Map<string, Promise<AvatarSizes>>();

	const get = (url: string): AvatarSizes | undefined => {
		// Force reactivity tracking by checking has() first
		if (!cache.has(url)) return undefined;
		return cache.get(url);
	};

	const has = (url: string): boolean => {
		return cache.has(url);
	};

	const fetchAvatarBlobs = async (url: string): Promise<AvatarSizes> => {
		const cached = cache.get(url);
		if (cached) {
			return cached;
		}

		const existing = fetchQueue.get(url);
		if (existing) {
			return existing;
		}

		// create new fetch promise (don't set cache yet to avoid false positives)
		const fetchPromise = (async () => {
			try {
				const authStore = useAuthStore();
				const headers: HeadersInit = {};
				if (authStore.sessionToken) {
					headers['Authorization'] = `Bearer ${authStore.sessionToken}`;
				}

				// Initialize result object
				const result: AvatarSizes = {
					avatar: '/earth-app.png',
					avatar32: '/favicon.png',
					avatar128: '/favicon.png'
				};

				const fetchAndUpdate = async (size: keyof AvatarSizes, sizeParam?: string) => {
					try {
						const fetchUrl = sizeParam ? `${url}?size=${sizeParam}` : url;
						const response = await fetch(fetchUrl, { headers });
						if (response.ok) {
							const blob = await response.blob();
							const objectUrl = URL.createObjectURL(blob);
							result[size] = objectUrl;
						}
					} catch (error) {
						console.warn(`Failed to fetch ${size} for ${url}:`, error);
					}
				};

				// fetch all sizes in parallel
				await Promise.all([
					fetchAndUpdate('avatar'),
					fetchAndUpdate('avatar32', '32'),
					fetchAndUpdate('avatar128', '128')
				]);

				// Only set cache after all fetches complete
				cache.set(url, result);
				return result;
			} catch (error) {
				console.warn(`Failed to fetch avatars for ${url}:`, error);
				const fallback: AvatarSizes = {
					avatar: '/earth-app.png',
					avatar32: '/favicon.png',
					avatar128: '/favicon.png'
				};
				cache.set(url, fallback);
				return fallback;
			} finally {
				fetchQueue.delete(url);
			}
		})();

		fetchQueue.set(url, fetchPromise);
		return fetchPromise;
	};

	const preloadAvatar = (url: string | undefined) => {
		if (!url || !url.startsWith('http')) return;
		// Check if already fetched OR currently fetching
		if (cache.has(url) || fetchQueue.has(url)) return;
		fetchAvatarBlobs(url);
	};

	const clear = (url?: string) => {
		if (url) {
			// revoke object URLs to prevent memory leaks
			const cached = cache.get(url);
			if (cached) {
				URL.revokeObjectURL(cached.avatar);
				URL.revokeObjectURL(cached.avatar32);
				URL.revokeObjectURL(cached.avatar128);
			}
			cache.delete(url);
		} else {
			for (const [, avatars] of cache) {
				URL.revokeObjectURL(avatars.avatar);
				URL.revokeObjectURL(avatars.avatar32);
				URL.revokeObjectURL(avatars.avatar128);
			}
			cache.clear();
		}
	};

	return {
		cache,
		get,
		has,
		fetchAvatarBlobs,
		preloadAvatar,
		clear
	};
});
