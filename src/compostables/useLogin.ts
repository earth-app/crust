export function useLogin() {
	const config = useRuntimeConfig();

	return async function login(username: string, password: string) {
		const auth = btoa(`${username}:${password}`);

		try {
			const response = await $fetch<{ session_token: string }>(
				`${config.public.apiBaseUrl}/v1/users/login`,
				{
					method: 'POST',
					headers: {
						Authorization: `Basic ${auth}`,
						'Content-Type': 'application/json'
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

export function useCurrentSessionToken() {
	if (import.meta.server) {
		const headers = useRequestHeaders(['cookie']);
		const cookieHeader = headers.cookie || '';
		const match = cookieHeader.match(/session_token=([^;]+)/);
		const token = match?.[1] || null;

		if (token) {
			const sessionCookie = useCookie('session_token', {
				maxAge: 60 * 60 * 24 * 14,
				secure: true,
				sameSite: 'strict'
			});
			sessionCookie.value = token;
		}

		return token;
	} else {
		const sessionCookie = useCookie('session_token', {
			maxAge: 60 * 60 * 24 * 14,
			secure: true,
			sameSite: 'strict'
		});
		const token = sessionCookie.value || null;

		if (token) {
			sessionCookie.value = token;
		}

		return token;
	}
}
