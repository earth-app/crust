import type { User } from '~/shared/types/user';
import { sendVerificationEmail } from './useUser';

export function useSignup() {
	const config = useRuntimeConfig();

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

			const sessionCookie = useCookie('session_token', {
				maxAge: 60 * 60 * 24 * 14,
				secure: true,
				sameSite: 'none'
			});
			sessionCookie.value = response.session_token;

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

			const sessionCookie = useCookie('session_token', {
				maxAge: 60 * 60 * 24 * 14,
				secure: true,
				sameSite: 'none'
			});
			sessionCookie.value = response.session_token;

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

	const sessionCookie = useCookie('session_token', {
		maxAge: 60 * 60 * 24 * 14,
		secure: true,
		sameSite: 'none'
	});

	return async function logout() {
		try {
			await $fetch(`${config.public.apiBaseUrl}/v2/users/logout`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${sessionCookie.value}`
				}
			});

			sessionCookie.value = null; // Clear the session cookie
			refreshNuxtData('user-current'); // Refresh user data
			return { success: true, message: 'Logout successful' };
		} catch (error) {
			console.error('Logout failed:', error);
			return { success: false, message: 'Logout failed. Please try again.' };
		}
	};
}

export function useCurrentSessionToken(value?: string | null) {
	if (import.meta.server) {
		if (value) {
			setCookie(useRequestEvent()!, 'session_token', value, {
				sameSite: 'none',
				secure: true,
				maxAge: 60 * 60 * 24 * 14 // 14 days
			});

			return value;
		}

		const cachedToken = useState<string | null>('session_token_cache', () => null);
		try {
			if (!cachedToken.value) {
				const headers = useRequestHeaders(['cookie']);
				const cookieHeader = headers.cookie || '';
				const match = cookieHeader.match(/session_token=([^;]+)/);
				const token = match?.[1] || null;
				cachedToken.value = token;
			}
		} catch (e) {
			// If we can't access the Nuxt instance, return the cached value or null
			// This happens when called in async contexts
		}

		return cachedToken.value;
	} else {
		const sessionCookie = useCookie('session_token', {
			maxAge: 60 * 60 * 24 * 14,
			secure: true,
			sameSite: 'none'
		});

		if (value !== undefined) sessionCookie.value = value;

		const token = sessionCookie.value || null;
		return token;
	}
}
