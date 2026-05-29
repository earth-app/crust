/**
 * E2E tests for `src/pages/admin.vue` - admin control panel.
 *
 * Visible only when `user.is_admin === true`. Includes:
 *   - MOTD panel (set/clear MOTD)
 *   - Users panel (search/list, role changes)
 *   - Activities panel (search/list, draft creation)
 */

import { expect, skipIfIntegration, test } from './utils/fixtures';

test.describe('Admin page (anonymous)', () => {
	test('does not render admin panels for anonymous user', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/admin');
		await expect(page.getByText('MOTD Panel')).toHaveCount(0);
	});
});

test.describe('Admin page (regular user)', () => {
	test('does not render admin panels for a non-admin', async ({ asUser, page, gotoHydrated }) => {
		skipIfIntegration(
			'asUser() in integration mode is the seeded admin account, not a regular user'
		);
		await asUser();
		await gotoHydrated('/admin');
		await expect(page.getByText('MOTD Panel')).toHaveCount(0);
	});
});

test.describe('Admin page (admin)', () => {
	test('renders MOTD Panel for admin', async ({ asAdmin, page, gotoHydrated }) => {
		await asAdmin();
		await gotoHydrated('/admin');
		await expect(page.getByText(/MOTD Panel/i)).toBeVisible({ timeout: 10_000 });
	});

	test('renders Users section for admin', async ({ asAdmin, page, gotoHydrated }) => {
		await asAdmin();
		await gotoHydrated('/admin');
		await expect(page.getByRole('heading', { name: /^Users$/i })).toBeVisible({
			timeout: 10_000
		});
	});

	test('renders Activities section for admin', async ({ asAdmin, page, gotoHydrated }) => {
		await asAdmin();
		await gotoHydrated('/admin');
		await expect(page.getByRole('heading', { name: /^Activities$/i })).toBeVisible({
			timeout: 10_000
		});
	});

	test('Fetch Users button works', async ({ asAdmin, page, gotoHydrated }) => {
		await asAdmin();
		await gotoHydrated('/admin');
		await page.getByRole('button', { name: /Fetch Users/i }).click();
		// Eventually shows user rows
		await expect(page.getByText(/testuser|admin/i).first()).toBeVisible({ timeout: 10_000 });
	});

	test('MOTD update button is rendered', async ({ asAdmin, page, gotoHydrated }) => {
		await asAdmin();
		await gotoHydrated('/admin');
		await expect(page.getByRole('button', { name: /Update MOTD/i })).toBeVisible({
			timeout: 10_000
		});
	});

	test('Set Message of the Day input is editable', async ({ asAdmin, page, gotoHydrated }) => {
		await asAdmin();
		await gotoHydrated('/admin');
		const motdInput = page.getByPlaceholder(/Set the Message of the Day/i);
		await motdInput.fill('Test announcement');
		await expect(motdInput).toHaveValue('Test announcement');
	});
});
