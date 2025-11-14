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
			const response = await $fetch<{ session_token: string }>(
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
				sameSite: 'strict'
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

			return { success: true, message: 'Signup successful' };
		} catch (error) {
			return { success: false, message: `${error}` || 'Signup failed. Please try again.' };
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
				sameSite: 'strict'
			});
			sessionCookie.value = response.session_token;

			return { success: true, message: 'Login successful' };
		} catch (error) {
			console.error('Login failed:', error);
			return { success: false, message: 'Login failed. Please check your credentials.' };
		}
	};
}

export function useLogout() {
	const config = useRuntimeConfig();

	const sessionCookie = useCookie('session_token', {
		maxAge: 60 * 60 * 24 * 14,
		secure: true,
		sameSite: 'strict'
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
			refreshNuxtData(['user-current', 'avatar-current']); // Refresh user data
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
			// On server, we cannot set cookies directly. This is a limitation.
			console.warn('Setting session token on server is not supported.');
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
			sameSite: 'strict'
		});

		if (value !== undefined) sessionCookie.value = value;

		const token = sessionCookie.value || null;
		return token;
	}
}
