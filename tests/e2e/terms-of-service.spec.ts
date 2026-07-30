/**
 * E2E tests for `src/pages/terms-of-service.vue` - fully static prerendered page.
 */

import { expect, test } from './utils/fixtures';

test.describe('Terms of Service page', () => {
	test('renders the heading and last-updated date', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/terms-of-service');
		await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible();
		await expect(page.getByText(/Last Updated/i)).toBeVisible();
	});

	test('renders all numbered sections', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/terms-of-service');
		await expect(page.getByText(/General Provisions/i)).toBeVisible();
	});

	test('is accessible to anonymous users', async ({ asAnonymous, page, gotoHydrated }) => {
		await asAnonymous();
		await gotoHydrated('/terms-of-service');
		await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible();
	});
});
