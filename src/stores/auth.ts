import { defineStore } from 'pinia';
import type { User } from 'types/user';
import { computed, ref } from 'vue';

export const useAuthStore = defineStore('auth', () => {
	const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

	const currentUser = ref<User | null | undefined>(undefined);
	const sessionToken = ref<string | null>(null);
	const isLoading = ref(false);
	const fetchPromise = ref<Promise<void> | null>(null);

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

	const setSessionToken = (token: string | null) => {
		const normalized = normalizeSessionToken(token);
		sessionToken.value = normalized;

		if (import.meta.client) {
			const sessionCookie = useCookie('session_token', {
				maxAge: SESSION_COOKIE_MAX_AGE,
				secure: true,
				sameSite: 'none'
			});
			sessionCookie.value = normalized;
		}
	};

	const syncSessionToken = async () => {
		if (import.meta.server) return;

		try {
			const response = await $fetch<{ session_token: string | null }>('/api/auth/session', {
				cache: 'no-store',
				credentials: 'include'
			});
			setSessionToken(response.session_token);
		} catch (error) {
			console.error('Failed to sync session token:', error);
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
			try {
				if (import.meta.client && (force || !sessionToken.value)) {
					await syncSessionToken();
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
					setSessionToken(null);
				}

				currentUser.value = null;
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
		currentUser.value = null;
		setSessionToken(null);
	};

	// initialize session token from cookie on client
	if (import.meta.client) {
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
