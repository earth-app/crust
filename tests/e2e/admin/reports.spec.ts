import type { Page } from '@playwright/test';

import { expect, skipIfIntegration, test } from '../utils/fixtures';

async function openReports(page: Page) {
	const tab = page.getByRole('tab', { name: /^Reports$/i });
	await tab.waitFor({ timeout: 15_000 });
	await tab.click();
	await expect(page.getByRole('heading', { name: /Content Reports/i })).toBeVisible({
		timeout: 10_000
	});
}

test.describe('Admin Reports tab', () => {
	test('lists pending reports with reason + AI badges', async ({ asAdmin, page, gotoHydrated }) => {
		skipIfIntegration('reports are mock-only');
		await asAdmin();
		await gotoHydrated('/admin');
		await openReports(page);

		// two seeded pending reports: one spam, one AI-sourced hate_speech
		await expect(page.getByText(/Spam or scam/i).first()).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText(/Hate speech/i).first()).toBeVisible();
		await expect(page.getByText(/^AI$/).first()).toBeVisible();
		// the spam report carries a report_count of 3
		await expect(page.getByText(/3 reports/i).first()).toBeVisible();
	});

	test('switching status filter refetches with the new status', async ({
		asAdmin,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('reports are mock-only');
		await asAdmin();
		await gotoHydrated('/admin');
		await openReports(page);

		const [resp] = await Promise.all([
			page.waitForResponse((r) => /\/v2\/reports\?status=dismissed/.test(r.url())),
			(async () => {
				await page.getByRole('combobox').first().click();
				await page.getByRole('option', { name: /^Dismissed$/i }).click();
			})()
		]);
		expect(resp.url()).toMatch(/status=dismissed/);
		// dismissed set is empty in the mock -> empty-state copy
		await expect(page.getByText(/No dismissed reports/i)).toBeVisible({ timeout: 10_000 });
	});
});
