import type { Page } from '@playwright/test';
import { expect, skipIfIntegration, test } from './utils/fixtures';

async function serveInfo(page: Page, reply: { status: number; body?: unknown }) {
	await page.route('**/v2/info', async (route) => {
		if (reply.status >= 500) return route.fulfill({ status: reply.status, body: 'upstream error' });
		await route.fulfill({
			status: reply.status,
			contentType: 'application/json',
			body: JSON.stringify(reply.body ?? {})
		});
	});
}

async function serveCloudDown(page: Page) {
	// the cloud ping is a bare GET at the mock cloud origin root
	await page.route('http://127.0.0.1:9898/', (route) =>
		route.fulfill({ status: 503, body: 'unavailable' })
	);
}

test.describe('backend preflight', () => {
	test.beforeEach(() => skipIfIntegration());

	test('a healthy backend renders the page and shows no gate', async ({ page, asAnonymous }) => {
		void asAnonymous;
		await page.goto('/');

		await expect(page.locator('#backend-gate')).toHaveCount(0);
		await expect(page.locator('#navbar-backend-state')).toHaveCount(0);
		await expect(page.locator('#cloud-degraded-banner')).toHaveCount(0);
	});

	test('maintenance blocks the page and names itself', async ({ page, asAnonymous }) => {
		void asAnonymous;
		await serveInfo(page, { status: 200, body: { status: 'maintenance' } });
		await page.goto('/');

		const gate = page.locator('#backend-gate');
		await expect(gate).toBeVisible();
		await expect(gate).toContainText('Under Maintenance');

		// maintenance is planned, so it offers status but not a support escalation
		await expect(gate.getByRole('link', { name: 'Check Status' })).toBeVisible();
		await expect(gate.getByRole('link', { name: 'Contact Support' })).toHaveCount(0);

		await expect(page.locator('#navbar-backend-state')).toContainText('Under Maintenance');
	});

	test('a 5xx blocks the page and offers status and support', async ({ page, asAnonymous }) => {
		void asAnonymous;
		await serveInfo(page, { status: 503 });
		await page.goto('/');

		const gate = page.locator('#backend-gate');
		await expect(gate).toBeVisible();
		await expect(gate).toContainText("We Can't Reach The Earth App");

		const status = gate.getByRole('link', { name: 'Check Status' });
		const support = gate.getByRole('link', { name: 'Contact Support' });
		await expect(status).toHaveAttribute('href', 'https://status.earth-app.com');
		await expect(support).toHaveAttribute('href', 'https://support.earth-app.com');

		await expect(page.locator('#navbar-backend-state')).toContainText('Service Outage');
	});

	// the fail-open policy: an ambiguous answer must never blank the app
	test('a 404 on the preflight does not block the app', async ({ page, asAnonymous }) => {
		void asAnonymous;
		await serveInfo(page, { status: 404 });
		await page.goto('/');

		await expect(page.locator('#backend-gate')).toHaveCount(0);
	});

	test('an unrecognised status does not block the app', async ({ page, asAnonymous }) => {
		void asAnonymous;
		await serveInfo(page, { status: 200, body: { status: 'degraded' } });
		await page.goto('/');

		await expect(page.locator('#backend-gate')).toHaveCount(0);
	});

	test('recovering clears the gate without a reload', async ({ page, asAnonymous }) => {
		void asAnonymous;
		await serveInfo(page, { status: 503 });
		await page.goto('/');
		await expect(page.locator('#backend-gate')).toBeVisible();

		await serveInfo(page, { status: 200, body: { status: 'active' } });
		await page.getByRole('button', { name: 'Try Again' }).click();

		await expect(page.locator('#backend-gate')).toHaveCount(0);
		await expect(page.locator('#navbar-backend-state')).toHaveCount(0);
	});
});

test.describe('cloud degradation', () => {
	test.beforeEach(() => skipIfIntegration());

	test('a cloud outage warns but never blocks', async ({ page, asAnonymous }) => {
		void asAnonymous;
		await serveCloudDown(page);
		await page.goto('/');

		const banner = page.locator('#cloud-degraded-banner');
		await expect(banner).toBeVisible();
		await expect(banner).toContainText('Some Features Are Unavailable');

		// the whole point of separating the two: cloud is optional, so the page still works
		await expect(page.locator('#backend-gate')).toHaveCount(0);
		await expect(page.locator('#main-content')).toBeVisible();
	});

	test('the banner can be dismissed for the session', async ({ page, asAnonymous }) => {
		void asAnonymous;
		await serveCloudDown(page);
		await page.goto('/');

		const banner = page.locator('#cloud-degraded-banner');
		await expect(banner).toBeVisible();

		await banner.getByRole('button', { name: 'Dismiss' }).click();
		await expect(banner).toHaveCount(0);
	});
});
