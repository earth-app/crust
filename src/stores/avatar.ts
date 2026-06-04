import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { useAuthStore } from './auth';

interface AvatarSizes {
	avatar: string;
	avatar32: string;
	avatar128: string;
}

const FALLBACK_AVATAR: AvatarSizes = Object.freeze({
	avatar: '/earth-app.png',
	avatar32: '/favicon.png',
	avatar128: '/favicon.png'
});

const isBlobUrl = (url: string | undefined | null): boolean =>
	typeof url === 'string' && url.startsWith('blob:');

export const useAvatarStore = defineStore('avatar', () => {
	const authStore = useAuthStore();

	const cache = reactive(new Map<string, AvatarSizes>());
	const loadingUrls = reactive(new Set<string>());
	const failedUrls = reactive(new Set<string>());

	const allCosmetics = reactive<AvatarCosmetic[]>([]);
	const userCosmetics = reactive(
		new Map<string, { current: AvatarCosmetic['key'] | null; unlocked: AvatarCosmetic['key'][] }>()
	);

	const fetchQueue = new Map<string, Promise<AvatarSizes>>();

	const previewCache = reactive(new Map<string, string>());
	const previewLoading = reactive(new Set<string>());
	const previewQueue = new Map<string, Promise<string | undefined>>();

	// separate cache keyspace for self-previews so the placeholder preview and
	// the "your photo + this cosmetic" preview don't trample each other
	const selfPreviewCache = reactive(new Map<string, string>());
	const selfPreviewLoading = reactive(new Set<string>());
	const selfPreviewQueue = new Map<string, Promise<string | undefined>>();

	const get = (url: string): AvatarSizes | undefined => {
		if (!cache.has(url)) return undefined;
		return cache.get(url);
	};

	const has = (url: string): boolean => cache.has(url);

	const isLoading = (url: string | undefined | null): boolean => {
		if (!url) return false;
		return loadingUrls.has(url);
	};

	const hasFailed = (url: string | undefined | null): boolean => {
		if (!url) return false;
		return failedUrls.has(url);
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

		loadingUrls.add(url);
		failedUrls.delete(url);

		const fetchPromise = (async () => {
			try {
				const headers: HeadersInit = {};
				if (authStore.sessionToken) {
					headers['Authorization'] = `Bearer ${authStore.sessionToken}`;
				}

				const result: AvatarSizes = { ...FALLBACK_AVATAR };
				let anySucceeded = false;

				const fetchAndUpdate = async (size: keyof AvatarSizes, sizeParam?: string) => {
					try {
						const fetchUrl = sizeParam ? `${url}?size=${sizeParam}` : url;
						const response = await fetch(fetchUrl, { headers });
						if (response.ok) {
							const blob = await response.blob();
							if (blob.size > 0) {
								result[size] = URL.createObjectURL(blob);
								anySucceeded = true;
							}
						}
					} catch (error) {
						console.warn(`Failed to fetch ${size} for ${url}:`, error);
					}
				};

				await Promise.all([
					fetchAndUpdate('avatar'),
					fetchAndUpdate('avatar32', '32'),
					fetchAndUpdate('avatar128', '128')
				]);

				if (anySucceeded) {
					cache.set(url, result);
					return result;
				}

				// All sizes failed - mark URL as failed so consumers can show fallback
				// without retrying repeatedly. Don't cache the fallback object
				// (so future force-fetches still try the network).
				failedUrls.add(url);
				return { ...FALLBACK_AVATAR };
			} catch (error) {
				console.warn(`Failed to fetch avatars for ${url}:`, error);
				failedUrls.add(url);
				return { ...FALLBACK_AVATAR };
			} finally {
				loadingUrls.delete(url);
				fetchQueue.delete(url);
			}
		})();

		fetchQueue.set(url, fetchPromise);
		return fetchPromise;
	};

	const preloadAvatar = (url: string | undefined | null) => {
		if (!url || !url.startsWith('http')) return;
		if (cache.has(url) || fetchQueue.has(url)) return;
		void fetchAvatarBlobs(url);
	};

	const clear = (url?: string) => {
		if (url) {
			const cached = cache.get(url);
			if (cached) {
				if (isBlobUrl(cached.avatar)) URL.revokeObjectURL(cached.avatar);
				if (isBlobUrl(cached.avatar32)) URL.revokeObjectURL(cached.avatar32);
				if (isBlobUrl(cached.avatar128)) URL.revokeObjectURL(cached.avatar128);
			}
			cache.delete(url);
			failedUrls.delete(url);
		} else {
			for (const [, avatars] of cache) {
				if (isBlobUrl(avatars.avatar)) URL.revokeObjectURL(avatars.avatar);
				if (isBlobUrl(avatars.avatar32)) URL.revokeObjectURL(avatars.avatar32);
				if (isBlobUrl(avatars.avatar128)) URL.revokeObjectURL(avatars.avatar128);
			}
			cache.clear();
			failedUrls.clear();

			for (const previewUrl of previewCache.values()) {
				if (isBlobUrl(previewUrl)) URL.revokeObjectURL(previewUrl);
			}
			previewCache.clear();
		}
	};

	const fetchAllCosmetics = async () => {
		const res = await makeAPIRequest<{ cosmetics: AvatarCosmetic[] }>(
			'avatar-cosmetics',
			'/v2/users/cosmetics',
			authStore.sessionToken
		);

		if (valid(res)) {
			allCosmetics.splice(0, allCosmetics.length, ...res.data.cosmetics);
		} else {
			console.warn('Failed to fetch avatar cosmetics:', res.message);
		}

		return res;
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

		if (valid(res)) {
			userCosmetics.set(userId, {
				current: res.data.current,
				unlocked: res.data.unlocked
			});
		} else {
			// On failure, ensure an empty entry exists so consumers stop showing
			// "loading" and render a stable empty state.
			if (!userCosmetics.has(userId)) {
				userCosmetics.set(userId, { current: null, unlocked: [] });
			}
			console.warn(`Failed to fetch cosmetics for user ${userId}:`, res.message);
		}

		return res;
	};

	// fire-and-forget mantle2 cache flush after avatar mutations
	// belt-and-suspenders alongside the local cache-bust on the avatar url
	const clearUserPhotoCache = async (userId: string): Promise<void> => {
		try {
			const res = await makeAPIRequest<{ success: boolean }>(
				`clear-photo-cache-${userId}`,
				`/v2/users/${userId}/profile_photo/cache`,
				authStore.sessionToken,
				{ method: 'DELETE' }
			);

			if (!res.success) {
				console.warn(`Failed to clear photo cache for user ${userId}:`, res.message);
			}
		} catch (error) {
			console.warn(`Failed to clear photo cache for user ${userId}:`, error);
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
			// flush mantle2-side cosmetic cache so the next avatar fetch is fresh
			await clearUserPhotoCache(userId);
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

	// returns a cache-busting query string suffix for an avatar url; safe to append
	// even if the url already has a query string. used after cosmetic changes.
	const buildAvatarCacheBust = (url: string): string => {
		if (!url) return url;
		return `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
	};

	const getPreview = (cosmeticKey: AvatarCosmetic['key']): string | undefined =>
		previewCache.get(cosmeticKey);

	const isPreviewLoading = (cosmeticKey: AvatarCosmetic['key']): boolean =>
		previewLoading.has(cosmeticKey);

	const previewCosmetic = async (
		cosmeticKey: AvatarCosmetic['key']
	): Promise<string | undefined> => {
		const cached = previewCache.get(cosmeticKey);
		if (cached) return cached;

		const inFlight = previewQueue.get(cosmeticKey);
		if (inFlight) return inFlight;

		previewLoading.add(cosmeticKey);

		const promise = (async () => {
			try {
				const res = await makeAPIRequest<Blob>(
					`cosmetic-preview-${cosmeticKey}`,
					`/v2/users/cosmetics/preview?cosmetic=${cosmeticKey}`,
					authStore.sessionToken,
					{ responseType: 'blob' }
				);

				if (valid(res) && res.data instanceof Blob && res.data.size > 0) {
					const objectUrl = URL.createObjectURL(res.data);
					previewCache.set(cosmeticKey, objectUrl);
					return objectUrl;
				}

				if (!res.success) {
					console.warn(`Failed to fetch preview for cosmetic ${cosmeticKey}:`, res.message);
				}
				return undefined;
			} finally {
				previewLoading.delete(cosmeticKey);
				previewQueue.delete(cosmeticKey);
			}
		})();

		previewQueue.set(cosmeticKey, promise);
		return promise;
	};

	const clearPreview = (cosmeticKey?: AvatarCosmetic['key']) => {
		if (cosmeticKey) {
			const url = previewCache.get(cosmeticKey);
			if (isBlobUrl(url)) URL.revokeObjectURL(url!);
			previewCache.delete(cosmeticKey);

			const selfUrl = selfPreviewCache.get(cosmeticKey);
			if (isBlobUrl(selfUrl)) URL.revokeObjectURL(selfUrl!);
			selfPreviewCache.delete(cosmeticKey);
		} else {
			for (const url of previewCache.values()) {
				if (isBlobUrl(url)) URL.revokeObjectURL(url);
			}
			previewCache.clear();

			for (const url of selfPreviewCache.values()) {
				if (isBlobUrl(url)) URL.revokeObjectURL(url);
			}
			selfPreviewCache.clear();
		}
	};

	// preview the cosmetic applied to the *authenticated user's* own profile photo
	// (server falls back to the placeholder if the user can't be resolved, so this
	// is safe to call from any caller; the returned blob just won't be personalized)
	const getSelfPreview = (cosmeticKey: AvatarCosmetic['key']): string | undefined =>
		selfPreviewCache.get(cosmeticKey);

	const isSelfPreviewLoading = (cosmeticKey: AvatarCosmetic['key']): boolean =>
		selfPreviewLoading.has(cosmeticKey);

	const previewCosmeticWithSelf = async (
		cosmeticKey: AvatarCosmetic['key']
	): Promise<string | undefined> => {
		const cached = selfPreviewCache.get(cosmeticKey);
		if (cached) return cached;

		const inFlight = selfPreviewQueue.get(cosmeticKey);
		if (inFlight) return inFlight;

		selfPreviewLoading.add(cosmeticKey);

		const promise = (async () => {
			try {
				const res = await makeAPIRequest<Blob>(
					`cosmetic-preview-self-${cosmeticKey}`,
					`/v2/users/cosmetics/preview?cosmetic=${cosmeticKey}&withSelf=true`,
					authStore.sessionToken,
					{ responseType: 'blob' }
				);

				if (valid(res) && res.data instanceof Blob && res.data.size > 0) {
					const objectUrl = URL.createObjectURL(res.data);
					selfPreviewCache.set(cosmeticKey, objectUrl);
					return objectUrl;
				}

				if (!res.success) {
					console.warn(`Failed to fetch self preview for cosmetic ${cosmeticKey}:`, res.message);
				}
				return undefined;
			} catch (error) {
				console.warn(`Failed to fetch self preview for cosmetic ${cosmeticKey}:`, error);
				return undefined;
			} finally {
				selfPreviewLoading.delete(cosmeticKey);
				selfPreviewQueue.delete(cosmeticKey);
			}
		})();

		selfPreviewQueue.set(cosmeticKey, promise);
		return promise;
	};

	return {
		cache,
		loadingUrls,
		failedUrls,
		get,
		has,
		isLoading,
		hasFailed,
		fetchAvatarBlobs,
		preloadAvatar,
		clear,
		allCosmetics,
		userCosmetics,
		fetchAllCosmetics,
		fetchCosmeticsForUser,
		setCosmeticForUser,
		purchaseCosmetic,
		clearUserPhotoCache,
		buildAvatarCacheBust,
		previewCache,
		previewLoading,
		getPreview,
		isPreviewLoading,
		previewCosmetic,
		selfPreviewCache,
		selfPreviewLoading,
		getSelfPreview,
		isSelfPreviewLoading,
		previewCosmeticWithSelf,
		clearPreview
	};
});
