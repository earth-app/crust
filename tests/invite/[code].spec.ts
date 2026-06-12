/**
 * E2E tests for `src/pages/invite/[code].vue` - the referral landing page.
 *
 * Pure redirect page: on mount it validates the code, persists it to the
 * `referral_code` cookie, fires a best-effort click ping, then forwards to
 * `/signup?ref=CODE`. An invalid code skips straight to `/signup`.
 */

import { expect, test } from '../utils/fixtures';

async function referralCookie(page: import('@playwright/test').Page) {
	const cookies = await page.context().cookies();
	return cookies.find((c) => c.name === 'referral_code')?.value ?? null;
}

test.describe('Invite landing (anonymous)', () => {
	test.beforeEach(async ({ asAnonymous }) => {
		await asAnonymous();
	});

	test('valid code redirects to signup with the ref query', async ({ page }) => {
		await page.goto('/invite/ABC234');
		await page.waitForURL(/\/signup\?ref=ABC234/, { timeout: 15_000 });
		expect(await referralCookie(page)).toBe('ABC234');
	});

	test('lowercase code is normalized to uppercase', async ({ page }) => {
		await page.goto('/invite/abc234');
		await page.waitForURL(/\/signup\?ref=ABC234/, { timeout: 15_000 });
		expect(await referralCookie(page)).toBe('ABC234');
	});

	test('invalid code redirects to signup without a ref', async ({ page }) => {
		// "ABO234" contains O, which is excluded from the Crockford alphabet
		await page.goto('/invite/ABO234');
		await page.waitForURL(/\/signup$/, { timeout: 15_000 });
		expect(await referralCookie(page)).toBeNull();
	});

	test('too-short code redirects to signup without a ref', async ({ page }) => {
		await page.goto('/invite/AB');
		await page.waitForURL(/\/signup$/, { timeout: 15_000 });
		expect(await referralCookie(page)).toBeNull();
	});
});
