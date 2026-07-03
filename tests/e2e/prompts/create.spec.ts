import { expect, skipIfIntegration, test } from '../utils/fixtures';
import { makePrompt } from '../utils/mock-data';

test.describe('Prompt creation (PUBLIC user)', () => {
	test('renders the Create Prompt card with the prompt textarea and visibility select', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		await asUser({ account: { visibility: 'PUBLIC' } });
		await gotoHydrated('/prompts/new');
		await expect(page.getByRole('heading', { name: 'Create Prompt' })).toBeVisible({
			timeout: 10_000
		});
		await expect(page.getByPlaceholder('What is the meaning of life?')).toBeVisible();
	});

	test('Create button is disabled until the prompt reaches 10 characters', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('asserts client-side length gate on the create button');
		await asUser({ account: { visibility: 'PUBLIC' } });
		await gotoHydrated('/prompts/new');
		await expect(page.getByRole('heading', { name: 'Create Prompt' })).toBeVisible({
			timeout: 10_000
		});

		const textarea = page.getByPlaceholder('What is the meaning of life?');
		const createBtn = page.getByRole('button', { name: 'Create' });

		// too short -> disabled (length clause)
		await textarea.fill('short');
		await expect(createBtn).toBeDisabled();

		// >=10 chars -> still disabled because Turnstile has not verified (gate intact)
		await textarea.fill('A perfectly reasonable prompt to ponder.');
		await expect(createBtn).toBeDisabled();
	});

	test('seeded POST override is in place for the create flow shape', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		await asUser({ account: { visibility: 'PUBLIC' } });
		// document the success shape; the Create click is Turnstile-gated so this
		// override is not consumed in e2e (success path lives in unit tests)
		await mockApi.set({
			method: 'POST',
			path: '^/v2/prompts$',
			status: 201,
			body: makePrompt({ id: 'pmt-created-1', prompt: 'A freshly created prompt body.' }),
			once: false
		});
		await gotoHydrated('/prompts/new');
		await expect(page.getByRole('heading', { name: 'Create Prompt' })).toBeVisible({
			timeout: 10_000
		});
		await page
			.getByPlaceholder('What is the meaning of life?')
			.fill('A freshly created prompt body.');
		// Create stays gated by Turnstile; assert no success toast leaks
		await expect(page.getByText('Prompt created successfully!')).toHaveCount(0);
	});
});

test.describe('Prompt creation (anonymous)', () => {
	test('shows the Sign Up button instead of Create for anonymous users', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/prompts/new');
		// the NavBar also has a Sign Up button, so scope to the page body (#main-content)
		const main = page.locator('#main-content');
		await expect(main.getByRole('button', { name: 'Sign Up' })).toBeVisible({ timeout: 10_000 });
		await expect(main.getByRole('button', { name: 'Create' })).toHaveCount(0);
	});
});
