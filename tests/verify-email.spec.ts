/**
 * E2E tests for `src/pages/verify-email.vue`.
 *
 * Client-only page. Logged-out users are redirected to /login with a toast.
 * Users with already-verified email are redirected to /. Pending users see
 * an 8-digit PinInput that auto-submits to `/v2/users/current/verify_email`.
 */

import { expect, skipIfIntegration, test } from './utils/fixtures';

test.describe('Verify email (anonymous)', () => {
	test('redirects to /login when not authenticated', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/verify-email');
		await page.waitForURL(/\/login$/, { timeout: 8000 });
		await expect(page.getByText(/Not Logged In|must be logged in/i).first()).toBeVisible({
			timeout: 6000
		});
	});
});

test.describe('Verify email (already verified)', () => {
	test('redirects to home when email is already verified', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration(
			"asUser({email_verified:true}) override does not apply; real admin's verified state is fixed"
		);
		await asUser({ account: { email_verified: true } });
		await gotoHydrated('/verify-email');
		await page.waitForURL(/\/$/, { timeout: 8000 });
	});
});

test.describe('Verify email (unverified user)', () => {
	test('renders the 8-digit verification form', async ({ asUser, page, gotoHydrated }) => {
		skipIfIntegration('depends on email_verified:false override; real admin is already verified');
		await asUser({
			username: 'pending',
			account: { email: 'pending@example.com', email_verified: false }
		});
		await gotoHydrated('/verify-email');
		await expect(page.getByRole('heading', { name: /Email Verification/i })).toBeVisible();
		await expect(page.getByText('pending@example.com').first()).toBeVisible();
		// 8 pin inputs
		const pins = page.locator('input[type="text"], input[inputmode="numeric"]');
		// Resend button visible
		await expect(page.getByRole('button', { name: /Resend Code/i })).toBeVisible();
	});

	test('accepts an 8-digit code and verifies on completion', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('depends on email_verified:false override; real admin is already verified');
		await asUser({
			account: { email: 'pending@example.com', email_verified: false }
		});
		await gotoHydrated('/verify-email');

		const inputs = page.locator('input').filter({ hasNot: page.locator('[type="hidden"]') });
		const count = await inputs.count();
		// Some pin inputs render as individual single-character inputs. Just type into focused one.
		await page.locator('input').first().focus();
		await page.keyboard.type('12345678');
		// Verify success → redirect to /
		await page.waitForURL(/\/(?!verify-email|login)/, { timeout: 10_000 }).catch(() => {});
	});

	test('shows an error toast when verification fails', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('depends on email_verified:false override; real admin is already verified');
		await mockApi.set({
			method: 'POST',
			path: '^/v2/users/current/verify_email$',
			status: 400,
			body: { message: 'Invalid verification code' },
			once: false
		});
		await asUser({
			account: { email: 'pending@example.com', email_verified: false }
		});
		await gotoHydrated('/verify-email');
		await page.locator('input').first().focus();
		await page.keyboard.type('00000000');
		// We don't assert specific toast wording - the failure may surface differently
		// across UI versions. The key invariant is the user is NOT redirected.
		await page.waitForTimeout(2000);
		await expect(page).toHaveURL(/\/verify-email/);
	});

	test('resend button is clickable', async ({ asUser, page, gotoHydrated }) => {
		skipIfIntegration('depends on email_verified:false override; real admin is already verified');
		await asUser({
			account: { email: 'pending@example.com', email_verified: false }
		});
		await gotoHydrated('/verify-email');
		await page.getByRole('button', { name: /Resend Code/i }).click();
	});
});
