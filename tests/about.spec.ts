/**
 * E2E tests for `src/pages/about.vue` - fully static prerendered page.
 */

import { expect, test } from './utils/fixtures';

test.describe('About page', () => {
	test('renders the page title and main heading', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/about');
		await expect(page).toHaveTitle(/About/i);
		await expect(page.getByRole('heading', { name: 'About The Earth App' })).toBeVisible();
	});

	test('renders the mission statement', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/about');
		await expect(page.getByText(/intellectual curiosity/i)).toBeVisible();
	});

	test('renders the Creator section with profile link', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/about');
		await expect(page.getByRole('heading', { name: 'Creator' })).toBeVisible();
		const profileLink = page.getByRole('link', { name: '@gmitch215' });
		await expect(profileLink).toBeVisible();
		await expect(profileLink).toHaveAttribute('href', /\/profile\/gmitch215$/);
	});

	test('external creator website link opens in new tab', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/about');
		const link = page.getByRole('link', { name: 'gmitch215.dev' });
		await expect(link).toBeVisible();
		await expect(link).toHaveAttribute('target', '_blank');
	});

	test('renders the same content for anonymous and logged-in users', async ({
		page,
		gotoHydrated,
		asUser
	}) => {
		await gotoHydrated('/about');
		const anonTitle = await page
			.getByRole('heading', { name: 'About The Earth App' })
			.textContent();
		await asUser();
		await gotoHydrated('/about');
		const loggedTitle = await page
			.getByRole('heading', { name: 'About The Earth App' })
			.textContent();
		expect(anonTitle).toBe(loggedTitle);
	});
});
