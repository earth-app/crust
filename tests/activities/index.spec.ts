/**
 * E2E tests for `src/pages/activities/index.vue` — paginated activity catalog.
 *
 * Route rule: ISR 4h. The page renders a list grid plus, for logged-in users,
 * a "Recommended for You" section sourced from `/v2/users/current/activities/recommend`.
 */

import { expect, test } from '../utils/fixtures';

test.describe('Activities list (anonymous)', () => {
	test('renders the All Activities heading', async ({ asAnonymous, page, gotoHydrated }) => {
		await asAnonymous();
		await gotoHydrated('/activities');
		await expect(page.getByRole('heading', { name: /All Activities/i })).toBeVisible();
	});

	test('does not show "Recommended for You" for anonymous users', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/activities');
		await expect(page.getByText('Recommended for You')).toHaveCount(0);
	});

	test('renders activity items from the mock backend', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/activities');
		// The mock provides 30 activities; at least one card should render
		await expect(page.getByText(/Sample Activity 1\b/).first()).toBeVisible({ timeout: 10_000 });
	});

	test('shows an error toast when /v2/activities returns 500', async ({
		asAnonymous,
		mockApi,
		page,
		gotoHydrated
	}) => {
		await mockApi.set({
			method: 'GET',
			path: '^/v2/activities$',
			status: 500,
			body: { message: 'Boom' },
			once: false
		});
		await asAnonymous();
		await gotoHydrated('/activities');
		await expect(page.getByText(/Error Loading Activities|error/i).first()).toBeVisible({
			timeout: 10_000
		});
	});
});

test.describe('Activities list (logged in)', () => {
	test('renders "Recommended for You" for logged-in user', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		await asUser();
		await gotoHydrated('/activities');
		await expect(page.getByText('Recommended for You').first()).toBeVisible();
	});

	test('renders both Recommended and All Activities sections', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		await asUser();
		await gotoHydrated('/activities');
		await expect(page.getByText('Recommended for You')).toBeVisible();
		await expect(page.getByRole('heading', { name: /All Activities/i })).toBeVisible();
	});
});
