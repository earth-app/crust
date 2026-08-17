import type { Page } from '@playwright/test';

import { expect, skipIfIntegration, test } from '../utils/fixtures';
import type { MockClient } from '../utils/mock-client';
import { makeActivity, makeStagedActivity } from '../utils/mock-data';

async function openApprovals(page: Page) {
	const tab = page.getByRole('tab', { name: /^Approvals$/i });
	await tab.waitFor({ timeout: 15_000 });
	await tab.click();
	await expect(page.getByRole('heading', { name: /Approvals/i })).toBeVisible({
		timeout: 10_000
	});
}

// the bulk toolbar sits above the rows, so row actions are always scoped to their row
function firstStagedRow(page: Page) {
	return page.locator('[data-testid="staged-row"]').first();
}

function bulkBar(page: Page, position: 'top' | 'bottom' | 'floating') {
	return page.locator(`[data-testid="bulk-bar"][data-position="${position}"]`);
}

function staged(id: number, name: string, activity: Record<string, any> = {}) {
	return makeStagedActivity({
		id,
		activity: makeActivity({
			id: name.toLowerCase().replace(/\s+/g, '_'),
			name,
			description: 'A perfectly ordinary outdoor activity people do for fun.',
			types: ['HOBBY'],
			...activity
		})
	});
}

/**
 * Queues one staged-list response per page. The mock stack is LIFO, so page one is
 * registered last to land at the front.
 */
async function seedPages(mockApi: MockClient, pages: any[][], total: number) {
	for (const items of [...pages].reverse()) {
		await mockApi.set({
			method: 'GET',
			path: /^\/v2\/activities\/staged$/,
			body: { items, page: 1, limit: 50, total },
			once: true
		});
	}
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

	// nothing publishes unreviewed any more, so every pending chip must say auto-denies
	test('renders every pending deadline as an auto-deny', async ({
		asAdmin,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('approvals are mock-only');
		await asAdmin();
		await gotoHydrated('/admin');
		await openApprovals(page);

		await expect(page.getByText(/Auto-denies/i).first()).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText(/Auto-publishes/i)).toHaveCount(0);
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
		await firstStagedRow(page)
			.getByRole('button', { name: /^Approve$/ })
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
		await firstStagedRow(page)
			.getByRole('button', { name: /^Deny$/ })
			.click();
		await request;

		await expect(page.getByText(/Submission Denied/i).last()).toBeVisible({ timeout: 10_000 });
	});

	// the row action and the bulk action must never share an accessible name
	test('keeps the bulk toolbar distinct from the per-row actions', async ({
		asAdmin,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('approvals are mock-only');
		await asAdmin();
		await gotoHydrated('/admin');
		await openApprovals(page);

		await expect(firstStagedRow(page).getByRole('button', { name: /^Approve$/ })).toBeEnabled({
			timeout: 10_000
		});
		await expect(page.getByRole('button', { name: /^Approve$/ })).toHaveCount(2);
		await expect(page.getByRole('button', { name: /^Approve Selected$/ })).toBeDisabled();
	});

	test('bulk approves every selected submission', async ({ asAdmin, page, gotoHydrated }) => {
		skipIfIntegration('approvals are mock-only');
		await asAdmin();
		await gotoHydrated('/admin');
		await openApprovals(page);

		const approvals: string[] = [];
		page.on('request', (req) => {
			if (/\/v2\/activities\/staged\/\d+\/approve/.test(req.url()) && req.method() === 'POST') {
				approvals.push(req.url());
			}
		});
		page.on('dialog', (dialog) => dialog.accept());

		await page.getByRole('checkbox', { name: /Select Page/i }).click();
		await expect(page.getByText(/2 of 2 Selected/i)).toBeVisible({ timeout: 10_000 });

		await page.getByRole('button', { name: /^Approve Selected \(2\)$/ }).click();

		await expect(page.getByText(/2 Activities Published/i).last()).toBeVisible({
			timeout: 15_000
		});
		expect(approvals).toHaveLength(2);
		await expect(page.getByText(/0 of 2 Selected/i)).toBeVisible();
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

	// a queue built one page at a time is the whole point; losing it on paging made the
	// bulk actions useless past the first 50 rows
	test('carries a selection from one page to the next', async ({
		asAdmin,
		page,
		gotoHydrated,
		mockApi
	}) => {
		skipIfIntegration('approvals are mock-only');
		await asAdmin();
		await seedPages(
			mockApi,
			[
				[staged(1, 'Bouldering'), staged(2, 'Sea Kayaking')],
				[staged(3, 'Trail Running'), staged(4, 'Sport Climbing')]
			],
			120
		);
		await gotoHydrated('/admin');
		await openApprovals(page);

		// the row also prints the activity id, so the name has to match exactly
		await expect(page.getByText('Bouldering', { exact: true })).toBeVisible({ timeout: 10_000 });
		await firstStagedRow(page).getByRole('checkbox').click();
		await expect(page.getByRole('button', { name: /^Approve Selected \(1\)$/ })).toBeVisible();

		await page.getByRole('button', { name: /^Next$/ }).click();
		await expect(page.getByText('Trail Running')).toBeVisible({ timeout: 10_000 });

		await expect(page.getByRole('button', { name: /^Approve Selected \(1\)$/ })).toBeVisible();
		await expect(page.getByText(/1 on Other Pages/i)).toBeVisible();

		await firstStagedRow(page).getByRole('checkbox').click();
		await expect(page.getByRole('button', { name: /^Approve Selected \(2\)$/ })).toBeVisible();

		const approvals: string[] = [];
		page.on('request', (req) => {
			const match = req.url().match(/\/v2\/activities\/staged\/(\d+)\/approve/);
			if (match && req.method() === 'POST') approvals.push(match[1]!);
		});
		page.on('dialog', (dialog) => dialog.accept());

		await page.getByRole('button', { name: /^Approve Selected \(2\)$/ }).click();
		await expect(page.getByText(/2 Activities Published/i).last()).toBeVisible({
			timeout: 15_000
		});
		expect(approvals.sort()).toEqual(['1', '3']);
	});

	test('keeps the bulk actions reachable down a long queue', async ({
		asAdmin,
		page,
		gotoHydrated,
		mockApi
	}) => {
		skipIfIntegration('approvals are mock-only');
		await asAdmin();
		const rows = Array.from({ length: 12 }, (_, index) =>
			staged(index + 1, `Staged Activity ${index + 1}`)
		);
		await seedPages(mockApi, [rows], rows.length);
		await gotoHydrated('/admin');
		await openApprovals(page);

		await expect(page.locator('[data-testid="staged-row"]')).toHaveCount(12, { timeout: 10_000 });
		await expect(bulkBar(page, 'bottom')).toBeAttached();
		await expect(bulkBar(page, 'floating')).toHaveCount(0);

		// park mid-list: the top toolbar is above the fold and the bottom one still below it
		await page.locator('[data-testid="staged-row"]').nth(6).scrollIntoViewIfNeeded();
		await expect(bulkBar(page, 'floating')).toBeVisible({ timeout: 10_000 });

		await page.evaluate(() => window.scrollTo({ top: 0 }));
		await expect(bulkBar(page, 'floating')).toHaveCount(0);
	});

	test('flags a submission that does not look real', async ({
		asAdmin,
		page,
		gotoHydrated,
		mockApi
	}) => {
		skipIfIntegration('approvals are mock-only');
		await asAdmin();
		await seedPages(
			mockApi,
			[
				[
					staged(1, 'Bouldering', {
						description: 'Cheap sessions, book now at https://spam.example or call 555-867-5309.'
					}),
					staged(2, 'Sea Kayaking', {
						description:
							'Paddling a sit-in kayak across open salt water. Trips follow the coast and turn back before the afternoon wind builds.',
						aliases: ['Ocean Kayaking'],
						types: ['HOBBY', 'SPORT']
					})
				]
			],
			2
		);
		await gotoHydrated('/admin');
		await openApprovals(page);

		const flags = page.locator('[data-testid="risk-flag"]');
		await expect(flags.first()).toHaveAttribute('data-tier', 'suspicious', { timeout: 10_000 });
		await expect(flags.first()).toHaveText(/Suspicious/);
		await expect(flags.nth(1)).toHaveAttribute('data-tier', /safe/);

		await firstStagedRow(page).getByRole('checkbox').click();
		await expect(page.locator('[data-testid="bulk-flagged"]')).toHaveText(/1 Flagged/);
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
