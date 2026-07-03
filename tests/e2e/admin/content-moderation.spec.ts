import type { Page } from '@playwright/test';

import { expect, skipIfIntegration, test } from '../utils/fixtures';

async function openReports(page: Page) {
	const tab = page.getByRole('tab', { name: /^Reports$/i });
	await tab.waitFor({ timeout: 15_000 });
	await tab.click();
	await expect(page.getByRole('heading', { name: /Content Reports/i })).toBeVisible({
		timeout: 10_000
	});
	// wait for the seeded rows to load
	await expect(page.getByRole('button', { name: /^Dismiss$/i }).first()).toBeVisible({
		timeout: 10_000
	});
}

test.describe('Admin content moderation actions', () => {
	test('dismiss resolves a report and toasts', async ({ asAdmin, page, gotoHydrated }) => {
		skipIfIntegration('reports are mock-only');
		await asAdmin();
		await gotoHydrated('/admin');
		await openReports(page);

		// the moderation actions gate behind a window.confirm
		page.on('dialog', (d) => d.accept());

		const [resp] = await Promise.all([
			page.waitForResponse(
				(r) => /\/v2\/reports\/[^/]+$/.test(r.url()) && r.request().method() === 'PATCH'
			),
			page
				.getByRole('button', { name: /^Dismiss$/i })
				.first()
				.click()
		]);
		expect(resp.status()).toBe(200);
		await expect(page.getByText(/Report Dismissed/i).first()).toBeVisible({ timeout: 8_000 });
	});

	test('ban user surfaces the permanent-ban enforcement', async ({
		asAdmin,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('reports are mock-only');
		await asAdmin();
		await gotoHydrated('/admin');
		await openReports(page);

		page.on('dialog', (d) => d.accept());

		const [resp] = await Promise.all([
			page.waitForResponse(
				(r) => /\/v2\/reports\/[^/]+$/.test(r.url()) && r.request().method() === 'PATCH'
			),
			page
				.getByRole('button', { name: /Ban User/i })
				.first()
				.click()
		]);
		expect(resp.status()).toBe(200);
		await expect(page.getByText(/User Banned/i).first()).toBeVisible({ timeout: 8_000 });
		// mock maps ban_user -> permanent_ban enforcement in the toast description
		await expect(page.getByText(/permanent ban/i).first()).toBeVisible({ timeout: 8_000 });
	});
});
