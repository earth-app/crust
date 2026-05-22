/**
 * E2E tests for `src/pages/profile/notifications/index.vue`.
 */

import { expect, test } from '../../utils/fixtures';

test.describe('Notifications list (anonymous)', () => {
	test('shows "must be logged in" message for anonymous users', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/profile/notifications');
		await expect(page.getByText(/need to be logged in/i).first()).toBeVisible({ timeout: 25_000 });
	});
});

test.describe('Notifications list (logged in)', () => {
	test('renders user-specific notifications heading', async ({ asUser, page, gotoHydrated }) => {
		await asUser({ username: 'gregory' });
		await gotoHydrated('/profile/notifications');
		await expect(page.getByText(/Notifications for @gregory/i).first()).toBeVisible({
			timeout: 15_000
		});
	});

	test('shows unread count', async ({ asUser, page, gotoHydrated }) => {
		await asUser();
		await gotoHydrated('/profile/notifications');
		await expect(page.getByText(/\d+ unread/i)).toBeVisible({ timeout: 10_000 });
	});
});
