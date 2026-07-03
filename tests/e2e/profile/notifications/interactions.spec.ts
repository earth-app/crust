import { expect, skipIfIntegration, test } from '../../utils/fixtures';
import { makeNotification } from '../../utils/mock-data';

const NOW_SEC = Math.floor(Date.parse('2026-05-21T12:00:00.000Z') / 1000);

function seedList(items: any[]) {
	const unread = items.filter((n) => !n.read).length;
	return {
		method: 'GET' as const,
		path: '^/v2/users/current/notifications$',
		body: {
			unread_count: unread,
			has_warnings: items.some((n) => n.type === 'warning'),
			has_errors: items.some((n) => n.type === 'error'),
			items
		},
		once: false
	};
}

test.describe('Notification interactions', () => {
	test('marks a single notification read via the unread dot', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('seeds mock notifications; real backend has no fixtures');
		const items = [
			makeNotification({ id: 'notif-a', title: 'First Notice', read: false, created_at: NOW_SEC }),
			makeNotification({ id: 'notif-b', title: 'Second Notice', read: true, created_at: NOW_SEC })
		];
		await mockApi.setMany([
			seedList(items),
			{
				method: 'POST',
				path: '^/v2/users/current/notifications/notif-a/mark_read$',
				status: 204,
				body: '',
				once: false
			}
		]);
		await asUser();
		await gotoHydrated('/profile/notifications');

		await expect(page.locator('#notifications-count')).toContainText(/1 unread/i, {
			timeout: 12_000
		});

		// the unread dot carries title="Mark as Read"
		const dot = page.locator('[title="Mark as Read"]').first();
		await expect(dot).toBeVisible({ timeout: 8000 });
		await dot.click();

		// unread count drops to 0 and the dot disappears
		await expect(page.locator('#notifications-count')).toContainText(/0 unread/i, {
			timeout: 8000
		});
		await expect(page.locator('[title="Mark as Read"]')).toHaveCount(0);
	});

	test('deletes a notification through the confirm modal', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('seeds mock notifications; real backend has no fixtures');
		const items = [
			makeNotification({
				id: 'notif-del',
				title: 'Deletable Notice',
				read: true,
				created_at: NOW_SEC
			})
		];
		await mockApi.setMany([
			seedList(items),
			{
				method: 'DELETE',
				path: '^/v2/users/current/notifications/notif-del$',
				status: 204,
				body: '',
				once: false
			}
		]);
		await asUser();
		await gotoHydrated('/profile/notifications');

		await expect(page.getByText('Deletable Notice').first()).toBeVisible({ timeout: 12_000 });

		// delete icon is only rendered with :additional (the full-page list)
		await page.locator('[title="Delete Notification"]').first().click();

		const modal = page.getByRole('dialog');
		await expect(modal.getByText(/Delete Notification\?/i)).toBeVisible({ timeout: 8000 });
		await modal.getByRole('button', { name: 'Delete', exact: true }).click();

		await expect(page.getByText('Deletable Notice')).toHaveCount(0, { timeout: 8000 });
		await expect(page.getByText(/Notification deleted successfully/i).first()).toBeVisible();
	});

	test('"Mark All as Read" drops the unread count to zero', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('seeds mock notifications; real backend has no fixtures');
		const items = [
			makeNotification({ id: 'n1', title: 'One', read: false, created_at: NOW_SEC }),
			makeNotification({ id: 'n2', title: 'Two', read: false, created_at: NOW_SEC })
		];
		await mockApi.setMany([
			seedList(items),
			{
				method: 'POST',
				path: '^/v2/users/current/notifications/mark_all_read$',
				status: 204,
				body: '',
				once: false
			}
		]);
		await asUser();
		await gotoHydrated('/profile/notifications');

		await expect(page.locator('#notifications-count')).toContainText(/2 unread/i, {
			timeout: 12_000
		});

		await page.getByText('Mark All as Read').first().click();

		await expect(page.locator('#notifications-count')).toContainText(/0 unread/i, {
			timeout: 8000
		});
	});

	test('"Clear All" empties the list after confirming', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('seeds mock notifications; real backend has no fixtures');
		const items = [
			makeNotification({ id: 'c1', title: 'Clearable One', read: false, created_at: NOW_SEC }),
			makeNotification({ id: 'c2', title: 'Clearable Two', read: true, created_at: NOW_SEC })
		];
		await mockApi.setMany([
			seedList(items),
			{
				method: 'DELETE',
				path: '^/v2/users/current/notifications/clear$',
				status: 204,
				body: '',
				once: false
			}
		]);
		await asUser();
		await gotoHydrated('/profile/notifications');

		await expect(page.getByText('Clearable One').first()).toBeVisible({ timeout: 12_000 });

		await page.getByText('Clear All').first().click();

		const modal = page.getByRole('dialog');
		await expect(modal.getByText(/Clear All Notifications\?/i)).toBeVisible({ timeout: 8000 });
		await modal.getByRole('button', { name: 'Clear All', exact: true }).click();

		// list collapses to the empty state
		await expect(page.getByText(/No notifications/i).first()).toBeVisible({ timeout: 8000 });
	});

	test('opening a notification row navigates to detail and auto-marks read', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('seeds mock notifications; real backend has no fixtures');
		const notif = makeNotification({
			id: 'notif-detail',
			title: 'Detailed Notice',
			message: 'The full body of the notification.',
			read: false,
			created_at: NOW_SEC
		});
		await mockApi.setMany([
			seedList([notif]),
			{
				method: 'GET',
				path: '^/v2/users/current/notifications/notif-detail$',
				body: notif,
				once: false
			},
			{
				method: 'POST',
				path: '^/v2/users/current/notifications/notif-detail/mark_read$',
				status: 204,
				body: '',
				once: false
			}
		]);
		await asUser();
		await gotoHydrated('/profile/notifications');

		// the title links to the detail route
		await page.getByRole('link', { name: 'Detailed Notice' }).first().click();

		await expect(page).toHaveURL(/\/profile\/notifications\/notif-detail/, { timeout: 8000 });
		await expect(page.getByRole('heading', { name: 'Detailed Notice' })).toBeVisible({
			timeout: 8000
		});
		await expect(page.getByText('The full body of the notification.').first()).toBeVisible();
	});
});
