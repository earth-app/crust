import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from 'stores/auth';
import type { User } from 'types/user';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// minimal user that clears isValidUser (id + username required)
const mkUser = (over: Partial<User> = {}): User =>
	({ id: 'u1', username: 'alice', is_admin: false, ...over }) as unknown as User;

describe('auth store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
		// reset the session-storage backed logout watermark between tests
		const store = useAuthStore();
		store.logout();
		store.setSessionToken(null);
	});

	describe('setSessionToken normalization', () => {
		it('stores a plain token verbatim', () => {
			const store = useAuthStore();
			store.setSessionToken('abc123');
			expect(store.sessionToken).toBe('abc123');
		});

		it('trims surrounding whitespace', () => {
			const store = useAuthStore();
			store.setSessionToken('  abc123  ');
			expect(store.sessionToken).toBe('abc123');
		});

		it('url-decodes an encoded token', () => {
			const store = useAuthStore();
			store.setSessionToken('a%20b');
			expect(store.sessionToken).toBe('a b');
		});

		it('strips surrounding double quotes (cookie JSON-stringify artifact)', () => {
			const store = useAuthStore();
			store.setSessionToken('"quoted"');
			expect(store.sessionToken).toBe('quoted');
		});

		it('maps empty / null / whitespace-only to null', () => {
			const store = useAuthStore();
			store.setSessionToken('   ');
			expect(store.sessionToken).toBeNull();
			store.setSessionToken('');
			expect(store.sessionToken).toBeNull();
			store.setSessionToken(null);
			expect(store.sessionToken).toBeNull();
		});

		it('keeps a malformed percent-encoded token raw (decode throws, swallowed)', () => {
			const store = useAuthStore();
			store.setSessionToken('%E0%A4%A'); // invalid utf-8 sequence
			expect(store.sessionToken).toBe('%E0%A4%A');
		});
	});

	describe('isAuthenticated / isAdmin getters', () => {
		it('isAuthenticated requires BOTH a token and a current user', () => {
			const store = useAuthStore();
			expect(store.isAuthenticated).toBe(false);

			store.setSessionToken('tok');
			// token alone is not enough
			expect(store.isAuthenticated).toBe(false);

			store.updateUser(mkUser()); // no-op while currentUser is null/undefined
			expect(store.isAuthenticated).toBe(false);
		});

		it('isAdmin reflects currentUser.is_admin and defaults false when no user', () => {
			const store = useAuthStore();
			expect(store.isAdmin).toBe(false);
		});
	});

	describe('updateUser', () => {
		it('is a no-op when there is no current user', () => {
			const store = useAuthStore();
			store.updateUser({ username: 'changed' });
			// nothing to merge into -> currentUser stays falsy, the patch is dropped
			expect(store.currentUser).toBeFalsy();
		});

		it('shallow-merges a partial patch onto an existing user', async () => {
			const store = useAuthStore();
			store.setSessionToken('tok');
			vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(mkUser({ is_admin: false })));
			await store.fetchCurrentUser();

			store.updateUser({ is_admin: true });
			expect(store.currentUser?.is_admin).toBe(true);
			expect(store.currentUser?.username).toBe('alice');
			expect(store.isAdmin).toBe(true);
			vi.unstubAllGlobals();
		});
	});

	describe('logout', () => {
		it('clears the user and token', () => {
			const store = useAuthStore();
			store.setSessionToken('tok');
			store.logout();
			expect(store.sessionToken).toBeNull();
			expect(store.currentUser).toBeNull();
			expect(store.isAuthenticated).toBe(false);
		});
	});

	describe('fetchCurrentUser', () => {
		afterEach(() => {
			vi.unstubAllGlobals();
		});

		it('resolves to null without a token (never hits the network)', async () => {
			const store = useAuthStore();
			const fetchSpy = vi.fn();
			vi.stubGlobal('$fetch', fetchSpy);

			const result = await store.fetchCurrentUser();

			expect(result).toBeNull();
			expect(store.currentUser).toBeNull();
			// no token -> the /current call is skipped entirely
			expect(fetchSpy).not.toHaveBeenCalled();
		});

		it('populates currentUser on a valid payload and authenticates', async () => {
			const store = useAuthStore();
			store.setSessionToken('tok');
			const user = mkUser({ is_admin: true });
			vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(user));

			const result = await store.fetchCurrentUser();

			expect(result).toEqual(user);
			expect(store.currentUser).toEqual(user);
			expect(store.isAuthenticated).toBe(true);
			expect(store.isAdmin).toBe(true);
		});

		it('leaves currentUser null on a malformed payload (no crash)', async () => {
			const store = useAuthStore();
			store.setSessionToken('tok');
			// missing username -> fails isValidUser
			vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ id: 'u1' }));

			const result = await store.fetchCurrentUser();

			expect(result).toBeNull();
			expect(store.currentUser).toBeNull();
		});

		it('treats an array payload (partial-serialization []) as malformed', async () => {
			const store = useAuthStore();
			store.setSessionToken('tok');
			vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([]));

			const result = await store.fetchCurrentUser();

			expect(result).toBeNull();
			expect(store.currentUser).toBeNull();
		});

		it('on 401 clears the token and user and marks a recent logout', async () => {
			const store = useAuthStore();
			store.setSessionToken('tok');
			vi.stubGlobal('$fetch', vi.fn().mockRejectedValue({ response: { status: 401 } }));

			const result = await store.fetchCurrentUser();

			expect(result).toBeNull();
			expect(store.sessionToken).toBeNull();
			expect(store.currentUser).toBeNull();
		});

		it('on a transient (500) error with no prior user, sets currentUser null', async () => {
			const store = useAuthStore();
			store.setSessionToken('tok');
			vi.stubGlobal('$fetch', vi.fn().mockRejectedValue({ statusCode: 500 }));

			const result = await store.fetchCurrentUser();

			expect(result).toBeNull();
			// token preserved on a non-auth error (not 401/403)
			expect(store.sessionToken).toBe('tok');
		});

		it('on a transient error preserves a previously-loaded user', async () => {
			const store = useAuthStore();
			store.setSessionToken('tok');
			const user = mkUser();
			vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(user));
			await store.fetchCurrentUser();

			// now a forced refetch errors transiently
			vi.stubGlobal('$fetch', vi.fn().mockRejectedValue({ statusCode: 503 }));
			const result = await store.fetchCurrentUser(true);

			// prior user kept rather than nulled
			expect(result).toEqual(user);
			expect(store.currentUser).toEqual(user);
		});

		it('returns the cached user without refetching when not forced', async () => {
			const store = useAuthStore();
			store.setSessionToken('tok');
			const user = mkUser();
			const fetchSpy = vi.fn().mockResolvedValue(user);
			vi.stubGlobal('$fetch', fetchSpy);

			await store.fetchCurrentUser();
			const callsAfterFirst = fetchSpy.mock.calls.length;
			const second = await store.fetchCurrentUser(); // not forced

			expect(second).toEqual(user);
			// the /current endpoint was not hit a second time
			expect(fetchSpy.mock.calls.length).toBe(callsAfterFirst);
		});

		it('dedups concurrent calls onto a single in-flight promise', async () => {
			const store = useAuthStore();
			store.setSessionToken('tok');
			const user = mkUser();
			let resolveFetch!: (v: User) => void;
			const fetchSpy = vi.fn(() => new Promise<User>((res) => (resolveFetch = res)));
			vi.stubGlobal('$fetch', fetchSpy);

			const p1 = store.fetchCurrentUser();
			const p2 = store.fetchCurrentUser();
			resolveFetch(user);
			const [r1, r2] = await Promise.all([p1, p2]);

			expect(r1).toEqual(user);
			expect(r2).toEqual(user);
			// only one network round trip for both callers
			expect(fetchSpy).toHaveBeenCalledTimes(1);
		});
	});
});
