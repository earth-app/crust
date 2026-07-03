import { expect, skipIfIntegration, test } from '../../utils/fixtures';
import { makePrompt, makePromptResponse, paginate } from '../../utils/mock-data';

const PROMPT_ID = 'pmt-respond-1';
const PROMPT_TEXT = 'What did you build today?';

// seed the prompt + its initial (page 1) responses; page 2 returns empty to stop the observer loop
async function seedPrompt(mockApi: any, opts: { responses?: any[] } = {}) {
	const responses = opts.responses ?? [
		makePromptResponse({
			id: 'pr-seed-1',
			prompt_id: PROMPT_ID,
			response: 'First seeded response.'
		}),
		makePromptResponse({
			id: 'pr-seed-2',
			prompt_id: PROMPT_ID,
			response: 'Second seeded response.'
		})
	];
	await mockApi.set({
		method: 'GET',
		path: `^/v2/prompts/${PROMPT_ID}$`,
		body: makePrompt({ id: PROMPT_ID, prompt: PROMPT_TEXT, visibility: 'PUBLIC' }),
		once: false
	});
	await mockApi.set({
		method: 'GET',
		path: `^/v2/prompts/${PROMPT_ID}/responses$`,
		body: paginate(responses, 1, 25),
		once: false
	});
}

test.describe('Prompt response posting', () => {
	test('posts a benign response and clears the textarea', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('relies on mock POST /v2/prompts/{id}/responses override');
		await asUser();
		await seedPrompt(mockApi);

		const posted = makePromptResponse({
			id: 'pr-posted-1',
			prompt_id: PROMPT_ID,
			response: 'I learned how to write Playwright tests this week.'
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

		const input = page.locator('#response-input');
		await input.fill('I learned how to write Playwright tests this week.');
		await page.locator('#post-button').click();

		// prepended response renders; textarea clears
		await expect(
			page.getByText('I learned how to write Playwright tests this week.').first()
		).toBeVisible({ timeout: 10_000 });
		await expect(input).toHaveValue('');
	});

	test('post button is disabled when empty and enabled after typing', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		await asUser();
		await seedPrompt(mockApi);

		await gotoHydrated(`/prompts/${PROMPT_ID}`);
		await expect(page.getByText(PROMPT_TEXT).first()).toBeVisible({ timeout: 10_000 });

		const postBtn = page.locator('#post-button');
		await expect(postBtn).toBeDisabled();

		await page.locator('#response-input').fill('A real answer.');
		await expect(postBtn).toBeEnabled();
	});

	test('does not add the response and keeps the draft text when POST fails', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		await asUser();
		await seedPrompt(mockApi);

		const failText = 'This response will fail to post.';
		await mockApi.set({
			method: 'POST',
			path: `^/v2/prompts/${PROMPT_ID}/responses$`,
			status: 500,
			body: { message: 'Server exploded' },
			once: false
		});

		await gotoHydrated(`/prompts/${PROMPT_ID}`);
		await expect(page.getByText(PROMPT_TEXT).first()).toBeVisible({ timeout: 10_000 });

		const input = page.locator('#response-input');
		await input.fill(failText);
		await page.locator('#post-button').click();

		// createResponse returns !valid -> handleServerError only fires for the email
		// gate reason; a plain 500 produces NO toast (see BUG note in report). assert
		// the failed text is never appended and the draft is preserved for retry.
		await page.waitForTimeout(1500);
		await expect(page.locator('.w-full.mx-3.my-2').filter({ hasText: failText })).toHaveCount(0);
		await expect(input).toHaveValue(failText);
		// post button re-enables (posting flag reset) so the user can retry
		await expect(page.locator('#post-button')).toBeEnabled();
	});
});

test.describe('Prompt response posting (anonymous)', () => {
	test('textarea shows the login placeholder and post is gated', async ({
		asAnonymous,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		await asAnonymous();
		await seedPrompt(mockApi);

		await gotoHydrated(`/prompts/${PROMPT_ID}`);
		await expect(page.getByText(PROMPT_TEXT).first()).toBeVisible({ timeout: 10_000 });

		const input = page.locator('#response-input');
		await expect(input).toHaveAttribute('placeholder', 'Please log in to respond');
		// textarea + post button are both disabled with no user
		await expect(input).toBeDisabled();
		await expect(page.locator('#post-button')).toBeDisabled();
	});
});
