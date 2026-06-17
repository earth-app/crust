/**
 * E2E tests for `src/pages/index.vue` - the Earth App homepage.
 *
 * The homepage uses ISR (`/` -> 1h ISR) so its initial markup is server-
 * rendered, then the `<ClientOnly>` block hydrates and conditionally shows the
 * logged-in user or signup CTAs.
 *
 * Scoping note: "Login" and "Sign Up" appear in multiple places on the logged-
 * in homepage:
 *   - the global NavBar / Discover command palette (chrome) - outside <main>
 *   - the hero CTA row (the auth-gated buttons we actually want to assert on)
 *   - event-card "Sign Up" RSVP buttons inside `Today's Content` recommendations
 *
 * Scoping to `<main>` excludes the navbar but NOT the event-card RSVP buttons,
 * so the auth-gated assertions use the `[data-testid="hero-ctas"]` row that
 * lives in `src/pages/index.vue`. The rest still scope to <main> for the same
 * reason (skip the navbar).
 */

import type { Page } from '@playwright/test';
import { expect, skipIfIntegration, test } from './utils/fixtures';

const heroCtas = (page: Page) => page.getByTestId('hero-ctas');

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
		await expect(heroCtas(page).getByRole('button', { name: /^Login$/i })).toBeVisible();
		await expect(heroCtas(page).getByRole('button', { name: /^Sign Up$/i })).toBeVisible();
	});

	test('navigates to login when Login button is clicked', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/');
		await heroCtas(page)
			.getByRole('button', { name: /^Login$/i })
			.click();
		await expect(page).toHaveURL(/\/login$/);
	});

	test('navigates to signup when Sign Up button is clicked', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/');
		await heroCtas(page)
			.getByRole('button', { name: /^Sign Up$/i })
			.click();
		await expect(page).toHaveURL(/\/signup$/);
	});

	test('navigates to About page', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/');
		await heroCtas(page)
			.getByRole('button', { name: /About Us/i })
			.click();
		await expect(page).toHaveURL(/\/about$/);
	});

	test('does not show admin panel button', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/');
		await expect(heroCtas(page).getByRole('button', { name: /Admin Panel/i })).toHaveCount(0);
	});

	test('completes initial render within budget', async ({ page, gotoHydrated }) => {
		const budgetMs = process.env.PLAYWRIGHT_PROD === '1' ? 10_000 : 20_000;
		const start = Date.now();
		await gotoHydrated('/');
		await expect(page.getByRole('heading', { name: 'The Earth App' })).toBeVisible();
		expect(Date.now() - start).toBeLessThan(budgetMs);
	});
});

test.describe('Homepage (logged-in user)', () => {
	test('shows the welcome message with username', async ({ asUser, page, gotoHydrated }) => {
		skipIfIntegration('asUser username override does not apply to the real admin session');
		const user = await asUser({ username: 'gregory', id: 'gregory-id' });
		await gotoHydrated('/');
		await expect(page.getByText(`Welcome, @${user.username}`)).toBeVisible();
	});

	test('hides Login and Sign Up CTAs', async ({ asUser, page, gotoHydrated }) => {
		await asUser();
		await gotoHydrated('/');
		// Only check the hero CTA row - event-card RSVP buttons inside the
		// "Today's Content" recommendations section are also labeled "Sign Up"
		// (e.g. EventCard.vue) and must NOT be confused with the page-level
		// auth CTAs.
		await expect(heroCtas(page).getByRole('button', { name: /^Login$/i })).toHaveCount(0);
		await expect(heroCtas(page).getByRole('button', { name: /^Sign Up$/i })).toHaveCount(0);
	});

	test('does not show admin panel for non-admin', async ({ asUser, page, gotoHydrated }) => {
		skipIfIntegration('asUser() in integration mode is the seeded admin account');
		await asUser();
		await gotoHydrated('/');
		await expect(heroCtas(page).getByRole('button', { name: /Admin Panel/i })).toHaveCount(0);
	});
});

test.describe('Homepage (admin)', () => {
	test('shows Admin Panel button', async ({ asAdmin, page, gotoHydrated }) => {
		await asAdmin();
		await gotoHydrated('/');
		await expect(heroCtas(page).getByRole('button', { name: /Admin Panel/i })).toBeVisible();
	});

	test('navigates to /admin when Admin Panel is clicked', async ({
		asAdmin,
		page,
		gotoHydrated
	}) => {
		await asAdmin();
		await gotoHydrated('/');
		await heroCtas(page)
			.getByRole('button', { name: /Admin Panel/i })
			.click();
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
