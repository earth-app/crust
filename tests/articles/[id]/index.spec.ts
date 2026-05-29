/**
 * E2E tests for `src/pages/articles/[id]/index.vue` - single article reader.
 */

import { expect, skipIfIntegration, test } from '../../utils/fixtures';

test.describe('Article detail (anonymous)', () => {
	test('renders the article title for a known id', async ({ asAnonymous, page, gotoHydrated }) => {
		skipIfIntegration();
		await asAnonymous();
		await gotoHydrated('/articles/art-1');
		await expect(page.getByText(/Article 1\b/).first()).toBeVisible({ timeout: 10_000 });
	});

	test('handles missing article id', async ({ asAnonymous, mockApi, page, gotoHydrated }) => {
		await mockApi.set({
			method: 'GET',
			path: '^/v2/articles/missing$',
			status: 404,
			body: { message: 'Not found' },
			once: false
		});
		await asAnonymous();
		await gotoHydrated('/articles/missing');
		await expect(page).toHaveURL(/\/articles\/missing/);
	});
});

test.describe('Article detail (logged in)', () => {
	test('renders the article reader for a logged-in user', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		await asUser();
		await gotoHydrated('/articles/art-3');
		await expect(page.getByText(/Article 3\b/).first()).toBeVisible({ timeout: 10_000 });
	});
});
