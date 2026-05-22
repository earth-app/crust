/**
 * E2E tests for `src/pages/index.vue` — the Earth App homepage.
 *
 * The homepage uses ISR (`/` -> 1h ISR) so its initial markup is server-
 * rendered, then the `<ClientOnly>` block hydrates and conditionally shows the
 * logged-in user or signup CTAs.
 */

import { expect, test } from './utils/fixtures';

test.describe('Homepage (anonymous)', () => {
	test.beforeEach(async ({ asAnonymous }) => {
		await asAnonymous();
	});

	test('renders the hero title and tagline', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/');
		await expect(page.getByRole('heading', { name: 'The Earth App' })).toBeVisible();
		await expect(
			page.getByText(/Find Your Novelty, Try New Things, Discover the World/i)
		).toBeVisible();
	});

	test('shows Login and Sign Up CTAs', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/');
		await expect(page.getByRole('button', { name: /^Login$/i })).toBeVisible();
		await expect(page.getByRole('button', { name: /^Sign Up$/i })).toBeVisible();
	});

	test('navigates to login when Login button is clicked', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/');
		await page.getByRole('button', { name: /^Login$/i }).click();
		await expect(page).toHaveURL(/\/login$/);
	});

	test('navigates to signup when Sign Up button is clicked', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/');
		await page.getByRole('button', { name: /^Sign Up$/i }).click();
		await expect(page).toHaveURL(/\/signup$/);
	});

	test('navigates to About page', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/');
		await page
			.getByRole('button', { name: /About Us/i })
			.first()
			.click();
		await expect(page).toHaveURL(/\/about$/);
	});

	test('does not show admin panel button', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/');
		await expect(page.getByRole('button', { name: /Admin Panel/i })).toHaveCount(0);
	});

	test('completes initial render under 5 seconds', async ({ page, gotoHydrated }) => {
		const start = Date.now();
		await gotoHydrated('/');
		await expect(page.getByRole('heading', { name: 'The Earth App' })).toBeVisible();
		const elapsed = Date.now() - start;
		expect(elapsed).toBeLessThan(5000);
	});
});

test.describe('Homepage (logged-in user)', () => {
	test('shows the welcome message with username', async ({ asUser, page, gotoHydrated }) => {
		const user = await asUser({ username: 'gregory', id: 'gregory-id' });
		await gotoHydrated('/');
		await expect(page.getByText(`Welcome, @${user.username}`)).toBeVisible();
	});

	test('hides Login and Sign Up CTAs', async ({ asUser, page, gotoHydrated }) => {
		await asUser();
		await gotoHydrated('/');
		await expect(page.getByRole('button', { name: /^Login$/i })).toHaveCount(0);
		await expect(page.getByRole('button', { name: /^Sign Up$/i })).toHaveCount(0);
	});

	test('does not show admin panel for non-admin', async ({ asUser, page, gotoHydrated }) => {
		await asUser();
		await gotoHydrated('/');
		await expect(page.getByRole('button', { name: /Admin Panel/i })).toHaveCount(0);
	});
});

test.describe('Homepage (admin)', () => {
	test('shows Admin Panel button', async ({ asAdmin, page, gotoHydrated }) => {
		await asAdmin();
		await gotoHydrated('/');
		await expect(page.getByRole('button', { name: /Admin Panel/i })).toBeVisible();
	});

	test('navigates to /admin when Admin Panel is clicked', async ({
		asAdmin,
		page,
		gotoHydrated
	}) => {
		await asAdmin();
		await gotoHydrated('/');
		await page.getByRole('button', { name: /Admin Panel/i }).click();
		await expect(page).toHaveURL(/\/admin$/);
	});
});

test.describe('Homepage (error handling)', () => {
	test('renders gracefully when /v2/users/current returns 500', async ({
		mockApi,
		page,
		gotoHydrated
	}) => {
		await mockApi.set({
			method: 'GET',
			path: '^/v2/users/current$',
			status: 500,
			body: { message: 'Internal Server Error' },
			once: false
		});
		await gotoHydrated('/');
		// Should still show the page even if user fetch fails
		await expect(page.getByRole('heading', { name: 'The Earth App' })).toBeVisible();
	});
});
