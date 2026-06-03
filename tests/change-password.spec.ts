/**
 * E2E tests for `src/pages/change-password.vue`.
 *
 * Client-only page that requires the user to be logged in. Anonymous users
 * are redirected to /login. Logged-in users see the password change form.
 */

import { expect, test } from './utils/fixtures';

test.describe('Change password (anonymous)', () => {
	test('redirects to /login when not authenticated', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/change-password');
		await page.waitForURL(/\/login\?redirect=%2Fchange-password/, { timeout: 8000 });
		await expect(page.getByText(/Not Logged In|must be logged in/i).first()).toBeVisible({
			timeout: 6000
		});
	});
});

test.describe('Change password (logged in)', () => {
	test('renders the change-password form for an authenticated user', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		await asUser();
		await gotoHydrated('/change-password');
		await expect(page.getByRole('heading', { name: /Change Password/i })).toBeVisible();
	});

	test('does not redirect when the user is logged in', async ({ asUser, page, gotoHydrated }) => {
		await asUser();
		await gotoHydrated('/change-password');
		// Stay on the page briefly to confirm no redirect
		await page.waitForTimeout(500);
		await expect(page).toHaveURL(/\/change-password/);
	});
});
