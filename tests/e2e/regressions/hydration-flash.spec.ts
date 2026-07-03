import { expect, test } from '../utils/fixtures';

test.describe('Home hero auth-state hydration', () => {
	test('anonymous: shows the anon tagline + CTAs, never the logged-in welcome', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/');

		// correct anon state present
		await expect(page.getByText(/Find Your Novelty/i).first()).toBeVisible({ timeout: 10_000 });
		await expect(page.getByRole('button', { name: /^Login$/ }).first()).toBeVisible();
		await expect(page.getByRole('button', { name: /^Sign Up$/ }).first()).toBeVisible();

		// wrong (logged-in) state must be entirely absent
		await expect(page.getByText(/Welcome, @/i)).toHaveCount(0);
		await expect(page.getByRole('button', { name: /My Quests/i })).toHaveCount(0);
		await expect(page.getByRole('button', { name: /Admin Panel/i })).toHaveCount(0);
	});

	test('logged-in: shows the welcome, never the Login/Sign Up CTAs', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		await asUser({ username: 'flashuser' });
		await gotoHydrated('/');

		// correct logged-in state present
		await expect(page.getByText(/Welcome, @flashuser/i).first()).toBeVisible({ timeout: 10_000 });
		await expect(page.getByRole('button', { name: /My Quests/i }).first()).toBeVisible();

		// wrong (anon) state must be entirely absent
		await expect(page.getByText(/Find Your Novelty/i)).toHaveCount(0);
		await expect(page.getByRole('button', { name: /^Login$/ })).toHaveCount(0);
		await expect(page.getByRole('button', { name: /^Sign Up$/ })).toHaveCount(0);
	});

	test('admin: shows the Admin Panel CTA and no anon CTAs', async ({
		asAdmin,
		page,
		gotoHydrated
	}) => {
		await asAdmin({ username: 'flashadmin' });
		await gotoHydrated('/');

		await expect(page.getByText(/Welcome, @flashadmin/i).first()).toBeVisible({ timeout: 10_000 });
		await expect(page.getByRole('button', { name: /Admin Panel/i }).first()).toBeVisible();
		await expect(page.getByRole('button', { name: /^Login$/ })).toHaveCount(0);
		await expect(page.getByRole('button', { name: /^Sign Up$/ })).toHaveCount(0);
	});
});
