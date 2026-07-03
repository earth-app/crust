import { expect, skipIfIntegration, test } from '../utils/fixtures';

test.describe('Profile editor - field auto-save', () => {
	test('edits the bio inline and surfaces the "Profile Updated" toast', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('mutates the real admin account; relies on mock PATCH shallow-merge');
		await asUser();

		// echo the PATCH back as a 200 so updateUser() resolves success
		await mockApi.set({
			method: 'PATCH',
			path: '^/v2/users/current$',
			status: 200,
			body: { id: 'test-user-1', account: { bio: 'Living the test life' } },
			once: false
		});

		await gotoHydrated('/profile');

		// the bio EditableValue is the sibling right after the #bio heading
		const bioHeading = page.locator('#bio');
		await expect(bioHeading).toBeVisible({ timeout: 12_000 });

		// EditableValue swaps span->input inside its own root div. Match the div by
		// its current text BEFORE clicking; after the click the span text is gone
		// (replaced by the input), so grab the input by its seeded value instead of
		// re-filtering the now-edited parent (which would no longer match).
		const bioEditable = page
			.locator('div.cursor-pointer')
			.filter({ hasText: 'A test user' })
			.first();
		await bioEditable.click();

		const input = page.locator('input[type="text"]').filter({ hasNot: page.locator('[disabled]') });
		const bioInput = page.getByRole('textbox').filter({ hasText: '' }).first();
		await expect(bioInput).toBeVisible({ timeout: 8000 });
		await bioInput.fill('Living the test life');
		await bioInput.press('Enter');

		await expect(page.getByText(/Profile Updated/i).first()).toBeVisible({ timeout: 8000 });
		// the new value persists in the editor (optimistic local mutation)
		await expect(page.getByText('Living the test life').first()).toBeVisible();
	});

	test('changing account visibility surfaces the "Privacy Updated" toast', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('mutates the real admin account visibility');
		await asUser({ account: { visibility: 'PUBLIC' } });

		await mockApi.set({
			method: 'PATCH',
			path: '^/v2/users/current$',
			status: 200,
			body: { id: 'test-user-1', account: { visibility: 'PRIVATE' } },
			once: false
		});

		await gotoHydrated('/profile');

		// open the visibility dropdown (ClientOnly UDropdownMenu under #visibility)
		const visibilityButton = page
			.getByRole('button', { name: /Public|Select Visibility/i })
			.first();
		await expect(visibilityButton).toBeVisible({ timeout: 12_000 });
		await visibilityButton.click();

		// the custom #item slot renders each option as a <button> with the label;
		// pick a value other than the current one (PUBLIC)
		await page
			.getByRole('button', { name: /Private/i })
			.first()
			.click();

		await expect(page.getByText(/Privacy Updated/i).first()).toBeVisible({ timeout: 8000 });
	});
});

test.describe('Profile editor - email verification', () => {
	test('shows the Unverified badge and sends a verification email', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('depends on email_verified:false override; real admin is verified');
		await asUser({
			account: { email: 'pending@example.com', email_verified: false }
		});

		// return a body so the success toast (`res.data.message`) renders cleanly
		await mockApi.set({
			method: 'POST',
			path: '^/v2/users/current/send_email_verification$',
			status: 200,
			body: { message: 'A verification email has been sent.', email: 'pending@example.com' },
			once: false
		});

		await gotoHydrated('/profile');

		// exact match: the NavBar's "your email is unverified" banner would
		// otherwise win .first() and swallow the click (it is not the badge)
		const badge = page.getByText('Unverified', { exact: true }).first();
		await expect(badge).toBeVisible({ timeout: 12_000 });
		await badge.click();

		// the verify affordance both sends the email and opens the verification modal
		await expect(
			page.getByText(/Verification Email Sent|verification email has been sent/i).first()
		).toBeVisible({
			timeout: 8000
		});
		await expect(
			page.getByRole('heading', { name: /Verify Your Email|Email Verification/i }).first()
		).toBeVisible({
			timeout: 8000
		});
	});

	test('verifies a valid 8-digit code from the modal', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('depends on email_verified:false override; real admin is verified');
		await asUser({
			account: { email: 'pending@example.com', email_verified: false }
		});

		await mockApi.setMany([
			{
				method: 'POST',
				path: '^/v2/users/current/send_email_verification$',
				status: 200,
				body: { message: 'sent', email: 'pending@example.com' },
				once: false
			},
			{
				method: 'POST',
				path: '^/v2/users/current/verify_email$',
				status: 204,
				body: '',
				once: false
			}
		]);

		await gotoHydrated('/profile');

		await page.getByText('Unverified', { exact: true }).first().click();
		// wait for the modal pin input to render
		await expect(page.getByText(/8-digit verification code/i).first()).toBeVisible({
			timeout: 8000
		});

		await page.locator('input').first().focus();
		await page.keyboard.type('12345678');

		await expect(page.getByText(/Email Verified|successfully verified/i).first()).toBeVisible({
			timeout: 8000
		});
	});

	test('surfaces an error for an invalid verification code', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('depends on email_verified:false override; real admin is verified');
		await asUser({
			account: { email: 'pending@example.com', email_verified: false }
		});

		await mockApi.setMany([
			{
				method: 'POST',
				path: '^/v2/users/current/send_email_verification$',
				status: 200,
				body: { message: 'sent', email: 'pending@example.com' },
				once: false
			},
			{
				method: 'POST',
				path: '^/v2/users/current/verify_email$',
				status: 400,
				body: { message: 'Invalid verification code' },
				once: false
			}
		]);

		await gotoHydrated('/profile');

		await page.getByText('Unverified', { exact: true }).first().click();
		await expect(page.getByText(/8-digit verification code/i).first()).toBeVisible({
			timeout: 8000
		});

		await page.locator('input').first().focus();
		await page.keyboard.type('00000000');

		await expect(
			page.getByText(/Verification Failed|Invalid verification code/i).first()
		).toBeVisible({
			timeout: 8000
		});
	});
});

test.describe('Profile editor - password change', () => {
	test('opens the password change modal from the editor button', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		await asUser();
		await gotoHydrated('/profile');

		const trigger = page.locator('#password-change');
		await expect(trigger).toBeVisible({ timeout: 12_000 });
		await trigger.click();

		// modal renders the Change Password form with both password fields
		await expect(page.getByPlaceholder('Current Password')).toBeVisible({ timeout: 8000 });
		await expect(page.getByPlaceholder('New Password')).toBeVisible();
		await expect(page.getByRole('button', { name: /Change Password/i }).last()).toBeVisible();
	});

	test('fills the password fields in the modal form', async ({ asUser, page, gotoHydrated }) => {
		// NOTE: the submit button is gated behind a real Turnstile token
		// (PasswordChange.vue starts `disabled=true` until @verified). The
		// Turnstile challenge script (challenges.cloudflare.com) is network-blocked
		// in the test fixture, so no token ever arrives and the submit cannot fire
		// in e2e. We assert the fields accept input; the changePassword 204/401
		// branches are covered at the unit level.
		await asUser();
		await gotoHydrated('/profile');

		await page.locator('#password-change').click();

		const current = page.getByPlaceholder('Current Password');
		const next = page.getByPlaceholder('New Password');
		await expect(current).toBeVisible({ timeout: 8000 });
		await current.fill('oldpassword123');
		await next.fill('newpassword456');
		await expect(current).toHaveValue('oldpassword123');
		await expect(next).toHaveValue('newpassword456');
	});
});
