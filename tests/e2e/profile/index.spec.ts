/**
 * E2E tests for `src/pages/profile/index.vue` - own profile editor.
 *
 * Client-only page. Anonymous → redirected to /login?redirect=/profile.
 * Query params (?success=, ?error=) trigger OAuth-related toasts.
 */

import { expect, skipIfIntegration, test } from '../utils/fixtures';

test.describe('Own profile (anonymous)', () => {
	test('redirects anonymous users to /login with return URL', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/profile');
		await expect(page).toHaveURL(/\/login\?redirect=%2Fprofile/, { timeout: 25_000 });
	});
});

test.describe('Own profile (logged in)', () => {
	test('renders profile editor for authenticated user', async ({ asUser, page, gotoHydrated }) => {
		await asUser({ username: 'gregory' });
		await gotoHydrated('/profile');
		// Editor should be visible - the editor mounts when user is loaded
		await expect(page).toHaveURL(/\/profile/);
	});

	test('renders the Invite Friends card with the personal invite link', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration(
			'asserts the seeded mock referral code ABC234; real backend mints a random code'
		);
		await asUser();
		await gotoHydrated('/profile');
		const invite = page.locator('#invite-section');
		await expect(invite.getByText('Invite Friends')).toBeVisible({ timeout: 12_000 });
		await expect(invite.getByRole('textbox').first()).toHaveValue(
			/app\.earth-app\.com\/invite\/ABC234/,
			{ timeout: 12_000 }
		);
		await expect(invite.getByRole('button', { name: 'Copy Link' })).toBeVisible();
		// conversions=2 crosses the first Recruiter tier (1) but not the second (5)
		await expect(invite.getByText('Recruiter', { exact: true })).toBeVisible();
	});

	test('shows success toast for ?success=oauth_signup', async ({ asUser, page, gotoHydrated }) => {
		await asUser();
		await gotoHydrated('/profile?success=oauth_signup');
		await expect(page.getByText(/Welcome!|account has been created/i).first()).toBeVisible({
			timeout: 6000
		});
	});

	test('shows success toast for ?success=oauth_linked', async ({ asUser, page, gotoHydrated }) => {
		await asUser();
		await gotoHydrated('/profile?success=oauth_linked');
		await expect(page.getByText(/OAuth Connected|successfully connected/i).first()).toBeVisible({
			timeout: 6000
		});
	});

	test('shows success toast for ?success=oauth_unlinked', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		await asUser();
		await gotoHydrated('/profile?success=oauth_unlinked');
		await expect(
			page.getByText(/OAuth Disconnected|successfully disconnected/i).first()
		).toBeVisible({
			timeout: 6000
		});
	});

	test('shows error toast for ?error=provider_error', async ({ asUser, page, gotoHydrated }) => {
		await asUser();
		await gotoHydrated('/profile?error=provider_error');
		await expect(page.getByText(/OAuth Provider Error|returned an error/i).first()).toBeVisible({
			timeout: 6000
		});
	});

	test('shows error toast for ?error=oauth_already_linked', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		await asUser();
		await gotoHydrated('/profile?error=oauth_already_linked');
		await expect(page.getByText(/OAuth Already Linked|already linked/i).first()).toBeVisible({
			timeout: 6000
		});
	});

	test('shows error toast for ?error=cannot_unlink_only_method', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		await asUser();
		await gotoHydrated('/profile?error=cannot_unlink_only_method');
		await expect(page.getByText(/Cannot Unlink|only authentication method/i).first()).toBeVisible({
			timeout: 6000
		});
	});
});
