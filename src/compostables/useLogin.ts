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

			const sessionCookie = useCookie('session_token');
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
		return match?.[1] || null;
	} else {
		const sessionCookie = useCookie('session_token');
		return sessionCookie.value || null;
	}
}
