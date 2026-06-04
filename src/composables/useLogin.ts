import { extractServerMessage } from 'errors';
import { useAuthStore } from 'stores/auth';
import type { LoginResponse, LoginVerificationRequired, User } from 'types/user';

const AUTH_REQUEST_TIMEOUT_MS = 30_000;

export type LoginResult =
	| { success: true; verified: true; message: string }
	| {
			success: true;
			verified: false;
			ticket: string;
			email: string;
			expiresIn: number;
			message?: string;
	  }
	| { success: false; message: string; retryAfter?: number };

export type VerifyNewIPLoginResult =
	| { success: true; message: string }
	| { success: false; message: string; retryAllowed: boolean };

function isLoginVerificationRequired(
	response: LoginResponse | LoginVerificationRequired
): response is LoginVerificationRequired {
	return (
		(response as LoginVerificationRequired).requires_verification === true &&
		typeof (response as LoginVerificationRequired).ticket === 'string'
	);
}

export function useSignup() {
	const config = useRuntimeConfig();
	const authStore = useAuthStore();
	const { sendVerificationEmail } = useAuth();

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
						username: username.trim().toLowerCase(),
						password,
						email: email?.trim() || undefined,
						first_name,
						last_name
					},
					timeout: AUTH_REQUEST_TIMEOUT_MS
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
			const message = extractServerMessage(error, 'Signup failed. Please try again.');

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

	return async function login(userOrEmail: string, password: string): Promise<LoginResult> {
		const identifier = userOrEmail.trim().toLowerCase();
		const auth = btoa(`${identifier}:${password}`);

		try {
			const response = await $fetch<LoginResponse | LoginVerificationRequired>(
				`${config.public.apiBaseUrl}/v2/users/login`,
				{
					method: 'POST',
					headers: {
						Authorization: `Basic ${auth}`,
						Accept: 'application/json'
					},
					timeout: AUTH_REQUEST_TIMEOUT_MS
				}
			);

			if (isLoginVerificationRequired(response)) {
				return {
					success: true,
					verified: false,
					ticket: response.ticket,
					email: response.email,
					expiresIn: response.expires_in,
					message: response.message
				};
			}

			authStore.setSessionToken(response.session_token);

			if (response.user) {
				authStore.currentUser = response.user;
			} else {
				await authStore.fetchCurrentUser();
			}

			return { success: true, verified: true, message: 'Login successful' };
		} catch (error: any) {
			console.error('Login failed:', error);
			const statusCode = error?.response?.status || error?.statusCode || error?.status;
			const message = extractServerMessage(error, 'Login failed. Please check your credentials.');
			const retryAfter =
				typeof error?.data?.retry_after === 'number' ? error.data.retry_after : undefined;

			if (statusCode) {
				return { success: false, message: `${statusCode}: ${message}`, retryAfter };
			}

			return { success: false, message, retryAfter };
		}
	};
}

export function useVerifyNewIPLogin() {
	const config = useRuntimeConfig();
	const authStore = useAuthStore();

	return async function verifyNewIPLogin(
		ticket: string,
		code: string
	): Promise<VerifyNewIPLoginResult> {
		try {
			const params = new URLSearchParams({ ticket, code });
			const response = await $fetch<LoginResponse>(
				`${config.public.apiBaseUrl}/v2/users/login/verify_new_ip?${params.toString()}`,
				{
					method: 'POST',
					headers: {
						Accept: 'application/json'
					},
					timeout: AUTH_REQUEST_TIMEOUT_MS
				}
			);

			authStore.setSessionToken(response.session_token);

			if (response.user) {
				authStore.currentUser = response.user;
			} else {
				await authStore.fetchCurrentUser();
			}

			return { success: true, message: 'Verification successful' };
		} catch (error: any) {
			console.error('Login verification failed:', error);
			const statusCode = error?.response?.status || error?.statusCode || error?.status;
			const rawMessage = extractServerMessage(error, 'Verification failed. Please try again.');
			const lower = rawMessage.toLowerCase();

			const ticketDead =
				statusCode === 400 &&
				(lower.includes('too many') ||
					lower.includes('expired') ||
					lower.includes('invalid') ||
					lower.includes('missing'));

			const codeOnlyInvalid = statusCode === 400 && lower === 'invalid verification code';

			const retryAllowed = codeOnlyInvalid || (!ticketDead && statusCode !== 403);

			const message = statusCode ? `${statusCode}: ${rawMessage}` : rawMessage;
			return { success: false, message, retryAllowed };
		}
	};
}

export function useLogout() {
	const config = useRuntimeConfig();
	const authStore = useAuthStore();

	return async function logout(platform: string = 'web') {
		try {
			await $fetch(`${config.public.apiBaseUrl}/v2/users/logout`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${authStore.sessionToken}`
				},
				body: {
					platform
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
