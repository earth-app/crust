import type { Page } from '@playwright/test';

import { expect, skipIfIntegration, test } from '../utils/fixtures';

async function openApprovals(page: Page) {
	const tab = page.getByRole('tab', { name: /^Approvals$/i });
	await tab.waitFor({ timeout: 15_000 });
	await tab.click();
	await expect(page.getByRole('heading', { name: /Approvals/i })).toBeVisible({
		timeout: 10_000
	});
}

test.describe('admin approvals', () => {
	test('shows both queues with their pending counts', async ({ asAdmin, page, gotoHydrated }) => {
		skipIfIntegration('approvals are mock-only');
		await asAdmin();
		await gotoHydrated('/admin');
		await openApprovals(page);

		await expect(page.getByRole('button', { name: /Staged Activities \(\d+\)/ })).toBeVisible();
		await expect(
			page.getByRole('button', { name: /Publisher Applications \(\d+\)/ })
		).toBeVisible();
	});

	test('distinguishes automated from organizer submissions', async ({
		asAdmin,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('approvals are mock-only');
		await asAdmin();
		await gotoHydrated('/admin');
		await openApprovals(page);

		await expect(page.getByText('Automated').first()).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText('Sea Kayaking')).toBeVisible();
	});

	// the two windows behave oppositely, so the chip must say which one applies
	test('renders auto-publishes and auto-denies distinctly', async ({
		asAdmin,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('approvals are mock-only');
		await asAdmin();
		await gotoHydrated('/admin');
		await openApprovals(page);

		await expect(page.getByText(/Auto-publishes/i).first()).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText(/Auto-denies/i).first()).toBeVisible();
	});

	test('approves a staged activity', async ({ asAdmin, page, gotoHydrated }) => {
		skipIfIntegration('approvals are mock-only');
		await asAdmin();
		await gotoHydrated('/admin');
		await openApprovals(page);

		page.on('dialog', (dialog) => dialog.accept());

		const request = page.waitForRequest(
			(req) => /\/v2\/activities\/staged\/\d+\/approve/.test(req.url()) && req.method() === 'POST'
		);
		await page
			.getByRole('button', { name: /^Approve$/ })
			.first()
			.click();
		await request;

		await expect(page.getByText(/Activity Published/i).last()).toBeVisible({ timeout: 10_000 });
	});

	test('denies a staged activity on its own path', async ({ asAdmin, page, gotoHydrated }) => {
		skipIfIntegration('approvals are mock-only');
		await asAdmin();
		await gotoHydrated('/admin');
		await openApprovals(page);

		page.on('dialog', (dialog) => dialog.accept());

		const request = page.waitForRequest(
			(req) => /\/v2\/activities\/staged\/\d+\/deny/.test(req.url()) && req.method() === 'POST'
		);
		await page
			.getByRole('button', { name: /^Deny$/ })
			.first()
			.click();
		await request;

		await expect(page.getByText(/Submission Denied/i).last()).toBeVisible({ timeout: 10_000 });
	});

	test('filters to a state with no rows and shows the empty state', async ({
		asAdmin,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('approvals are mock-only');
		await asAdmin();
		await gotoHydrated('/admin');
		await openApprovals(page);

		const response = page.waitForResponse((res) =>
			res.url().includes('/v2/activities/staged?state=denied')
		);
		await page.getByRole('combobox').first().click();
		await page.getByRole('listbox').getByRole('option', { name: 'Denied', exact: true }).click();
		await response;

		await expect(page.getByText(/No denied activities\./i)).toBeVisible({ timeout: 10_000 });
	});

	test('the staged editor hides catalog-only actions', async ({ asAdmin, page, gotoHydrated }) => {
		skipIfIntegration('approvals are mock-only');
		await asAdmin();
		await gotoHydrated('/admin');
		await openApprovals(page);

		await page
			.getByRole('button', { name: /Preview & Edit/i })
			.first()
			.click();

		await expect(page.getByRole('button', { name: /Approve with Edits/i })).toBeVisible({
			timeout: 10_000
		});
		await expect(page.getByRole('button', { name: /Delete Activity/i })).toHaveCount(0);
		await expect(page.getByRole('button', { name: /Generate Activity/i })).toHaveCount(0);
	});

	test('reviews a publisher application', async ({ asAdmin, page, gotoHydrated }) => {
		skipIfIntegration('approvals are mock-only');
		await asAdmin();
		await gotoHydrated('/admin');
		await openApprovals(page);

		await page.getByRole('button', { name: /Publisher Applications/ }).click();
		await expect(page.getByText('Trailhead Collective')).toBeVisible({ timeout: 10_000 });

		page.on('dialog', (dialog) => dialog.accept());
		const request = page.waitForRequest(
			(req) => /\/v2\/admin\/verified_publishers\//.test(req.url()) && req.method() === 'PATCH'
		);
		await page
			.getByRole('button', { name: /^Approve$/ })
			.first()
			.click();
		await request;

		await expect(page.getByText(/Publisher Verified/i).last()).toBeVisible({ timeout: 10_000 });
	});

	test('is not reachable for a non-admin', async ({ asUser, page, gotoHydrated }) => {
		skipIfIntegration('approvals are mock-only');
		await asUser();
		await gotoHydrated('/admin');

		await expect(page.getByText(/Access Denied/i)).toBeVisible({ timeout: 10_000 });
		await expect(page.getByRole('tab', { name: /^Approvals$/i })).toHaveCount(0);
	});
});
