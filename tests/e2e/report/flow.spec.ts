import { REPORT_REASONS } from '../../../src/shared/types/report';
import { expect, skipIfIntegration, test } from '../utils/fixtures';

async function openReportModal(page: any) {
	// the kebab lives on the first prompt card
	const kebab = page.getByRole('button', { name: /Open content actions/i }).first();
	await expect(kebab).toBeVisible({ timeout: 20_000 });
	await kebab.click();
	await page.getByRole('menuitem', { name: /^Report$/i }).click();
	await expect(page.getByText(/Report Content/i).first()).toBeVisible({ timeout: 8_000 });
}

test.describe('Report flow', () => {
	test('modal exposes all nine reason options', async ({ asUser, page, gotoHydrated }) => {
		skipIfIntegration('reports are mock-only');
		await asUser();
		await gotoHydrated('/prompts');
		await openReportModal(page);

		// open the reason select and assert every reason label is present
		await page.getByRole('combobox').click();
		for (const r of REPORT_REASONS) {
			await expect(page.getByRole('option', { name: r.label })).toBeVisible({ timeout: 8_000 });
		}
		expect(REPORT_REASONS.length).toBe(9);
	});

	test('submitting a report POSTs and toasts success', async ({ asUser, page, gotoHydrated }) => {
		skipIfIntegration('reports are mock-only');
		await asUser();
		await gotoHydrated('/prompts');
		await openReportModal(page);

		await page.getByRole('combobox').click();
		await page.getByRole('option', { name: /Spam or scam/i }).click();

		const [resp] = await Promise.all([
			page.waitForResponse(
				(r) => /\/v2\/reports$/.test(r.url()) && r.request().method() === 'POST'
			),
			page.getByRole('button', { name: /Submit Report/i }).click()
		]);
		expect(resp.status()).toBe(200);
		await expect(page.getByText(/Report Submitted/i).first()).toBeVisible({ timeout: 8_000 });
	});

	test('dedup response still toasts success', async ({ asUser, mockApi, page, gotoHydrated }) => {
		skipIfIntegration('reports are mock-only');
		// server reports this as a duplicate; the UI treats it as success either way
		await mockApi.set({
			method: 'POST',
			path: '^/v2/reports$',
			body: {
				report: { id: 'rpt-dupe', reason: 'spam', status: 'pending', report_count: 2 },
				deduped: true
			},
			once: false
		});
		await asUser();
		await gotoHydrated('/prompts');
		await openReportModal(page);

		await page.getByRole('combobox').click();
		await page.getByRole('option', { name: /Harassment or bullying/i }).click();
		await page.getByRole('button', { name: /Submit Report/i }).click();

		await expect(page.getByText(/Report Submitted/i).first()).toBeVisible({ timeout: 8_000 });
	});

	test('anonymous users can submit a report', async ({ asAnonymous, page, gotoHydrated }) => {
		skipIfIntegration('reports are mock-only');
		await asAnonymous();
		await gotoHydrated('/prompts');
		await openReportModal(page);

		await page.getByRole('combobox').click();
		await page.getByRole('option', { name: /^Other$/i }).click();

		const [resp] = await Promise.all([
			page.waitForResponse(
				(r) => /\/v2\/reports$/.test(r.url()) && r.request().method() === 'POST'
			),
			page.getByRole('button', { name: /Submit Report/i }).click()
		]);
		expect(resp.status()).toBe(200);
		await expect(page.getByText(/Report Submitted/i).first()).toBeVisible({ timeout: 8_000 });
	});
});
