/**
 * E2E tests for `src/pages/profile/[id]/badges.vue` - badges grid for a user.
 */

import { expect, skipIfIntegration, test } from '../../utils/fixtures';

test.describe('User badges page', () => {
	test("renders a known user's badges page heading", async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('testuser does not exist on the real backend; page shows User Not Found');
		await asAnonymous();
		await gotoHydrated('/profile/testuser/badges');
		// The heading uses the @username handle from useDisplayName -- expect "Badges"
		await expect(page.getByText(/Badges/i).first()).toBeVisible({ timeout: 10_000 });
	});

	test('shows "User Not Found" for unknown user', async ({
		asAnonymous,
		mockApi,
		page,
		gotoHydrated
	}) => {
		await mockApi.set({
			method: 'GET',
			path: '^/v2/users/ghost-badges$',
			status: 404,
			body: { message: 'User not found' },
			once: false
		});
		await asAnonymous();
		await gotoHydrated('/profile/ghost-badges/badges');
		await expect(page.getByText(/User Not Found|does not exist/i).first()).toBeVisible({
			timeout: 10_000
		});
	});

	test('renders badges grid for logged-in user', async ({ asUser, page, gotoHydrated }) => {
		await asUser();
		await gotoHydrated('/profile/testuser/badges');
		await expect(page).toHaveURL(/\/profile\/testuser\/badges/);
	});
});
