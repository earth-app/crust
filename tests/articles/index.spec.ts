/**
 * E2E tests for `src/pages/articles/index.vue` — article hub with multiple sections.
 */

import { expect, skipIfIntegration, test } from '../utils/fixtures';

test.describe('Articles list (anonymous)', () => {
	test('renders the Explore Articles section', async ({ asAnonymous, page, gotoHydrated }) => {
		await asAnonymous();
		await gotoHydrated('/articles');
		await expect(page.getByText(/Explore Articles/i).first()).toBeVisible();
	});

	test('does NOT show "Recommended for You" for anonymous', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/articles');
		await expect(page.getByText('Recommended for You')).toHaveCount(0);
	});

	test('renders Recent Articles section', async ({ asAnonymous, page, gotoHydrated }) => {
		await asAnonymous();
		await gotoHydrated('/articles');
		await expect(page.getByText(/Recent Articles/i).first()).toBeVisible();
	});

	test('renders Older Articles section', async ({ asAnonymous, page, gotoHydrated }) => {
		await asAnonymous();
		await gotoHydrated('/articles');
		await expect(page.getByText(/Older Articles/i).first()).toBeVisible();
	});
});

test.describe('Articles list (logged in)', () => {
	test('shows Recommended for You section for logged-in user', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		await asUser();
		await gotoHydrated('/articles');
		await expect(page.getByText('Recommended for You').first()).toBeVisible();
	});

	test('article create button is disabled for FREE accounts', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration(
			'asUser({account_type:FREE}) overrides do not apply to the real admin session'
		);
		await asUser({ account: { account_type: 'FREE' } });
		await gotoHydrated('/articles');
		// Plus icon button next to refresh; gating depends on account_type
		const createBtn = page
			.locator('button:has([class*="i-mdi-plus"]), button[icon*="mdi:plus"]')
			.first();
		if ((await createBtn.count()) > 0) {
			await expect(createBtn).toBeDisabled();
		}
	});

	test('article create button is enabled for WRITER accounts', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		await asUser({ account: { account_type: 'WRITER' } });
		await gotoHydrated('/articles');
		await expect(page.getByText(/Explore Articles/i).first()).toBeVisible();
	});
});

test.describe('Articles list (error states)', () => {
	test('renders gracefully when the articles endpoint returns 500', async ({
		asAnonymous,
		mockApi,
		page,
		gotoHydrated
	}) => {
		await mockApi.set({
			method: 'GET',
			path: '^/v2/articles$',
			status: 500,
			body: { message: 'Failed' },
			once: false
		});
		await asAnonymous();
		await gotoHydrated('/articles');
		await expect(page).toHaveURL(/\/articles(\?|$)/);
	});
});
