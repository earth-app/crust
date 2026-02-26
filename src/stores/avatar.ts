import { defineStore } from 'pinia';
import { useAuthStore } from './auth';

interface AvatarSizes {
	avatar: string;
	avatar32: string;
	avatar128: string;
}

export const useAvatarStore = defineStore('avatar', () => {
	const authStore = useAuthStore();

	const cache = reactive(new Map<string, AvatarSizes>());
	const allCosmetics = reactive<AvatarCosmetic[]>([]);
	const userCosmetics = reactive(
		new Map<string, { current: AvatarCosmetic['key'] | null; unlocked: AvatarCosmetic['key'][] }>()
	);
	const fetchQueue = new Map<string, Promise<AvatarSizes>>();
	const previewCache = reactive(new Map<string, Promise<string | undefined>>());

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

	const fetchAllCosmetics = async () => {
		const res = await makeAPIRequest<{ cosmetics: AvatarCosmetic[] }>(
			'avatar-cosmetics',
			'/v2/users/cosmetics',
			authStore.sessionToken
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				console.warn('Failed to fetch avatar cosmetics:', res.data.message);
				return;
			}

			allCosmetics.splice(0, allCosmetics.length, ...res.data.cosmetics);
		} else {
			console.warn('Failed to fetch avatar cosmetics:', res.message);
		}
	};

	const fetchCosmeticsForUser = async (userId: string) => {
		const res = await makeAPIRequest<{
			current: AvatarCosmetic['key'] | null;
			unlocked: AvatarCosmetic['key'][];
		}>(
			`user-cosmetics-${userId}`,
			`/v2/users/${userId}/profile_photo/cosmetic`,
			authStore.sessionToken
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				console.warn(`Failed to fetch cosmetics for user ${userId}:`, res.data.message);
				return;
			}

			userCosmetics.set(userId, {
				current: res.data.current,
				unlocked: res.data.unlocked
			});
		} else {
			console.warn(`Failed to fetch cosmetics for user ${userId}:`, res.message);
		}
	};

	const setCosmeticForUser = async (userId: string, cosmeticKey: AvatarCosmetic['key'] | null) => {
		const res = await makeAPIRequest<void>(
			`set-user-cosmetic-${userId}`,
			`/v2/users/${userId}/profile_photo/cosmetic`,
			authStore.sessionToken,
			{
				method: 'PUT',
				body: JSON.stringify({ current: cosmeticKey })
			}
		);

		if (res.success) {
			await fetchCosmeticsForUser(userId);
		} else {
			console.warn(`Failed to set cosmetic for user ${userId}:`, res.message);
		}

		return res;
	};

	const purchaseCosmetic = async (userId: string, cosmeticKey: AvatarCosmetic['key']) => {
		const res = await makeAPIRequest<void>(
			`purchase-cosmetic-${userId}-${cosmeticKey}`,
			`/v2/users/${userId}/profile_photo/purchase_cosmetic?key=${cosmeticKey}`,
			authStore.sessionToken,
			{
				method: 'POST'
			}
		);

		if (res.success) {
			await fetchCosmeticsForUser(userId);
		} else {
			console.warn(`Failed to purchase cosmetic ${cosmeticKey} for user ${userId}:`, res.message);
		}

		return res;
	};

	const previewCosmetic = async (cosmeticKey: AvatarCosmetic['key']) => {
		if (cache.has(`preview-${cosmeticKey}`)) {
			return cache.get(`preview-${cosmeticKey}`)?.avatar || undefined;
		}

		if (previewCache.has(cosmeticKey)) {
			return await previewCache.get(cosmeticKey);
		}

		const authStore = useAuthStore();
		const previewPromise = (async () => {
			try {
				const res = await makeAPIRequest<Blob>(
					`cosmetic-preview-${cosmeticKey}`,
					`/v2/users/cosmetics/preview?cosmetic=${cosmeticKey}`,
					authStore.sessionToken ? `Bearer ${authStore.sessionToken}` : undefined,
					{ responseType: 'blob' }
				);

				if (res.success && res.data) {
					if ('message' in res.data) {
						console.warn(`Failed to fetch preview for cosmetic ${cosmeticKey}:`, res.data.message);
						return undefined;
					}

					const objectUrl = URL.createObjectURL(res.data);
					cache.set(`preview-${cosmeticKey}`, {
						avatar: objectUrl,
						avatar32: objectUrl,
						avatar128: objectUrl
					});

					return objectUrl;
				}

				console.warn(`Failed to fetch preview for cosmetic ${cosmeticKey}:`, res.message);
				return undefined;
			} finally {
				previewCache.delete(cosmeticKey);
			}
		})();

		previewCache.set(cosmeticKey, previewPromise);
		return await previewPromise;
	};

	return {
		cache,
		get,
		has,
		fetchAvatarBlobs,
		preloadAvatar,
		clear,
		allCosmetics,
		userCosmetics,
		fetchAllCosmetics,
		fetchCosmeticsForUser,
		setCosmeticForUser,
		purchaseCosmetic,
		previewCosmetic
	};
});
