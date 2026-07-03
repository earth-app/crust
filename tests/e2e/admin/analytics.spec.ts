import { expect, skipIfIntegration, test } from '../utils/fixtures';

test.describe('Admin Analytics tab', () => {
	test('renders the funnel and traffic breakdowns from the snapshot', async ({
		asAdmin,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('analytics snapshot is mock-only');
		await asAdmin();
		await gotoHydrated('/admin');

		// analytics is the default tab
		await expect(page.getByRole('heading', { name: /Traffic & Engagement/i })).toBeVisible({
			timeout: 15_000
		});
		await expect(page.getByRole('heading', { name: /Signup Funnel/i })).toBeVisible();
		// the mock funnel is 250 signups against 1000 views
		await expect(page.getByText(/^25\.0% conversion$/)).toBeVisible({ timeout: 10_000 });
		await expect(page.getByRole('heading', { name: /Top Paths/i })).toBeVisible();
		await expect(page.getByRole('heading', { name: /Top Countries/i })).toBeVisible();
		await expect(page.getByText(/United States/i).first()).toBeVisible({ timeout: 10_000 });
	});

	test('range select refetches analytics with a new window', async ({
		asAdmin,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('analytics snapshot is mock-only');
		await asAdmin();
		await gotoHydrated('/admin');
		await expect(page.getByRole('heading', { name: /Traffic & Engagement/i })).toBeVisible({
			timeout: 15_000
		});

		// changing the range triggers a fresh analytics request carrying since/until
		const [resp] = await Promise.all([
			page.waitForResponse((r) => /\/v2\/admin\/analytics.*since=/.test(r.url())),
			(async () => {
				await page.getByRole('combobox').first().click();
				await page.getByRole('option', { name: /Last 7d/i }).click();
			})()
		]);
		expect(resp.url()).toMatch(/since=/);
		expect(resp.url()).toMatch(/until=/);
	});
});
