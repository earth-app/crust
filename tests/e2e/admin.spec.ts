/**
 * E2E tests for `src/pages/admin.vue` - admin control panel.
 *
 * Visible only when `user.is_admin === true`. The page is a UTabs layout with
 * tabs: Analytics (default), Users, Blacklist, Content, Activities, MOTD.
 * Each test that needs a particular pane clicks into the tab first.
 */

import type { Page } from '@playwright/test';

import { expect, skipIfIntegration, test } from './utils/fixtures';

// click a UTabs tab by its label. Nuxt UI renders tabs with role="tab"
async function openTab(page: Page, name: string) {
	const tab = page.getByRole('tab', { name: new RegExp(`^${name}$`, 'i') });
	await tab.waitFor({ timeout: 10_000 });
	await tab.click();
}

test.describe('Admin page (anonymous)', () => {
	test('redirects anonymous user to /login with return URL', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/admin');
		await expect(page).toHaveURL(/\/login\?redirect=%2Fadmin/, { timeout: 25_000 });
		// the whole tab strip is gated on is_admin — none of the tab labels render
		await expect(page.getByRole('tab', { name: /MOTD/i })).toHaveCount(0);
	});
});

test.describe('Admin page (regular user)', () => {
	test('does not render admin tabs for a non-admin', async ({ asUser, page, gotoHydrated }) => {
		skipIfIntegration(
			'asUser() in integration mode is the seeded admin account, not a regular user'
		);
		await asUser();
		await gotoHydrated('/admin');
		await expect(page.getByRole('tab', { name: /MOTD/i })).toHaveCount(0);
	});
});

test.describe('Admin page (admin)', () => {
	test('renders MOTD pane for admin', async ({ asAdmin, page, gotoHydrated }) => {
		await asAdmin();
		await gotoHydrated('/admin');
		await openTab(page, 'MOTD');
		await expect(page.getByRole('heading', { name: /Message of the Day/i })).toBeVisible({
			timeout: 10_000
		});
	});

	test('renders Users pane for admin', async ({ asAdmin, page, gotoHydrated }) => {
		await asAdmin();
		await gotoHydrated('/admin');
		await openTab(page, 'Users');
		await expect(page.getByRole('heading', { name: /User Moderation/i })).toBeVisible({
			timeout: 10_000
		});
	});

	test('renders Activities pane for admin', async ({ asAdmin, page, gotoHydrated }) => {
		await asAdmin();
		await gotoHydrated('/admin');
		await openTab(page, 'Activities');
		await expect(page.getByRole('heading', { name: /^Activities$/i })).toBeVisible({
			timeout: 10_000
		});
	});

	test('renders Analytics pane by default for admin', async ({ asAdmin, page, gotoHydrated }) => {
		await asAdmin();
		await gotoHydrated('/admin');
		// analytics is the initial tab — no click required
		await expect(page.getByRole('heading', { name: /Traffic & Engagement/i })).toBeVisible({
			timeout: 10_000
		});
	});

	test('renders Blacklist pane for admin', async ({ asAdmin, page, gotoHydrated }) => {
		await asAdmin();
		await gotoHydrated('/admin');
		await openTab(page, 'Blacklist');
		await expect(page.getByRole('heading', { name: /Username & Email Blacklist/i })).toBeVisible({
			timeout: 10_000
		});
	});

	test('Search Users button works', async ({ asAdmin, page, gotoHydrated }) => {
		await asAdmin();
		await gotoHydrated('/admin');
		await openTab(page, 'Users');
		await page.getByRole('button', { name: /Search Users/i }).click();
		// eventually shows user rows in the moderation list
		await expect(page.getByText(/testuser|admin/i).first()).toBeVisible({ timeout: 10_000 });
	});

	test('Publish MOTD button is rendered', async ({ asAdmin, page, gotoHydrated }) => {
		await asAdmin();
		await gotoHydrated('/admin');
		await openTab(page, 'MOTD');
		await expect(page.getByRole('button', { name: /Publish MOTD/i })).toBeVisible({
			timeout: 10_000
		});
	});

	test('MOTD input is editable', async ({ asAdmin, page, gotoHydrated }) => {
		await asAdmin();
		await gotoHydrated('/admin');
		await openTab(page, 'MOTD');
		const motdInput = page.getByPlaceholder(/Set the Message of the Day/i);
		await motdInput.fill('Test announcement');
		await expect(motdInput).toHaveValue('Test announcement');
	});
});
