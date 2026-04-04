import { defineStore } from 'pinia';
import type { User } from 'types/user';
import { computed, ref } from 'vue';

export const useAuthStore = defineStore('auth', () => {
	const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
	const RECENT_LOGOUT_SUPPRESSION_MS = 5000;
	const LAST_LOGOUT_STORAGE_KEY = 'earth-app:last-logout-at';

	const currentUser = ref<User | null | undefined>(undefined);
	const sessionToken = ref<string | null>(null);
	const isLoading = ref(false);
	const fetchPromise = ref<Promise<void> | null>(null);
	const lastLogoutAt = ref<number>(0);

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

	const readLastLogoutAt = (): number => {
		if (import.meta.server) return 0;

		try {
			const raw = window.sessionStorage.getItem(LAST_LOGOUT_STORAGE_KEY);
			if (!raw) return 0;

			const parsed = Number(raw);
			return Number.isFinite(parsed) ? parsed : 0;
		} catch {
			return 0;
		}
	};

	const writeLastLogoutAt = (value: number) => {
		lastLogoutAt.value = value;
		if (import.meta.server) return;

		try {
			if (value > 0) {
				window.sessionStorage.setItem(LAST_LOGOUT_STORAGE_KEY, String(value));
			} else {
				window.sessionStorage.removeItem(LAST_LOGOUT_STORAGE_KEY);
			}
		} catch {
			// noop
		}
	};

	const hasRecentLogout = () => {
		if (lastLogoutAt.value <= 0) return false;
		return Date.now() - lastLogoutAt.value < RECENT_LOGOUT_SUPPRESSION_MS;
	};

	const markRecentLogout = () => {
		writeLastLogoutAt(Date.now());
	};

	const clearRecentLogout = () => {
		if (lastLogoutAt.value > 0) {
			writeLastLogoutAt(0);
		}
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
				if (import.meta.client && (force || !sessionToken.value)) {
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

	// initialize session token from cookie on client
	if (import.meta.client) {
		lastLogoutAt.value = readLastLogoutAt();

		const sessionCookie = useCookie('session_token', {
			maxAge: SESSION_COOKIE_MAX_AGE,
			secure: true,
			sameSite: 'none'
		});
		sessionToken.value = normalizeSessionToken(sessionCookie.value);
	} else {
		// server-side; read from request headers
		try {
			const headers = useRequestHeaders(['cookie']);
			const cookieHeader = headers.cookie || '';
			const match = cookieHeader.match(/session_token=([^;]+)/);
			sessionToken.value = normalizeSessionToken(match?.[1] || null);
		} catch (e) {
			sessionToken.value = null;
		}
	}

	return {
		currentUser,
		sessionToken,
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
