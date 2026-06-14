import { expect, skipIfIntegration, test } from './utils/fixtures';
import { makeEvent } from './utils/mock-data';

// a stable, dataset-matched profanity used to trip the real obscenity matcher
const PROFANE = 'what the fuck is this garbage';
const SPAMMY =
	'deal https://a.com https://b.com https://c.com https://d.com https://e.com www.f.com';

test.describe('Prompt response moderation', () => {
	test('blocks a profane response before posting', async ({ asUser, page, gotoHydrated }) => {
		skipIfIntegration();
		await asUser();
		await gotoHydrated('/prompts/pmt-1');

		const input = page.locator('#response-input');
		await expect(input).toBeVisible({ timeout: 15_000 });
		await input.fill(PROFANE);
		await page.locator('#post-button').click();

		await expect(page.getByText(/Content Blocked/i).first()).toBeVisible({ timeout: 8000 });
		await expect(page.getByText(/inappropriate language/i).first()).toBeVisible({ timeout: 8000 });
	});

	test('blocks a spammy response before posting', async ({ asUser, page, gotoHydrated }) => {
		skipIfIntegration();
		await asUser();
		await gotoHydrated('/prompts/pmt-1');

		const input = page.locator('#response-input');
		await expect(input).toBeVisible({ timeout: 15_000 });
		await input.fill(SPAMMY);
		await page.locator('#post-button').click();

		await expect(page.getByText(/Content Blocked/i).first()).toBeVisible({ timeout: 8000 });
		await expect(page.getByText(/looks like spam/i).first()).toBeVisible({ timeout: 8000 });
	});
});

test.describe('Article creation moderation', () => {
	test('blocks a profane article on create', async ({ asUser, page, gotoHydrated }) => {
		skipIfIntegration('requires asUser WRITER/PUBLIC override (not applied to the real admin)');
		await asUser({ account: { account_type: 'WRITER', visibility: 'PUBLIC' } });
		await gotoHydrated('/articles/new');
		await expect(page).toHaveURL(/\/articles\/new/);

		await page.getByPlaceholder(/Wonderful World of Pizzas/i).fill('A Guide to Local Hiking');
		await page
			.getByPlaceholder(/Pizzas are great because/i)
			.fill('A short guide to nearby trails.');
		await page
			.getByPlaceholder(/The first reason pizzas are great/i)
			.fill(`This trail guide is ${PROFANE} and should be blocked by moderation.`);

		await page.getByRole('button', { name: /Create Article/i }).click();

		await expect(page.getByText(/Content Blocked/i).first()).toBeVisible({ timeout: 8000 });
		await expect(page.getByText(/inappropriate language/i).first()).toBeVisible({ timeout: 8000 });
	});
});

test.describe('Event image submission moderation', () => {
	test('blocks an image categorized as explicit via the magic-byte hook', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('requires a mock-injected attending + ongoing event');

		const now = Date.now();
		// an event the user is attending and that is currently ongoing → upload enabled
		await mockApi.set({
			method: 'GET',
			path: '^/v2/events/evt-1$',
			body: makeEvent({
				id: 'evt-1',
				name: 'Event 1',
				is_attending: true,
				date: now - 3_600_000,
				end_date: now + 3_600_000,
				timing: { is_ongoing: true, has_passed: false, is_upcoming: false, starts_in: 0 }
			}),
			once: false
		});
		// keep the user's submission count at 0 (well under the 3-image cap)
		await mockApi.set({
			method: 'GET',
			path: /^\/v2\/users\/[^/]+\/events\/images\/evt-1$/,
			body: { items: [], total: 0, page: 1, limit: 25 },
			once: false
		});
		await mockApi.set({
			method: 'GET',
			path: '^/v2/events/evt-1/images$',
			body: { items: [], total: 0, page: 1, limit: 25 },
			once: false
		});

		await asUser();
		await gotoHydrated('/events/evt-1');

		// the file input only enables once the attending + ongoing event loads
		const fileInput = page.locator('#event-submissions input[type="file"]');
		await expect(fileInput).toBeEnabled({ timeout: 20_000 });

		// a fake png whose first bytes carry the nsfw signature — no real imagery
		await fileInput.setInputFiles({
			name: 'submission.png',
			mimeType: 'image/png',
			buffer: Buffer.from('EARTHAPP_MOD_NSFW\x89PNG\r\n\x1a\n fake bytes for moderation test')
		});

		// confirm the upload in the modal that opens after a file is chosen
		await expect(page.getByText(/Confirm Submission/i).first()).toBeVisible({ timeout: 10_000 });
		await page.getByRole('button', { name: 'Confirm' }).click();

		await expect(page.getByText(/Content Blocked/i).first()).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText(/looks explicit/i).first()).toBeVisible({ timeout: 8000 });
	});
});
