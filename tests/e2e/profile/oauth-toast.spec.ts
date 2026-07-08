import { expect, expectToast, test } from '../utils/fixtures';

test.describe('Profile OAuth success toasts', () => {
	test('shows the "Signed In" toast for ?success=oauth_login (not the link toast)', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		await asUser();
		await gotoHydrated('/profile?success=oauth_login&provider=google');

		await expectToast(page, /Signed In|now signed in/i);
		// a login must never surface the account-link toast
		await expect(page.getByText(/OAuth Connected/i)).toHaveCount(0);
	});

	test('still shows the "OAuth Connected" toast for a genuine ?success=oauth_linked', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		await asUser();
		await gotoHydrated('/profile?success=oauth_linked&provider=google');

		await expectToast(page, /OAuth Connected|successfully connected/i);
		await expect(page.getByText(/^Signed In$/i)).toHaveCount(0);
	});
});

test.describe('OAuth provider buttons', () => {
	test('login page renders testable, labelled provider buttons', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/login');

		const google = page.locator('[data-testid="oauth-google"]').first();
		await expect(google).toBeVisible({ timeout: 8000 });
		await expect(google).toHaveAttribute('aria-label', /Continue with Google/i);

		// a second active provider from OAUTH_PROVIDERS
		await expect(page.locator('[data-testid="oauth-github"]').first()).toBeVisible();
	});
});
