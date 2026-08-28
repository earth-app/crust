/**
 * E2E tests for `src/pages/activities/index.vue` - paginated activity catalog.
 *
 * Route rule: ISR 4h. The page renders a list grid plus, for logged-in users,
 * a "Recommended for You" section sourced from `/v2/users/current/activities/recommend`.
 */

import { expect, skipIfIntegration, test } from '../utils/fixtures';

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
		skipIfIntegration();
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
		skipIfIntegration('mockApi.set override does not apply against the real backend');
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

	// the catalog was a browse surface with no exploration mechanic; this is the distance-sampled draw
	test('draws an unexpected activity and re-rolls to a different one', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('depends on the mock surprise endpoint');
		await asUser();
		await gotoHydrated('/activities');

		const card = page.locator('#activity-surprise');
		await expect(card).toBeVisible();

		await card.getByRole('button', { name: /Surprise Me|Draw Another/i }).click();
		await expect(card.getByRole('button', { name: /Draw Another/i })).toBeVisible();
		const first = (await card.innerText()).trim();

		await card.getByRole('button', { name: /Draw Another/i }).click();
		await expect.poll(async () => (await card.innerText()).trim()).not.toBe(first);
	});

	// #24: activities do social work - the join surface on the detail page
	test('shows the groups gathered around an activity on its detail page', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('depends on the mock expeditions endpoint');
		await asUser();
		await gotoHydrated('/activities/act-1');

		const block = page.locator('#activity-expeditions');
		await expect(block).toBeVisible();
		await expect(block).toContainText('Dawn Chorus Group');
		// self-referential progress, never a rank
		await expect(block).toContainText('25%');
		await expect(block).toContainText('minutes outside');
	});

	test('hides the unexpected draw from anonymous visitors', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/activities');
		await expect(page.locator('#activity-surprise')).toHaveCount(0);
	});
});
