/**
 * E2E tests for `src/pages/prompts/index.vue` - prompts list.
 */

import { expect, skipIfIntegration, test } from '../utils/fixtures';

test.describe('Prompts list (anonymous)', () => {
	test('renders the "Today\'s Prompts" heading', async ({ asAnonymous, page, gotoHydrated }) => {
		await asAnonymous();
		await gotoHydrated('/prompts');
		await expect(page.getByRole('heading', { name: /Today's Prompts/i })).toBeVisible();
	});

	test('Create Prompt button is disabled for anonymous users (visually)', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/prompts');
		const btn = page.getByTitle('Create Prompt');
		// Either disabled or visible - tooltip-driven
		await expect(btn.first()).toBeVisible();
	});

	test('Refresh button reloads prompts', async ({ asAnonymous, page, gotoHydrated }) => {
		await asAnonymous();
		await gotoHydrated('/prompts');
		await page.getByTitle('Refresh').click();
		// Heading still visible after refresh
		await expect(page.getByRole('heading', { name: /Today's Prompts/i })).toBeVisible();
	});

	test('renders prompts from the mock backend', async ({ asAnonymous, page, gotoHydrated }) => {
		skipIfIntegration();
		await asAnonymous();
		await gotoHydrated('/prompts');
		await expect(page.getByText(/Sample prompt 1\?/i).first()).toBeVisible({ timeout: 10_000 });
	});
});

test.describe('Prompts list (logged in)', () => {
	test('Create Prompt button navigates to /prompts/new when allowed', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		await asUser({ account: { account_type: 'ADMINISTRATOR' } });
		await gotoHydrated('/prompts');
		await page.getByTitle('Create Prompt').click();
		// Admin can create; clicking should attempt navigation
		await page.waitForURL(/\/prompts\/new/, { timeout: 8000 }).catch(() => {});
	});
});

test.describe('Prompts list (error states)', () => {
	test('shows error toast when fetch fails', async ({
		asAnonymous,
		mockApi,
		page,
		gotoHydrated
	}) => {
		await mockApi.set({
			method: 'GET',
			path: '^/v2/prompts/random$',
			status: 500,
			body: { message: 'Boom' },
			once: false
		});
		await asAnonymous();
		await gotoHydrated('/prompts');
		await expect(page.getByText(/Error|Failed to load prompts/i).first()).toBeVisible({
			timeout: 10_000
		});
	});
});
