import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from 'stores/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	useCurrentSessionToken,
	useLogin,
	useLogout,
	useSignup,
	useVerifyNewIPLogin
} from '~/composables/useLogin';

// the auth composables hit the backend through the global $fetch; stub it so we
// drive the success / verification-required / error branches deterministically.
// none of these flows are exercised end-to-end with a real backend in e2e.

const fetchMock = vi.fn();

beforeEach(() => {
	setActivePinia(createPinia());
	useAuthStore().setSessionToken(null);
	fetchMock.mockReset();
	vi.stubGlobal('$fetch', fetchMock);
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

// $fetch error shaped like an ofetch FetchError (message lives in data.message)
const httpError = (status: number, message: string, extra: Record<string, unknown> = {}) =>
	Object.assign(new Error(message), {
		status,
		statusCode: status,
		data: { message, ...extra }
	});

describe('useSignup', () => {
	it('stores the session + user and returns success', async () => {
		fetchMock.mockResolvedValue({ user: { id: 'u1' }, session_token: 'tok' });
		const signup = useSignup();

		const res = await signup('Ada', 'pw'); // no email → no verification email

		expect(res.success).toBe(true);
		const authStore = useAuthStore();
		expect(authStore.sessionToken).toBe('tok');
		expect(authStore.currentUser).toEqual({ id: 'u1' });
		// username is normalized lower/trimmed in the request body
		expect(fetchMock.mock.calls[0]![1].body.username).toBe('ada');
	});

	it('surfaces a status-prefixed message on failure', async () => {
		fetchMock.mockRejectedValue(httpError(409, 'Username taken'));
		const signup = useSignup();

		const res = await signup('ada', 'pw');

		expect(res.success).toBe(false);
		expect(res.message).toBe('409: Username taken');
	});
});

describe('useLogin', () => {
	it('logs in and stores the token when verified', async () => {
		fetchMock.mockResolvedValue({ session_token: 'tok', user: { id: 'u1' } });
		const login = useLogin();

		const res = await login('Ada@Example.com', 'pw');

		expect(res).toEqual({ success: true, verified: true, message: 'Login successful' });
		expect(useAuthStore().sessionToken).toBe('tok');
		// basic auth header is built from the normalized identifier
		expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBe(
			`Basic ${btoa('ada@example.com:pw')}`
		);
	});

	it('returns the verification ticket when a new IP needs confirmation', async () => {
		fetchMock.mockResolvedValue({
			requires_verification: true,
			ticket: 'tk-1',
			email: 'a@b.com',
			expires_in: 600,
			message: 'check your email'
		});
		const login = useLogin();

		const res = await login('ada', 'pw');

		expect(res).toMatchObject({
			success: true,
			verified: false,
			ticket: 'tk-1',
			email: 'a@b.com',
			expiresIn: 600
		});
		// must NOT have logged the user in yet
		expect(useAuthStore().sessionToken).toBeNull();
	});

	it('fetches the current user when login omits the user payload', async () => {
		fetchMock.mockResolvedValue({ session_token: 'tok' }); // no user
		const spy = vi.spyOn(useAuthStore(), 'fetchCurrentUser').mockResolvedValue(undefined as any);
		const login = useLogin();

		await login('ada', 'pw');

		expect(spy).toHaveBeenCalled();
	});

	it('passes through retry_after on a rate-limited failure', async () => {
		fetchMock.mockRejectedValue(httpError(429, 'Too many attempts', { retry_after: 30 }));
		const login = useLogin();

		const res = await login('ada', 'pw');

		expect(res).toEqual({ success: false, message: '429: Too many attempts', retryAfter: 30 });
	});
});

describe('useVerifyNewIPLogin', () => {
	it('verifies and stores the session on success', async () => {
		fetchMock.mockResolvedValue({ session_token: 'tok', user: { id: 'u1' } });
		const verify = useVerifyNewIPLogin();

		const res = await verify('tk-1', '12345678');

		expect(res).toEqual({ success: true, message: 'Verification successful' });
		expect(useAuthStore().sessionToken).toBe('tok');
		expect(fetchMock.mock.calls[0]![0]).toContain('ticket=tk-1');
		expect(fetchMock.mock.calls[0]![0]).toContain('code=12345678');
	});

	it('allows a retry when only the code is wrong', async () => {
		fetchMock.mockRejectedValue(httpError(400, 'Invalid verification code'));
		const verify = useVerifyNewIPLogin();

		const res = await verify('tk-1', '00000000');

		expect(res.success).toBe(false);
		expect((res as any).retryAllowed).toBe(true);
	});

	it('disallows retry when the ticket itself is dead (expired)', async () => {
		fetchMock.mockRejectedValue(httpError(400, 'Ticket expired'));
		const verify = useVerifyNewIPLogin();

		const res = await verify('tk-1', '00000000');

		expect(res.success).toBe(false);
		expect((res as any).retryAllowed).toBe(false);
	});

	it('disallows retry on a 403', async () => {
		fetchMock.mockRejectedValue(httpError(403, 'Forbidden'));
		const verify = useVerifyNewIPLogin();

		const res = await verify('tk-1', '00000000');

		expect((res as any).retryAllowed).toBe(false);
	});
});

describe('useLogout', () => {
	it('calls the backend, clears auth, and refreshes data', async () => {
		const authStore = useAuthStore();
		authStore.setSessionToken('tok');
		authStore.currentUser = { id: 'u1' } as any;
		fetchMock.mockResolvedValue({});
		const logout = useLogout();

		const res = await logout();

		expect(res.success).toBe(true);
		expect(authStore.sessionToken).toBeNull();
		expect(authStore.currentUser).toBeNull();
	});

	it('reports failure without throwing when the request errors', async () => {
		fetchMock.mockRejectedValue(new Error('network'));
		const logout = useLogout();

		const res = await logout();
		expect(res).toEqual({ success: false, message: 'Logout failed. Please try again.' });
	});
});

describe('useCurrentSessionToken', () => {
	it('reads the current token and can set a new one', () => {
		// pinia unwraps the store ref, so this returns the value (not a Ref)
		expect(useCurrentSessionToken()).toBeNull();
		useCurrentSessionToken('tok');
		expect(useAuthStore().sessionToken).toBe('tok');
		expect(useCurrentSessionToken()).toBe('tok');
	});
});
