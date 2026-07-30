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
		// target the section headings (the phrases also recur in body prose, so a plain
		// getByText resolves to multiple elements and trips strict mode)
		await expect(page.getByRole('heading', { name: /14-Day Money-Back Guarantee/i })).toBeVisible();
		await expect(
			page.getByRole('heading', { name: /EU and UK Right of Withdrawal/i })
		).toBeVisible();
		await expect(
			page.getByRole('heading', { name: /Purchases Made Through Apple or Google/i })
		).toBeVisible();
	});

	test('is accessible to anonymous users', async ({ asAnonymous, page, gotoHydrated }) => {
		await asAnonymous();
		await gotoHydrated('/refund-policy');
		await expect(page.getByRole('heading', { name: 'Refund Policy' })).toBeVisible();
	});
});
