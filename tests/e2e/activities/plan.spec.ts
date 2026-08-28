/**
 * E2E for the if-then plan composer on `src/pages/activities/index.vue`.
 *
 * The flow is stateful across three calls (menu -> form -> status), and the one thing worth
 * proving end to end is that the sentence is shown once and never comes back.
 */

import { expect, skipIfIntegration, test } from '../utils/fixtures';

const PLAN = 'If I close this app, then I will walk one loop around the block.';

test.describe('If-then plan', () => {
	test('links one cue to one response and shows the plan exactly once', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('depends on the mock plan endpoints');
		await asUser();
		await gotoHydrated('/activities');

		const card = page.locator('#user-plan');
		await expect(card).toBeVisible({ timeout: 12_000 });
		await card.locator('#plan-start').click();

		await expect(card.locator('#plan-submit')).toBeVisible({ timeout: 12_000 });
		await card.locator('#plan-submit').click();

		await expect(card.locator('#plan-sentence')).toContainText(PLAN, { timeout: 12_000 });
		await card.locator('#plan-rehearse').click();

		await expect(card.locator('#plan-active')).toBeVisible({ timeout: 12_000 });
		await expect(card).not.toContainText(PLAN);
	});

	test('a running plan is never reprinted after a reload', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('depends on the mock plan endpoints');
		await asUser();
		await gotoHydrated('/activities');

		const card = page.locator('#user-plan');
		await expect(card).toBeVisible({ timeout: 12_000 });
		await card.locator('#plan-start').click();
		await expect(card.locator('#plan-submit')).toBeVisible({ timeout: 12_000 });
		await card.locator('#plan-submit').click();
		await expect(card.locator('#plan-sentence')).toBeVisible({ timeout: 12_000 });
		await card.locator('#plan-rehearse').click();
		await expect(card.locator('#plan-active')).toBeVisible({ timeout: 12_000 });

		await gotoHydrated('/activities');

		const reloaded = page.locator('#user-plan');
		await expect(reloaded.locator('#plan-active')).toBeVisible({ timeout: 12_000 });
		await expect(reloaded).not.toContainText(PLAN);
		await expect(reloaded.locator('#plan-start')).toHaveCount(0);
	});
});
