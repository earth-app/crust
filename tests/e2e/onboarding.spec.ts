import { expect, skipIfIntegration, test } from './utils/fixtures';

const ALL_STEPS = [
	'welcome',
	'pick_interests',
	'first_activity',
	'first_quest_started',
	'first_prompt_response',
	'first_article_read',
	'first_quest_completed',
	'first_friend',
	'verify_email'
];

function makeOnboardingState(overrides: Record<string, any> = {}) {
	const now = Date.parse('2026-06-30T00:00:00.000Z');
	return {
		user_id: overrides.user_id ?? 'test-user-1',
		completed_steps: overrides.completed_steps ?? [],
		persona: overrides.persona,
		interests: overrides.interests ?? [],
		started_at: overrides.started_at ?? now,
		finished_at: overrides.finished_at ?? null,
		dismissed_at: overrides.dismissed_at ?? null,
		updated_at: overrides.updated_at ?? now
	};
}

test.describe('Onboarding checklist (logged in)', () => {
	test('an incomplete user sees the Welcome checklist', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('seeds onboarding state via mock override');

		await mockApi.set({
			method: 'GET',
			path: /^\/v2\/users\/current\/onboarding$/,
			body: { state: makeOnboardingState({ completed_steps: [] }) },
			once: false
		});

		await asUser();
		await gotoHydrated('/');

		await expect(page.getByRole('heading', { name: 'Welcome to The Earth App' })).toBeVisible({
			timeout: 12_000
		});
		// progress reflects 0 of total done
		await expect(page.getByText(/0 of \d+ done/)).toBeVisible();
		// the first step's CTA is the highlighted "next" action
		await expect(page.getByRole('button', { name: 'Start Tour' })).toBeVisible();
	});

	test('a completed user does NOT see the checklist', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('seeds onboarding state via mock override');

		await mockApi.set({
			method: 'GET',
			path: /^\/v2\/users\/current\/onboarding$/,
			body: {
				state: makeOnboardingState({
					completed_steps: ALL_STEPS,
					finished_at: Date.parse('2026-06-29T00:00:00.000Z')
				})
			},
			once: false
		});

		await asUser();
		await gotoHydrated('/');

		// give the client onboarding fetch time to resolve, then assert absence
		await page.waitForTimeout(1500);
		await expect(page.getByRole('heading', { name: 'Welcome to The Earth App' })).toHaveCount(0);
	});

	test('a dismissed user does NOT see the checklist', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('seeds onboarding state via mock override');

		await mockApi.set({
			method: 'GET',
			path: /^\/v2\/users\/current\/onboarding$/,
			body: {
				state: makeOnboardingState({
					completed_steps: ['welcome'],
					dismissed_at: Date.parse('2026-06-29T00:00:00.000Z')
				})
			},
			once: false
		});

		await asUser();
		await gotoHydrated('/');

		await page.waitForTimeout(1500);
		await expect(page.getByRole('heading', { name: 'Welcome to The Earth App' })).toHaveCount(0);
	});

	test('Hide Checklist persists a dismiss and removes the card', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('seeds onboarding state via mock override');

		await mockApi.setMany([
			{
				method: 'GET',
				path: /^\/v2\/users\/current\/onboarding$/,
				body: { state: makeOnboardingState({ completed_steps: [] }) },
				once: false
			},
			{
				method: 'POST',
				path: /^\/v2\/users\/current\/onboarding\/dismiss$/,
				body: {
					state: makeOnboardingState({
						completed_steps: [],
						dismissed_at: Date.parse('2026-06-30T01:00:00.000Z')
					})
				},
				once: false
			}
		]);

		await asUser();
		await gotoHydrated('/');

		const card = page.locator('#welcome-checklist');
		await expect(card).toBeVisible({ timeout: 12_000 });

		// the overflow (dots) menu is the first button in the card header. it is a
		// LazyUDropdownMenu with hydrate-on-interaction="click", so the very first
		// click can be swallowed by hydration and not open the menu - click again
		// if the item isn't up yet (see the UX note in the deliverable).
		const trigger = card.getByRole('button').first();
		const item = page.getByRole('menuitem', { name: 'Hide Checklist' });
		await trigger.click();
		if (!(await item.isVisible().catch(() => false))) await trigger.click();
		await item.click();

		await expect(card).toBeHidden({ timeout: 8_000 });
	});
});

test.describe('Onboarding PersonaPicker (logged in)', () => {
	test('Pick Interests opens the picker and saving persists the persona', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('seeds onboarding state + persona save via mock override');

		await mockApi.setMany([
			// welcome already done so pick_interests is the highlighted next step
			{
				method: 'GET',
				path: /^\/v2\/users\/current\/onboarding$/,
				body: { state: makeOnboardingState({ completed_steps: ['welcome'] }) },
				once: false
			},
			{
				method: 'POST',
				path: /^\/v2\/users\/current\/onboarding\/persona$/,
				body: {
					state: makeOnboardingState({
						completed_steps: ['welcome', 'pick_interests'],
						persona: 'do',
						interests: ['Hiking', 'Cooking', 'Music']
					})
				},
				once: false
			}
		]);

		await asUser();
		await gotoHydrated('/');

		await expect(page.locator('#welcome-checklist')).toBeVisible({ timeout: 12_000 });

		await page.getByRole('button', { name: 'Pick Interests' }).click();

		// PersonaPicker modal
		await expect(page.getByRole('heading', { name: 'Tailor Your Experience' })).toBeVisible({
			timeout: 8_000
		});

		// pick a persona (Do) and three interests, then save
		await page.getByRole('button', { name: /^Do/ }).click();
		await page.getByRole('button', { name: 'Hiking' }).click();
		await page.getByRole('button', { name: 'Cooking' }).click();
		await page.getByRole('button', { name: 'Music' }).click();

		const save = page.getByRole('button', { name: 'Save & Start' });
		await expect(save).toBeEnabled();
		await save.click();

		// success toast confirms the persona persisted
		await expect(page.getByText(/Personalized/i).first()).toBeVisible({ timeout: 8_000 });
	});

	test('Save & Start stays disabled until 3 interests are picked', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('seeds onboarding state via mock override');

		await mockApi.set({
			method: 'GET',
			path: /^\/v2\/users\/current\/onboarding$/,
			body: { state: makeOnboardingState({ completed_steps: ['welcome'] }) },
			once: false
		});

		await asUser();
		await gotoHydrated('/');

		await page.getByRole('button', { name: 'Pick Interests' }).click();
		await expect(page.getByRole('heading', { name: 'Tailor Your Experience' })).toBeVisible({
			timeout: 8_000
		});

		await page.getByRole('button', { name: /^Do/ }).click();
		// only two interests -> still disabled
		await page.getByRole('button', { name: 'Hiking' }).click();
		await page.getByRole('button', { name: 'Cooking' }).click();
		await expect(page.getByRole('button', { name: 'Save & Start' })).toBeDisabled();

		// the "Pick at least 3" hint is shown while under the threshold
		await expect(page.getByText('Pick at least 3')).toBeVisible();
	});
});
