/**
 * E2E tests for `src/pages/prompts/new.vue` — prompt creation.
 *
 * Gate: users with PRIVATE profile are redirected to /profile with a toast.
 */

import { expect, test } from '../utils/fixtures';

test.describe('Prompt creation (anonymous)', () => {
	test('does not crash for anonymous users', async ({ asAnonymous, page, gotoHydrated }) => {
		await asAnonymous();
		await gotoHydrated('/prompts/new');
		await page.waitForTimeout(500);
	});
});

test.describe('Prompt creation (PRIVATE visibility)', () => {
	test('redirects to /profile with toast when profile is private', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		await asUser({ account: { account_type: 'FREE', visibility: 'PRIVATE' } });
		await gotoHydrated('/prompts/new');
		await page.waitForURL(/\/profile$/, { timeout: 15_000 });
		await expect(page.getByText(/Profile Private/i).first()).toBeVisible({ timeout: 8000 });
	});
});

test.describe('Prompt creation (PUBLIC visibility)', () => {
	test('renders the create menu for a PUBLIC user', async ({ asUser, page, gotoHydrated }) => {
		await asUser({ account: { visibility: 'PUBLIC' } });
		await gotoHydrated('/prompts/new');
		await page.waitForTimeout(1500);
		await expect(page).toHaveURL(/\/prompts\/new/);
	});

	test('renders the create menu for an UNLISTED user', async ({ asUser, page, gotoHydrated }) => {
		await asUser({ account: { visibility: 'UNLISTED' } });
		await gotoHydrated('/prompts/new');
		await page.waitForTimeout(1500);
		await expect(page).toHaveURL(/\/prompts\/new/);
	});
});
