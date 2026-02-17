import { defineStore } from 'pinia';
import type { User } from '~/shared/types/user';

export const useAuthStore = defineStore('auth', () => {
	const currentUser = ref<User | null | undefined>(undefined);
	const sessionToken = ref<string | null>(null);
	const isLoading = ref(false);
	const fetchPromise = ref<Promise<void> | null>(null);

	const isAuthenticated = computed(() => !!sessionToken.value && !!currentUser.value);
	const isAdmin = computed(() => currentUser.value?.is_admin || false);

	const setSessionToken = (token: string | null) => {
		sessionToken.value = token;

		if (import.meta.client) {
			const sessionCookie = useCookie('session_token', {
				maxAge: 60 * 60 * 24 * 14,
				secure: true,
				sameSite: 'none'
			});
			sessionCookie.value = token;
		}
	};

	const syncSessionToken = async () => {
		if (import.meta.server) return;

		try {
			const response = await $fetch<{ session_token: string | null }>('/api/auth/session');
			if (response.session_token) {
				setSessionToken(response.session_token);
			}
		} catch (error) {
			console.error('Failed to sync session token:', error);
		}
	};

	const fetchCurrentUser = async (force: boolean = false) => {
		if (currentUser.value !== undefined && !force && !fetchPromise.value) {
			return currentUser.value;
		}

		if (fetchPromise.value && !force) {
			await fetchPromise.value;
			return currentUser.value;
		}

		isLoading.value = true;

		fetchPromise.value = (async () => {
			try {
				if (import.meta.client && force) {
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
			} catch (error: any) {
				console.warn('Failed to fetch current user:', error);
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
			maxAge: 60 * 60 * 24 * 14,
			secure: true,
			sameSite: 'none'
		});
		sessionToken.value = sessionCookie.value || null;
	} else {
		// server-side; read from request headers
		try {
			const headers = useRequestHeaders(['cookie']);
			const cookieHeader = headers.cookie || '';
			const match = cookieHeader.match(/session_token=([^;]+)/);
			sessionToken.value = match?.[1] || null;
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
