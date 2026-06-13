/**
 * E2E tests for `src/pages/leaderboard.vue` + `components/user/Leaderboard.vue`.
 *
 * The board lives inside <ClientOnly> and defaults to the global Impact Points
 * metric. Global rows come from the cloud proxy (one /v2/users/{id} fan-out per
 * id); friends/circle scopes resolve directly from mantle and add a per-row
 * Challenge action. Anonymous visitors see a sign-in prompt on non-global tabs.
 */

import { expect, skipIfIntegration, test } from './utils/fixtures';

test.describe('Leaderboard (anonymous)', () => {
	test.beforeEach(async ({ asAnonymous }) => {
		await asAnonymous();
	});

	test('renders the hero and the default Points board', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/leaderboard');
		await expect(page.getByRole('heading', { name: 'Leaderboard', exact: true })).toBeVisible();
		await expect(
			page.getByRole('heading', { name: /Points Leaderboard \(Showing 10\)/ })
		).toBeVisible({ timeout: 12_000 });
	});

	test('global board renders rows from the seeded users', async ({ page, gotoHydrated }) => {
		skipIfIntegration('asserts the seeded mock user @author; real backend has different users');
		await gotoHydrated('/leaderboard');
		await expect(page.getByText('@author').first()).toBeVisible({ timeout: 12_000 });
	});

	test('exposes scope tabs and metric toggles', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/leaderboard');
		await expect(page.getByRole('tab', { name: 'Global' })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Friends' })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Circle' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Points' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Articles' })).toBeVisible();
	});

	test('switching metric to Articles updates the heading', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/leaderboard');
		await page.getByRole('button', { name: 'Articles' }).click();
		await expect(
			page.getByRole('heading', { name: /Articles Leaderboard \(Showing 10\)/ })
		).toBeVisible({ timeout: 12_000 });
	});

	test('non-global scope prompts anonymous visitors to sign in', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/leaderboard');
		await page.getByRole('tab', { name: 'Friends' }).click();
		await expect(
			page.getByText(/Sign in to see how you stack up against your friends/i)
		).toBeVisible({ timeout: 8_000 });
	});
});

test.describe('Leaderboard (logged in)', () => {
	test('friends scope renders rows with a Challenge action', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration(
			'friends scope needs seeded friend rows (@author); real admin has no friends'
		);
		await asUser();
		await gotoHydrated('/leaderboard');
		await page.getByRole('tab', { name: 'Friends' }).click();
		await expect(page.getByText('@author').first()).toBeVisible({ timeout: 12_000 });
		await expect(page.getByRole('button', { name: 'Challenge' }).first()).toBeVisible();
	});
});
