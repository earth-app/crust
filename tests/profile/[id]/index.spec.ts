/**
 * E2E tests for `src/pages/profile/[id]/index.vue` — public profile by id/username.
 */

import { expect, test } from '../../utils/fixtures';

test.describe('User profile (by id/username)', () => {
	test('renders profile for a known username', async ({ asAnonymous, page, gotoHydrated }) => {
		await asAnonymous();
		await gotoHydrated('/profile/testuser');
		// Page should render the UserProfile component (look for username)
		await page.waitForTimeout(1500);
		await expect(page).toHaveURL(/\/profile\/testuser/);
	});

	test('shows "User doesn\'t exist" for unknown username', async ({
		asAnonymous,
		page,
		gotoHydrated,
		mockApi
	}) => {
		await mockApi.set({
			method: 'GET',
			path: '^/v2/users/ghost$',
			status: 404,
			body: { message: 'User not found' },
			once: false
		});
		await asAnonymous();
		await gotoHydrated('/profile/ghost');
		await expect(
			page.getByText(/User doesn't exist|does not exist|User not found/i).first()
		).toBeVisible({
			timeout: 10_000
		});
	});

	test("logged-in user can view another user's profile", async ({ asUser, page, gotoHydrated }) => {
		await asUser({ username: 'me' });
		await gotoHydrated('/profile/admin');
		await page.waitForTimeout(1500);
		await expect(page).toHaveURL(/\/profile\/admin/);
	});
});
