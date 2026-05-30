import { defineStore, skipHydrate } from 'pinia';
import type { User } from 'types/user';
import { computed, ref } from 'vue';
import { isValidUser } from './user';

export const useAuthStore = defineStore('auth', () => {
	const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
	const RECENT_LOGOUT_SUPPRESSION_MS = 5000;
	const LAST_LOGOUT_STORAGE_KEY = 'earth-app:last-logout-at';

	const currentUser = ref<User | null | undefined>(undefined);
	const sessionToken = ref<string | null>(null);
	const isLoading = ref(false);
	const fetchPromise = ref<Promise<void> | null>(null);
	const lastLogoutAt = useSessionStorage<number>(LAST_LOGOUT_STORAGE_KEY, 0);

	const isAuthenticated = computed(() => !!sessionToken.value && !!currentUser.value);
	const isAdmin = computed(() => currentUser.value?.is_admin || false);

	const normalizeSessionToken = (token: string | null | undefined): string | null => {
		if (!token) return null;

		let normalized = token.trim();
		try {
			normalized = decodeURIComponent(normalized);
		} catch {
			// keep the raw token if it's not URL encoded
		}

		if (normalized.length >= 2 && normalized.startsWith('"') && normalized.endsWith('"')) {
			normalized = normalized.slice(1, -1);
		}

		return normalized || null;
	};

	const hasRecentLogout = () => {
		if (lastLogoutAt.value <= 0) return false;
		return Date.now() - lastLogoutAt.value < RECENT_LOGOUT_SUPPRESSION_MS;
	};

	const markRecentLogout = () => {
		lastLogoutAt.value = Date.now();
	};

	const clearRecentLogout = () => {
		if (lastLogoutAt.value > 0) lastLogoutAt.value = 0;
	};

	const setSessionToken = (token: string | null) => {
		const normalized = normalizeSessionToken(token);
		sessionToken.value = normalized;

		if (normalized) {
			clearRecentLogout();
		}

		if (import.meta.client) {
			const sessionCookie = useCookie('session_token', {
				maxAge: SESSION_COOKIE_MAX_AGE,
				secure: true,
				sameSite: 'none'
			});
			sessionCookie.value = normalized;
		}
	};

	const syncSessionToken = async (options?: { allowNullOverwrite?: boolean }) => {
		if (import.meta.server) return;

		const allowNullOverwrite = options?.allowNullOverwrite ?? false;
		const existingToken = sessionToken.value;

		if (!existingToken && hasRecentLogout()) {
			return null;
		}

		try {
			const response = await $fetch<{ session_token: string | null }>('/api/auth/session', {
				cache: 'no-store',
				credentials: 'include'
			});

			const syncedToken = normalizeSessionToken(response.session_token);

			if (!existingToken && syncedToken && hasRecentLogout()) {
				return null;
			}

			if (!syncedToken && existingToken && !allowNullOverwrite) {
				return existingToken;
			}

			setSessionToken(syncedToken);
			return syncedToken;
		} catch (error) {
			console.error('Failed to sync session token:', error);
			return existingToken;
		}
	};

	const fetchCurrentUser = async (force: boolean = false) => {
		if (fetchPromise.value) {
			await fetchPromise.value;
			return currentUser.value;
		}

		if (currentUser.value && !force) {
			return currentUser.value;
		}

		isLoading.value = true;

		fetchPromise.value = (async () => {
			const hadCurrentUser = !!currentUser.value;

			try {
				if (import.meta.client && force) {
					await syncSessionToken({ allowNullOverwrite: !sessionToken.value });
				}

				if (!sessionToken.value) {
					currentUser.value = null;
					return;
				}

				const config = useRuntimeConfig();
				const response = await $fetch<User>(`${config.public.apiBaseUrl}/v2/users/current`, {
					headers: {
						Authorization: `Bearer ${sessionToken.value}`,
						Accept: 'application/json'
					}
				});

				if (!isValidUser(response)) {
					console.warn('Malformed /v2/users/current payload — leaving currentUser null');
					currentUser.value = null;
					return;
				}

				currentUser.value = response;
				// Slide cookie expiration on successful auth reads.
				setSessionToken(sessionToken.value);
			} catch (error: any) {
				console.warn('Failed to fetch current user:', error);
				const statusCode = error?.response?.status || error?.statusCode || error?.status;

				if (statusCode === 401 || statusCode === 403) {
					markRecentLogout();
					setSessionToken(null);
					currentUser.value = null;
					return;
				}

				if (!hadCurrentUser) {
					currentUser.value = null;
				}
			} finally {
				isLoading.value = false;
				fetchPromise.value = null;
			}
		})();

		await fetchPromise.value;
		return currentUser.value;
	};

	const updateUser = (user: Partial<User>) => {
		if (currentUser.value) {
			currentUser.value = { ...currentUser.value, ...user };
		}
	};

	const logout = () => {
		markRecentLogout();
		currentUser.value = null;
		setSessionToken(null);
	};

	if (import.meta.client) {
		const sessionCookie = useCookie('session_token', {
			maxAge: SESSION_COOKIE_MAX_AGE,
			secure: true,
			sameSite: 'none'
		});
		sessionToken.value = normalizeSessionToken(sessionCookie.value);
	}

	return {
		currentUser: skipHydrate(currentUser),
		sessionToken: skipHydrate(sessionToken),
		isLoading,
		isAuthenticated,
		isAdmin,
		setSessionToken,
		syncSessionToken,
		fetchCurrentUser,
		updateUser,
		logout
	};
});
