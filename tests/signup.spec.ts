/**
 * E2E tests for `src/pages/signup.vue`.
 */

import { expect, test } from './utils/fixtures';

test.describe('Signup page (anonymous)', () => {
	test.beforeEach(async ({ asAnonymous }) => {
		await asAnonymous();
	});

	test('renders the heading and the signup form', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/signup');
		await expect(page.getByRole('heading', { name: 'Sign Up' })).toBeVisible();
		await expect(page.getByPlaceholder('Username')).toBeVisible();
		await expect(page.getByPlaceholder('Password')).toBeVisible();
		await expect(page.getByPlaceholder('me@example.com')).toBeVisible();
		await expect(page.getByPlaceholder('John Doe')).toBeVisible();
	});

	test('username field is required (form blocks submit on empty)', async ({
		page,
		gotoHydrated
	}) => {
		await gotoHydrated('/signup');
		const submitBtn = page.locator('form button[type="submit"]').first();
		await submitBtn.click({ force: true }).catch(() => {});
		await expect(page).toHaveURL(/\/signup/);
	});

	test('shows validation error when password is too short', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/signup');
		await page.getByPlaceholder('Username').fill('newuser');
		await page.getByPlaceholder('Password').fill('123');
		const submitBtn = page.locator('form button[type="submit"]').first();
		await submitBtn.click({ force: true }).catch(() => {});
		await expect(page.getByText(/at least 8 characters/i).first()).toBeVisible({ timeout: 5000 });
	});

	test('shows validation error for invalid username characters', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/signup');
		await page.getByPlaceholder('Username').fill('user@name!');
		await page.getByPlaceholder('Password').fill('validpassword123');
		const submitBtn = page.locator('form button[type="submit"]').first();
		await submitBtn.click({ force: true }).catch(() => {});
		await expect(
			page.getByText(/Only alphanumeric|alphanumeric characters|invalid characters/i).first()
		).toBeVisible({ timeout: 5000 });
	});

	test('shows error toast for ?error=no_code', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/signup?error=no_code');
		await expect(page.getByText(/No authorization code/i).first()).toBeVisible({ timeout: 6000 });
	});

	test('shows error toast for ?error=auth_failed', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/signup?error=auth_failed');
		await expect(page.getByText(/Authentication failed/i).first()).toBeVisible({ timeout: 6000 });
	});

	test('shows error toast for ?error=invalid_provider', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/signup?error=invalid_provider');
		await expect(page.getByText(/Invalid OAuth provider/i).first()).toBeVisible({ timeout: 6000 });
	});
});

test.describe('Signup page (already logged in)', () => {
	test('redirects to home when an existing user visits /signup', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		await asUser({
			username: 'oldaccount',
			created_at: '2025-01-01T00:00:00Z'
		});
		await gotoHydrated('/signup');
		await page.waitForURL(/127\.0\.0\.1:3000\/$/, { timeout: 8000 });
	});
});
