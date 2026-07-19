import type { Page, Route } from '@playwright/test';
import { expect, test } from '../utils/fixtures';

async function referralCookie(page: Page) {
	const cookies = await page.context().cookies();
	return cookies.find((c) => c.name === 'referral_code')?.value ?? null;
}

async function stubTurnstile(page: Page) {
	await page.route(
		/^https?:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js.*/,
		(route: Route) =>
			route.fulfill({
				status: 200,
				contentType: 'text/javascript',
				body: `window.turnstile={render:function(el,opts){if(opts&&opts.callback)opts.callback('test-turnstile-token');return 'wid-1';},reset:function(){},remove:function(){}};`
			})
	);
}

async function guardLocalCreateOnly(page: Page) {
	await page.route('**/v2/users/create', async (route: Route) => {
		const host = new URL(route.request().url()).hostname;
		if (host === '127.0.0.1' || host === 'localhost') return route.continue();
		return route.abort('blockedbyclient');
	});
}

test.describe('Referral consumption - ?ref plugin', () => {
	test.beforeEach(async ({ asAnonymous, page }) => {
		await asAnonymous();
		await guardLocalCreateOnly(page);
	});

	test('a valid ?ref persists the cookie and fires the click ping', async ({ page, mockApi }) => {
		// capture the click ping proxied to mantle; persistent so plugin timing can't miss it
		await mockApi.set({
			backend: 'cloud',
			method: 'POST',
			path: '^/v1/users/referral/click$',
			status: 200,
			body: { ok: true },
			once: false
		});

		// the crust /api/user/referral/click server route is the browser-visible hop
		const clickPing = page.waitForRequest(
			(r) => r.url().includes('/api/user/referral/click') && r.method() === 'POST',
			{ timeout: 15_000 }
		);

		await page.goto('/signup?ref=ABC234');
		const req = await clickPing;
		expect(req.postDataJSON()).toMatchObject({ code: 'ABC234' });
		expect(await referralCookie(page)).toBe('ABC234');
	});

	test('an invalid ?ref (contains O) sets no cookie', async ({ page }) => {
		// "ABO234" has O, excluded from the Crockford alphabet the plugin validates
		await page.goto('/signup?ref=ABO234');
		await expect(page.getByRole('heading', { name: 'Sign Up' })).toBeVisible({ timeout: 12_000 });
		expect(await referralCookie(page)).toBeNull();
	});

	test('a too-short ?ref sets no cookie', async ({ page }) => {
		await page.goto('/signup?ref=AB');
		await expect(page.getByRole('heading', { name: 'Sign Up' })).toBeVisible({ timeout: 12_000 });
		expect(await referralCookie(page)).toBeNull();
	});
});

test.describe('Referral consumption - signup', () => {
	test.beforeEach(async ({ asAnonymous, page }) => {
		await asAnonymous();
		await guardLocalCreateOnly(page);
	});

	test('signup sends referral_code in the create body and clears the cookie', async ({
		page,
		gotoHydrated
	}) => {
		await stubTurnstile(page);

		// preset the cookie as if the ref plugin already ran (decoupled from plugin timing)
		await page.context().addCookies([
			{
				name: 'referral_code',
				value: 'ABC234',
				domain: '127.0.0.1',
				path: '/',
				sameSite: 'Lax'
			}
		]);

		// signup posts straight from the browser to mantle /v2/users/create, so a
		// request listener captures the outgoing body directly
		const createReq = page.waitForRequest(
			(r) => r.url().includes('/v2/users/create') && r.method() === 'POST',
			{ timeout: 20_000 }
		);

		await gotoHydrated('/signup');
		await page.getByPlaceholder('Username').fill('referreduser');
		await page.getByPlaceholder('Password').fill('validpassword123');

		const submit = page.locator('form button[type="submit"]').first();
		await expect(submit).toBeEnabled({ timeout: 15_000 });
		await submit.click();

		const req = await createReq;
		expect(req.postDataJSON()).toMatchObject({
			username: 'referreduser',
			referral_code: 'ABC234'
		});

		// on success useLogin clears the cookie so a later signup isn't mis-credited
		await expect.poll(() => referralCookie(page), { timeout: 15_000 }).toBeNull();
	});

	test('signup with no referral cookie omits referral_code', async ({ page, gotoHydrated }) => {
		await stubTurnstile(page);

		const createReq = page.waitForRequest(
			(r) => r.url().includes('/v2/users/create') && r.method() === 'POST',
			{ timeout: 20_000 }
		);

		await gotoHydrated('/signup');
		await page.getByPlaceholder('Username').fill('plainuser');
		await page.getByPlaceholder('Password').fill('validpassword123');

		const submit = page.locator('form button[type="submit"]').first();
		await expect(submit).toBeEnabled({ timeout: 15_000 });
		await submit.click();

		const req = await createReq;
		const body = req.postDataJSON();
		expect(body.username).toBe('plainuser');
		// referral_code is undefined (omitted) when no valid cookie is present
		expect(body.referral_code ?? null).toBeNull();
	});
});
