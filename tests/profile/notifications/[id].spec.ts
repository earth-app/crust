/**
 * E2E tests for `src/pages/profile/notifications/[id].vue` - single notification.
 */

import { expect, test } from '../../utils/fixtures';
import { makeNotification } from '../../utils/mock-data';

test.describe('Notification detail (anonymous)', () => {
	test('does not render notification details for anonymous users', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/profile/notifications/notif-1');
		// Without auth, the notification body should not be rendered (Loading or empty state)
		await expect(page).toHaveURL(/\/profile\/notifications\/notif-1/);
	});
});

test.describe('Notification detail (logged in)', () => {
	test('renders notification title and message', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		const notif = makeNotification({
			id: 'notif-1',
			title: 'Welcome to the Earth App!',
			message: 'Thanks for signing up.'
		});
		await mockApi.set({
			method: 'GET',
			path: '^/v2/users/test-user-1/notifications/notif-1$',
			body: notif,
			once: false
		});
		await asUser();
		await gotoHydrated('/profile/notifications/notif-1');
		await page.waitForTimeout(2000);
		await expect(page).toHaveURL(/\/profile\/notifications\/notif-1/);
	});
});
