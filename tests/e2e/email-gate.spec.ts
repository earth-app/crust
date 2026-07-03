import { expect, skipIfIntegration, test } from './utils/fixtures';
import { makePrompt, makePromptResponse, paginate } from './utils/mock-data';

const PROMPT_ID = 'pmt-gate-1';
const PROMPT_TEXT = 'What are you working on?';

async function seedPrompt(mockApi: any) {
	await mockApi.set({
		method: 'GET',
		path: `^/v2/prompts/${PROMPT_ID}$`,
		body: makePrompt({ id: PROMPT_ID, prompt: PROMPT_TEXT, visibility: 'PUBLIC' }),
		once: false
	});
	await mockApi.set({
		method: 'GET',
		path: `^/v2/prompts/${PROMPT_ID}/responses$`,
		body: paginate(
			[makePromptResponse({ id: 'pr-gate-seed', prompt_id: PROMPT_ID, response: 'A seed.' })],
			1,
			25
		),
		once: false
	});
}

test.describe('Email gate (unverified user)', () => {
	test('an unverified user posting a response is blocked by the gate modal', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('relies on a mock unverified user + seeded prompt');

		await asUser({ account: { email_verified: false } });
		await seedPrompt(mockApi);

		await gotoHydrated(`/prompts/${PROMPT_ID}`);
		await expect(page.getByText(PROMPT_TEXT).first()).toBeVisible({ timeout: 10_000 });

		await page.locator('#response-input').fill('My gated response.');
		await page.locator('#post-button').click();

		// optimistic gate fires before any network call
		await expect(page.getByRole('heading', { name: 'Verify Your Email', exact: true })).toBeVisible(
			{
				timeout: 8_000
			}
		);
		await expect(page.getByRole('button', { name: 'Send Verification Code' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Go to Verification Page' })).toBeVisible();
		// the email-on-file is surfaced in the gate
		await expect(page.getByText('test@earth-app.com').first()).toBeVisible();
	});

	test('the gate "Go to Verification Page" CTA routes to /verify-email', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('relies on a mock unverified user + seeded prompt');

		await asUser({ account: { email_verified: false } });
		await seedPrompt(mockApi);

		await gotoHydrated(`/prompts/${PROMPT_ID}`);
		await expect(page.getByText(PROMPT_TEXT).first()).toBeVisible({ timeout: 10_000 });

		await page.locator('#response-input').fill('Take me to verify.');
		await page.locator('#post-button').click();

		await expect(page.getByRole('heading', { name: 'Verify Your Email', exact: true })).toBeVisible(
			{
				timeout: 8_000
			}
		);
		await page.getByRole('button', { name: 'Go to Verification Page' }).click();

		await expect(page).toHaveURL(/\/verify-email(\?|$)/);
	});

	test('a user with no email on file sees the add-email variant', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('relies on a mock user with no email + seeded prompt');

		// no email + unverified -> gate shows the "Add an Email" variant
		await asUser({ account: { email_verified: false, email: '' } });
		await seedPrompt(mockApi);

		await gotoHydrated(`/prompts/${PROMPT_ID}`);
		await expect(page.getByText(PROMPT_TEXT).first()).toBeVisible({ timeout: 10_000 });

		await page.locator('#response-input').fill('No email here.');
		await page.locator('#post-button').click();

		await expect(page.getByRole('heading', { name: 'Add an Email to Your Account' })).toBeVisible({
			timeout: 8_000
		});
		await expect(page.getByRole('button', { name: 'Add an Email' })).toBeVisible();
	});
});

test.describe('Email gate (verified user)', () => {
	test('a verified user does NOT see the gate and the response posts', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('relies on a verified mock user + seeded prompt + POST override');

		await asUser({ account: { email_verified: true } });
		await seedPrompt(mockApi);

		const posted = makePromptResponse({
			id: 'pr-gate-posted',
			prompt_id: PROMPT_ID,
			response: 'Verified users post freely.'
		});
		await mockApi.set({
			method: 'POST',
			path: `^/v2/prompts/${PROMPT_ID}/responses$`,
			status: 201,
			body: posted,
			once: false
		});

		await gotoHydrated(`/prompts/${PROMPT_ID}`);
		await expect(page.getByText(PROMPT_TEXT).first()).toBeVisible({ timeout: 10_000 });

		await page.locator('#response-input').fill('Verified users post freely.');
		await page.locator('#post-button').click();

		// the gate never appears; the response renders
		await expect(page.getByText('Verified users post freely.').first()).toBeVisible({
			timeout: 10_000
		});
		await expect(page.getByRole('heading', { name: 'Verify Your Email', exact: true })).toHaveCount(
			0
		);
	});
});
