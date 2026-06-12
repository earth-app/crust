/**
 * E2E tests for `src/pages/share/quest/[questId].vue` - the public acquisition
 * landing page for a shared quest achievement card.
 *
 * Server-rendered so a posted link gets a rich preview; the og:image points
 * straight at the public mantle card route. A `?ref=` is captured client-side
 * (cookie + click ping) and threaded into the signup CTA.
 */

import { expect, test } from '../../utils/fixtures';

async function referralCookie(page: import('@playwright/test').Page) {
	const cookies = await page.context().cookies();
	return cookies.find((c) => c.name === 'referral_code')?.value ?? null;
}

test.describe('Shared quest card (anonymous)', () => {
	test.beforeEach(async ({ asAnonymous }) => {
		await asAnonymous();
	});

	test('renders the headline, CTAs and the achievement card image', async ({
		page,
		gotoHydrated
	}) => {
		await gotoHydrated('/share/quest/q-1?u=test-user-1');
		await expect(
			page.getByRole('heading', { name: /completed a quest on The Earth App/i })
		).toBeVisible();
		await expect(page.getByRole('button', { name: 'Join The Earth App' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Explore Quests' })).toBeVisible();

		const card = page.getByAltText('Quest achievement card');
		await expect(card).toHaveAttribute('src', /\/v2\/users\/test-user-1\/share\/quest\/q-1$/);
	});

	test('Join CTA threads a valid ref code into signup and stores the cookie', async ({
		page,
		gotoHydrated
	}) => {
		await gotoHydrated('/share/quest/q-1?u=test-user-1&ref=ABC234');
		expect(await referralCookie(page)).toBe('ABC234');
		await page.getByRole('button', { name: 'Join The Earth App' }).click();
		await expect(page).toHaveURL(/\/signup\?ref=ABC234/);
	});

	test('Join CTA goes to a bare signup when there is no ref', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/share/quest/q-1?u=test-user-1');
		await page.getByRole('button', { name: 'Join The Earth App' }).click();
		await expect(page).toHaveURL(/\/signup$/);
	});

	test('Explore Quests CTA navigates to activities', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/share/quest/q-1?u=test-user-1');
		await page.getByRole('button', { name: 'Explore Quests' }).click();
		await expect(page).toHaveURL(/\/activities/);
	});
});
