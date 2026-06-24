/**
 * E2E tests for the admin Quest Management tab (`src/components/admin/QuestManagement.vue`).
 *
 * The tab is gated on `user.is_admin` like the rest of `/admin`. Runs in both the mocked
 * backend and integration modes; mock-shaped assertions are guarded with `skipIfIntegration`.
 */

import type { Page } from '@playwright/test';

import { expect, skipIfIntegration, test } from './utils/fixtures';

async function openTab(page: Page, name: string) {
	const tab = page.getByRole('tab', { name: new RegExp(`^${name}$`, 'i') });
	await tab.waitFor({ timeout: 10_000 });
	await tab.click();
}

test.describe('Admin Quests tab (non-admin)', () => {
	test('does not expose the Quests tab to a regular user', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('asUser() in integration mode is the seeded admin account');
		await asUser();
		await gotoHydrated('/admin');
		await expect(page.getByRole('tab', { name: /^Quests$/i })).toHaveCount(0);
	});
});

test.describe('Admin Quests tab (admin)', () => {
	test('renders the Quest Management pane', async ({ asAdmin, page, gotoHydrated }) => {
		await asAdmin();
		await gotoHydrated('/admin');
		await openTab(page, 'Quests');
		await expect(page.getByRole('heading', { name: /Quest Management/i })).toBeVisible({
			timeout: 10_000
		});
	});

	test('Search Users surfaces a selectable user', async ({ asAdmin, page, gotoHydrated }) => {
		await asAdmin();
		await gotoHydrated('/admin');
		await openTab(page, 'Quests');
		await page.getByRole('button', { name: /Search Users/i }).click();
		await expect(page.getByText(/testuser|admin/i).first()).toBeVisible({ timeout: 10_000 });
	});

	test('selecting a user reveals the Active Quest section', async ({
		asAdmin,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('relies on the mock user list being clickable + seeded');
		await asAdmin();
		await gotoHydrated('/admin');
		await openTab(page, 'Quests');
		await page.getByRole('button', { name: /Search Users/i }).click();
		// click the first user row in the results list
		await page.locator('button:has-text("@")').first().click();
		await expect(page.getByText(/Active Quest/i).first()).toBeVisible({ timeout: 10_000 });
	});
});
