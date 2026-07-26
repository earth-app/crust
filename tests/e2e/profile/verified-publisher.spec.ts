import { expect, skipIfIntegration, test } from '../utils/fixtures';

test.describe('verified publisher application', () => {
	test('is hidden for a non-organizer', async ({ asUser, page, gotoHydrated }) => {
		skipIfIntegration('verified publisher is mock-only');
		await asUser({ account: { account_type: 'FREE' } });
		await gotoHydrated('/profile');

		await expect(page.locator('#verified-publisher')).toHaveCount(0);
	});

	test('shows the application form to an organizer', async ({ asUser, page, gotoHydrated }) => {
		skipIfIntegration('verified publisher is mock-only');
		await asUser({ account: { account_type: 'ORGANIZER' } });
		await gotoHydrated('/profile');

		const section = page.locator('#verified-publisher');
		await expect(section).toBeVisible({ timeout: 15_000 });
		await expect(section.getByRole('button', { name: /Apply for Verification/i })).toBeVisible();
	});

	test('blocks submission client-side when the reason is too short', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('verified publisher is mock-only');
		await asUser({ account: { account_type: 'ORGANIZER' } });
		await gotoHydrated('/profile');

		const section = page.locator('#verified-publisher');
		await expect(section).toBeVisible({ timeout: 15_000 });

		const requests: string[] = [];
		page.on('request', (req) => {
			if (req.url().includes('/verified_publisher') && req.method() === 'POST') {
				requests.push(req.url());
			}
		});

		await section.getByRole('textbox').nth(2).fill('too short');
		await section.getByRole('checkbox').click();
		await section.getByRole('button', { name: /Apply for Verification/i }).click();

		await expect(section.getByText(/at least 40 characters/i)).toBeVisible({ timeout: 10_000 });
		expect(requests).toHaveLength(0);
	});

	test('submits a valid application and flips to under review', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('verified publisher is mock-only');
		await asUser({ account: { account_type: 'ORGANIZER' } });
		await gotoHydrated('/profile');

		const section = page.locator('#verified-publisher');
		await expect(section).toBeVisible({ timeout: 15_000 });

		await section
			.getByRole('textbox')
			.nth(2)
			.fill('We organize weekly trail runs for a 400 member community across the bay area.');
		await section.getByRole('textbox').nth(3).fill('trail running, bouldering');
		await section.getByRole('checkbox').click();

		const response = page.waitForResponse(
			(res) =>
				res.url().includes('/v2/users/current/verified_publisher') &&
				res.request().method() === 'POST'
		);
		await section.getByRole('button', { name: /Apply for Verification/i }).click();
		await response;

		await expect(page.getByText(/Application Submitted/i).last()).toBeVisible({ timeout: 10_000 });
		await expect(section.getByText(/Under Review/i)).toBeVisible();
	});

	test('shows the submit button once approved', async ({ asUser, page, gotoHydrated, mockApi }) => {
		skipIfIntegration('verified publisher is mock-only');
		await asUser({ account: { account_type: 'ORGANIZER' } });
		await mockApi.set({
			method: 'GET',
			path: '/v2/users/current/verified_publisher',
			body: {
				state: 'approved',
				verified: true,
				reviewed_at: '2026-05-21T12:00:00.000Z'
			}
		});
		await gotoHydrated('/profile');

		const section = page.locator('#verified-publisher');
		await expect(section.getByText(/Verified Publisher/i).first()).toBeVisible({
			timeout: 15_000
		});
		await expect(section.getByRole('button', { name: /Submit an Activity/i })).toBeVisible();
	});

	test('disables re-applying until the cooldown passes', async ({
		asUser,
		page,
		gotoHydrated,
		mockApi
	}) => {
		skipIfIntegration('verified publisher is mock-only');
		await asUser({ account: { account_type: 'ORGANIZER' } });
		await mockApi.set({
			method: 'GET',
			path: '/v2/users/current/verified_publisher',
			body: {
				state: 'denied',
				verified: false,
				notes: 'Please add more detail about your community.',
				can_reapply_at: new Date(Date.now() + 30 * 86400_000).toISOString()
			}
		});
		await gotoHydrated('/profile');

		const section = page.locator('#verified-publisher');
		await expect(section.getByText(/Please add more detail/i)).toBeVisible({ timeout: 15_000 });
		await expect(section.getByRole('button', { name: /Apply Again/i })).toBeDisabled();
	});
});
