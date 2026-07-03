import type { Page } from '@playwright/test';

import { expect, skipIfIntegration, test } from '../utils/fixtures';

async function openBlacklist(page: Page) {
	const tab = page.getByRole('tab', { name: /^Blacklist$/i });
	await tab.waitFor({ timeout: 15_000 });
	await tab.click();
	await expect(page.getByRole('heading', { name: /Username & Email Blacklist/i })).toBeVisible({
		timeout: 10_000
	});
}

test.describe('Admin Blacklist tab', () => {
	test('lists seeded entries', async ({ asAdmin, page, gotoHydrated }) => {
		skipIfIntegration('blacklist is mock-only');
		await asAdmin();
		await gotoHydrated('/admin');
		await openBlacklist(page);
		await expect(page.getByText(/spammer/i).first()).toBeVisible({ timeout: 10_000 });
	});

	test('adds a new entry and it appears in the list', async ({
		asAdmin,
		page,
		gotoHydrated,
		testId
	}) => {
		skipIfIntegration('blacklist is mock-only');
		await asAdmin();
		await gotoHydrated('/admin');
		await openBlacklist(page);

		// unique value per test so parallel workers don't collide on shared mock state
		const value = `baduser-${testId.slice(0, 8)}`;
		await page.getByPlaceholder(/badname or evilcorp/i).fill(value);
		await page.getByPlaceholder(/Reason \(visible to other admins\)/i).fill('e2e add');

		const [resp] = await Promise.all([
			page.waitForResponse(
				(r) => /\/v2\/admin\/blacklist$/.test(r.url()) && r.request().method() === 'POST'
			),
			page.getByRole('button', { name: /Add to Blacklist/i }).click()
		]);
		expect(resp.status()).toBe(200);
		await expect(page.getByText(new RegExp(value, 'i')).first()).toBeVisible({ timeout: 10_000 });
	});

	test('removes an entry through the confirm modal', async ({
		asAdmin,
		page,
		gotoHydrated,
		testId
	}) => {
		skipIfIntegration('blacklist is mock-only');
		await asAdmin();
		await gotoHydrated('/admin');
		await openBlacklist(page);

		// add a unique entry first, then remove exactly that row
		const value = `rmuser-${testId.slice(0, 8)}`;
		await page.getByPlaceholder(/badname or evilcorp/i).fill(value);
		await page.getByRole('button', { name: /Add to Blacklist/i }).click();
		const row = page.getByText(new RegExp(value, 'i')).first();
		await expect(row).toBeVisible({ timeout: 10_000 });

		// the row's Remove button opens a confirm modal
		await page
			.locator('div', { has: page.getByText(new RegExp(value, 'i')) })
			.getByRole('button', { name: /Remove/i })
			.first()
			.click();
		await expect(page.getByText(/Remove from Blacklist\?/i)).toBeVisible({ timeout: 8_000 });

		const [resp] = await Promise.all([
			page.waitForResponse(
				(r) => /\/v2\/admin\/blacklist/.test(r.url()) && r.request().method() === 'DELETE'
			),
			page
				.getByRole('dialog')
				.getByRole('button', { name: /^Remove$/i })
				.click()
		]);
		expect([200, 204]).toContain(resp.status());
		await expect(page.getByText(new RegExp(value, 'i'))).toHaveCount(0, { timeout: 10_000 });
	});
});
