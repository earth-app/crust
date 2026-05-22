/**
 * E2E tests for `src/pages/privacy-policy.vue` — fully static prerendered page.
 */

import { expect, test } from './utils/fixtures';

test.describe('Privacy Policy page', () => {
	test('renders the heading', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/privacy-policy');
		await expect(page.getByRole('heading', { name: 'Privacy Policy', exact: true })).toBeVisible();
	});

	test('renders Information We Collect section', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/privacy-policy');
		await expect(page.getByText(/Information We Collect/i).first()).toBeVisible();
	});

	test('renders How We Use Your Information section', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/privacy-policy');
		await expect(page.getByText(/How We Use Your Information/i)).toBeVisible();
	});

	test('explicitly states no sale of personal information', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/privacy-policy');
		await expect(page.getByText(/We do not sell, trade, or rent/i)).toBeVisible();
	});

	test('initial render is fast (< 5s)', async ({ page, gotoHydrated }) => {
		const start = Date.now();
		await gotoHydrated('/privacy-policy');
		await expect(page.getByRole('heading', { name: 'Privacy Policy', exact: true })).toBeVisible();
		expect(Date.now() - start).toBeLessThan(5000);
	});
});
