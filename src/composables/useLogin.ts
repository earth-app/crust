import type { User } from '~/shared/types/user';
import { useAuthStore } from '~/stores/auth';
import { sendVerificationEmail } from './useUser';

export function useSignup() {
	const config = useRuntimeConfig();
	const authStore = useAuthStore();

	return async function signup(
		username: string,
		password: string,
		email?: string,
		first_name?: string,
		last_name?: string
	) {
		try {
			const response = await $fetch<{ user: User; session_token: string }>(
				`${config.public.apiBaseUrl}/v2/users/create`,
				{
					method: 'POST',
					headers: {
						Accept: 'application/json'
					},
					body: {
						username,
						password,
						email,
						first_name,
						last_name
					}
				}
			);

			authStore.setSessionToken(response.session_token);
			authStore.currentUser = response.user;

			if (email) {
				// Automatically send verification email upon signup
				sendVerificationEmail()
					.then((res) => {
						if (!res.success) {
							console.error('Failed to send verification email:', res.message);
						}
					})
					.catch((err) => {
						console.error('Failed to send verification email:', err);
					});
			}

			return { success: true, message: 'Signup successful', user: response.user };
		} catch (error: any) {
			const statusCode = error?.response?.status || error?.statusCode || error?.status;
			const message = error?.data?.message || error?.message || 'Signup failed. Please try again.';

			if (statusCode) {
				return { success: false, message: `${statusCode}: ${message}` };
			}

			return { success: false, message };
		}
	};
}

export function useLogin() {
	const config = useRuntimeConfig();
	const authStore = useAuthStore();

	return async function login(username: string, password: string) {
		const auth = btoa(`${username}:${password}`);

		try {
			const response = await $fetch<{ session_token: string }>(
				`${config.public.apiBaseUrl}/v2/users/login`,
				{
					method: 'POST',
					headers: {
						Authorization: `Basic ${auth}`,
						Accept: 'application/json'
					}
				}
			);

			authStore.setSessionToken(response.session_token);
			await authStore.fetchCurrentUser();

			return { success: true, message: 'Login successful' };
		} catch (error: any) {
			console.error('Login failed:', error);
			const statusCode = error?.response?.status || error?.statusCode || error?.status;
			const message =
				error?.data?.message || error?.message || 'Login failed. Please check your credentials.';

			if (statusCode) {
				return { success: false, message: `${statusCode}: ${message}` };
			}

			return { success: false, message };
		}
	};
}

export function useLogout() {
	const config = useRuntimeConfig();
	const authStore = useAuthStore();

	return async function logout() {
		try {
			await $fetch(`${config.public.apiBaseUrl}/v2/users/logout`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${authStore.sessionToken}`
				}
			});

			authStore.logout();

			// Force refresh all data
			await refreshNuxtData();

			return { success: true, message: 'Logout successful' };
		} catch (error) {
			console.error('Logout failed:', error);
			return { success: false, message: 'Logout failed. Please try again.' };
		}
	};
}

export function useCurrentSessionToken(value?: string | null) {
	const authStore = useAuthStore();

	if (value !== undefined) {
		authStore.setSessionToken(value);
	}

	return authStore.sessionToken;
}
