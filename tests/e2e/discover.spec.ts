import type { Locator, Page } from '@playwright/test';
import { expect, skipIfIntegration, test } from './utils/fixtures';

async function openPalette(page: Page): Promise<Locator> {
	await page.getByRole('button', { name: 'Discover', exact: true }).click();
	const dialog = page.getByRole('dialog').first();
	await expect(dialog.locator('input').first()).toBeVisible();
	return dialog;
}

test.describe('Discover palette', () => {
	test.beforeEach(async ({ asAnonymous }) => {
		await asAnonymous();
	});

	test('activity search asks mantle2 to match aliases', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/');
		const dialog = await openPalette(page);

		const activitySearch = page.waitForRequest(
			(req) => req.url().includes('/v2/activities?') && req.url().includes('search=jogging')
		);
		await dialog.locator('input').first().fill('jogging');

		expect((await activitySearch).url()).toContain('include_aliases=true');
	});

	test('surfaces an activity that only matches on an alias', async ({ page, gotoHydrated }) => {
		skipIfIntegration('needs the seeded act-1 "jogging" alias');

		await gotoHydrated('/');
		const dialog = await openPalette(page);
		await dialog.locator('input').first().fill('jogging');

		await expect(dialog.getByText('Sample Activity 1', { exact: true })).toBeVisible();
	});
});
