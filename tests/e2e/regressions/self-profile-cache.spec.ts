import { expect, skipIfIntegration, test } from '../utils/fixtures';

test.describe('Self-profile cache-poison recovery', () => {
	test('own profile (by id) renders despite a stripped serializeUser response', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();

		const selfId = 'self-strip-id';
		const selfUsername = 'selfstrip';

		// log in AS this identity first so authStore.currentUser is the fallback
		await asUser({ id: selfId, username: selfUsername });

		await mockApi.set({
			method: 'GET',
			path: `^/v2/users/${selfId}$`,
			status: 200,
			body: [],
			once: false
		});

		// deep-link straight to own profile by the poisoned id
		await gotoHydrated(`/profile/${selfId}`);

		// the self-fallback must surface the auth user; profile renders, no not-found
		await expect(page.getByText(new RegExp(selfUsername, 'i')).first()).toBeVisible({
			timeout: 10_000
		});
		await expect(page.getByText(/User doesn't exist|does not exist/i)).toHaveCount(0);
	});

	test('own profile (by @username) renders despite a stripped serializeUser response', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();

		const selfId = 'self-strip-id-2';
		const selfUsername = 'selfstrip2';

		await asUser({ id: selfId, username: selfUsername });

		// strip every identifier form the page might resolve the self user through
		await mockApi.setMany([
			{ method: 'GET', path: `^/v2/users/${selfId}$`, status: 200, body: [], once: false },
			{ method: 'GET', path: `^/v2/users/@${selfUsername}$`, status: 200, body: [], once: false },
			{ method: 'GET', path: `^/v2/users/${selfUsername}$`, status: 200, body: [], once: false }
		]);

		await gotoHydrated(`/profile/@${selfUsername}`);

		await expect(page.getByText(new RegExp(selfUsername, 'i')).first()).toBeVisible({
			timeout: 10_000
		});
		await expect(page.getByText(/User doesn't exist|does not exist/i)).toHaveCount(0);
	});
});
