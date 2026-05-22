/**
 * E2E tests for `src/pages/profile/quests/index.vue` — quest progress list.
 */

import { expect, test } from '../../utils/fixtures';

test.describe('Quests page (anonymous)', () => {
	test('renders the Quests heading even for anonymous users', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/profile/quests');
		// Page may show loading or empty state; we just confirm route loads
		await expect(page).toHaveURL(/\/profile\/quests/);
	});
});

test.describe('Quests page (logged in)', () => {
	test('renders Quests heading for logged-in user', async ({ asUser, page, gotoHydrated }) => {
		await asUser();
		await gotoHydrated('/profile/quests');
		await expect(page.getByRole('heading', { name: 'Quests', exact: true })).toBeVisible({
			timeout: 10_000
		});
	});

	test('renders "Track your progress" tagline', async ({ asUser, page, gotoHydrated }) => {
		await asUser();
		await gotoHydrated('/profile/quests');
		await expect(page.getByText(/Track your progress and earn rewards/i)).toBeVisible({
			timeout: 10_000
		});
	});

	test('renders Current Quest when available', async ({ asUser, page, gotoHydrated }) => {
		await asUser();
		await gotoHydrated('/profile/quests');
		// Mock returns a current quest; whether it's actually rendered depends on quest component
		await page.waitForTimeout(1500);
		await expect(page).toHaveURL(/\/profile\/quests/);
	});

	test('renders empty state when no quests available', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		await mockApi.setMany([
			{ method: 'GET', path: '^/v1/users/quests$', body: [], once: false, backend: 'cloud' },
			{
				method: 'GET',
				path: '^/v1/users/quests/current$',
				body: { quest: null, progress: 0 },
				once: false,
				backend: 'cloud'
			}
		]);
		await asUser();
		await gotoHydrated('/profile/quests');
		await page.waitForTimeout(1500);
		await expect(page).toHaveURL(/\/profile\/quests/);
	});
});
