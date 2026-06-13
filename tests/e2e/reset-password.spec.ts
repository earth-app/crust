/**
 * E2E tests for the full password-reset flow:
 *
 * 1. /login → "Forgot password?" link opens the request-reset modal and POSTs
 *    to /v2/users/reset_password?email=… (mantle2 returns 204 regardless).
 * 2. /reset-password?uid=…&token=… renders the new-password form, posts to
 *    /v2/users/{id}/change_password?token=…, and redirects to /login on
 *    success. Missing uid/token shows the dead-end UI.
 */

import { expect, skipIfIntegration, test } from './utils/fixtures';

test.describe('Forgot-password request modal', () => {
	test('login form exposes the Forgot password? trigger', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/login');
		await expect(page.getByRole('button', { name: /forgot your password/i })).toBeVisible({
			timeout: 8000
		});
	});

	test('opening the modal reveals the email input and Send button', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/login');
		await page.getByRole('button', { name: /forgot your password/i }).click();
		await expect(page.getByRole('dialog')).toBeVisible({ timeout: 4000 });
		await expect(page.getByText(/reset your password/i).first()).toBeVisible();
		await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
		await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();
	});

	test('successful request shows the generic "check your email" toast', async ({
		asAnonymous,
		mockApi,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		// mantle2 returns 204 for both real and non-existent emails to avoid enumeration
		await mockApi.set({
			method: 'POST',
			path: '^/v2/users/reset_password.*$',
			status: 204,
			body: '',
			once: false
		});
		await gotoHydrated('/login');
		await page.getByRole('button', { name: /forgot your password/i }).click();
		await page.getByPlaceholder('you@example.com').fill('returning@example.com');
		await page.getByRole('button', { name: /send reset link/i }).click();
		await expect(page.getByText(/check your email/i).first()).toBeVisible({ timeout: 6000 });
	});

	test('rate-limited request surfaces an inline error toast', async ({
		asAnonymous,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration(
			'depends on a mock 429 override; real mantle does not rate-limit a single request'
		);
		await asAnonymous();
		await mockApi.set({
			method: 'POST',
			path: '^/v2/users/reset_password.*$',
			status: 429,
			body: {
				error: 'Rate limit exceeded',
				message: 'Please wait 60 seconds before requesting another password reset.',
				retry_after: 60
			}
		});
		await gotoHydrated('/login');
		await page.getByRole('button', { name: /forgot your password/i }).click();
		await page.getByPlaceholder('you@example.com').fill('rate-limited@example.com');
		await page.getByRole('button', { name: /send reset link/i }).click();
		await expect(page.getByText(/couldn't send reset link/i).first()).toBeVisible({
			timeout: 6000
		});
	});
});

test.describe('Reset-password landing page', () => {
	test('shows the invalid-link UI when uid+token are missing', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/reset-password');
		await expect(page.locator('#reset-invalid-link')).toBeVisible({ timeout: 8000 });
		await expect(page.getByRole('link', { name: /back to login/i })).toBeVisible();
	});

	test('shows the invalid-link UI when only one of uid/token is present', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/reset-password?uid=user-1');
		await expect(page.locator('#reset-invalid-link')).toBeVisible({ timeout: 8000 });
	});

	test('renders the form when both uid and token are present', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/reset-password?uid=user-1&token=abc123');
		await expect(page.locator('#reset-password-form')).toBeVisible({ timeout: 8000 });
		await expect(page.getByPlaceholder('Enter your new password')).toBeVisible();
		await expect(page.getByPlaceholder('Type the new password again')).toBeVisible();
		await expect(page.getByRole('button', { name: /reset password/i })).toBeVisible();
	});

	test('mismatched passwords surface the inline field error', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/reset-password?uid=user-1&token=abc123');
		await page.getByPlaceholder('Enter your new password').fill('correcthorse9!');
		await page.getByPlaceholder('Type the new password again').fill('different8!');
		await page.getByRole('button', { name: /reset password/i }).click();
		await expect(page.getByText(/passwords don't match/i).first()).toBeVisible({ timeout: 4000 });
	});

	test('expired-token response shows the "request a new link" affordance', async ({
		asAnonymous,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration(
			'depends on a mock 400 against a synthetic uid; real mantle has no such user/token'
		);
		await asAnonymous();
		await mockApi.set({
			method: 'POST',
			path: '^/v2/users/user-1/change_password.*$',
			status: 400,
			body: { message: 'Invalid or expired token' }
		});
		await gotoHydrated('/reset-password?uid=user-1&token=expired');
		await page.getByPlaceholder('Enter your new password').fill('correcthorse9!');
		await page.getByPlaceholder('Type the new password again').fill('correcthorse9!');
		await page.getByRole('button', { name: /reset password/i }).click();
		await expect(page.getByText(/reset link expired/i).first()).toBeVisible({ timeout: 6000 });
	});

	test('successful reset shows the success state and redirects to /login', async ({
		asAnonymous,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration(
			'depends on a mock 200 against a synthetic uid; real mantle has no such user/token'
		);
		await asAnonymous();
		await mockApi.set({
			method: 'POST',
			path: '^/v2/users/user-1/change_password.*$',
			status: 200,
			body: { message: 'Password changed successfully' }
		});
		await gotoHydrated('/reset-password?uid=user-1&token=valid');
		await page.getByPlaceholder('Enter your new password').fill('correcthorse9!');
		await page.getByPlaceholder('Type the new password again').fill('correcthorse9!');
		await page.getByRole('button', { name: /reset password/i }).click();
		await expect(page.locator('#reset-success')).toBeVisible({ timeout: 6000 });
		await page.waitForURL(/\/login(\?|$|#)/, { timeout: 6000 });
	});
});
