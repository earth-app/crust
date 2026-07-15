/**
 * E2E tests for `src/pages/refund-policy.vue` - fully static prerendered page.
 */

import { expect, test } from './utils/fixtures';

test.describe('Refund Policy page', () => {
	test('renders the heading and last-updated date', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/refund-policy');
		await expect(page.getByRole('heading', { name: 'Refund Policy' })).toBeVisible();
		await expect(page.getByText(/Last Updated/i)).toBeVisible();
	});

	test('renders the key money-back sections', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/refund-policy');
		await expect(page.getByText(/14-Day Money-Back Guarantee/i)).toBeVisible();
		await expect(page.getByText(/EU and UK Right of Withdrawal/i)).toBeVisible();
		await expect(page.getByText(/Purchases Made Through Apple or Google/i)).toBeVisible();
	});

	test('is accessible to anonymous users', async ({ asAnonymous, page, gotoHydrated }) => {
		await asAnonymous();
		await gotoHydrated('/refund-policy');
		await expect(page.getByRole('heading', { name: 'Refund Policy' })).toBeVisible();
	});

	test('initial render is within budget', async ({ page, gotoHydrated }) => {
		// 5s against the pre-built bundle; 15s against dev mode (Vite compiles
		// on demand and the budget can't catch real regressions there).
		const budgetMs = process.env.PLAYWRIGHT_PROD === '1' ? 5_000 : 15_000;
		const start = Date.now();
		await gotoHydrated('/refund-policy');
		await expect(page.getByRole('heading', { name: 'Refund Policy' })).toBeVisible();
		expect(Date.now() - start).toBeLessThan(budgetMs);
	});
});
