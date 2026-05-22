/**
 * E2E tests for `src/pages/prompts/[id]/index.vue` — single prompt page.
 */

import { expect, skipIfIntegration, test } from '../../utils/fixtures';

test.describe('Prompt detail (anonymous)', () => {
	test('renders the prompt for a known id', async ({ asAnonymous, page, gotoHydrated }) => {
		skipIfIntegration();
		await asAnonymous();
		await gotoHydrated('/prompts/pmt-1');
		await expect(page.getByText(/Sample prompt 1\?/).first()).toBeVisible({ timeout: 10_000 });
	});

	test('shows a not-found message for unknown prompt id', async ({
		asAnonymous,
		mockApi,
		page,
		gotoHydrated
	}) => {
		await mockApi.set({
			method: 'GET',
			path: '^/v2/prompts/nope$',
			status: 404,
			body: { message: 'Prompt not found' },
			once: false
		});
		await asAnonymous();
		await gotoHydrated('/prompts/nope');
		await expect(page.getByText(/Prompt doesn't exist|look at the URL/i).first()).toBeVisible({
			timeout: 10_000
		});
	});
});

test.describe('Prompt detail (logged in)', () => {
	test('renders the prompt and triggers journey update', async ({ asUser, page, gotoHydrated }) => {
		skipIfIntegration();
		await asUser();
		await gotoHydrated('/prompts/pmt-2');
		await expect(page.getByText(/Sample prompt 2\?/).first()).toBeVisible({ timeout: 10_000 });
	});
});
