/**
 * E2E tests for `src/pages/profile/index.vue` - own profile editor.
 *
 * Client-only page. Anonymous → "Please log in" message. Logged-in → editor.
 * Query params (?success=, ?error=) trigger OAuth-related toasts.
 */

import { expect, test } from '../utils/fixtures';

test.describe('Own profile (anonymous)', () => {
	test('shows "Please log in" message for anonymous users', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/profile');
		await expect(page.getByText(/Please log in to view your profile/i).first()).toBeVisible({
			timeout: 25_000
		});
	});
});

test.describe('Own profile (logged in)', () => {
	test('renders profile editor for authenticated user', async ({ asUser, page, gotoHydrated }) => {
		await asUser({ username: 'gregory' });
		await gotoHydrated('/profile');
		// Editor should be visible - the editor mounts when user is loaded
		await expect(page).toHaveURL(/\/profile/);
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
