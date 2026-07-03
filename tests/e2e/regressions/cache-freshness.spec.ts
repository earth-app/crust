import { expect, skipIfIntegration, test } from '../utils/fixtures';
import { makeArticle, makeUser } from '../utils/mock-data';

test.describe('Detail-page cache freshness', () => {
	test('article detail shows new data on revisit after the backing data changes', async ({
		asAnonymous,
		mockApi,
		page
	}) => {
		skipIfIntegration();

		const articleId = 'freshness-article';
		const author = makeUser({ id: 'fresh-author', username: 'freshauthor' });

		// first visit: original title
		await mockApi.set({
			method: 'GET',
			path: `^/v2/articles/${articleId}$`,
			status: 200,
			body: makeArticle({ id: articleId, title: 'Original Freshness Title', author }),
			once: false
		});
		await asAnonymous();

		await page.goto(`/articles/${articleId}?v=1`, { waitUntil: 'domcontentloaded' });
		await expect(page.getByText(/Original Freshness Title/i).first()).toBeVisible({
			timeout: 10_000
		});

		// change the backing data
		await mockApi.set({
			method: 'GET',
			path: `^/v2/articles/${articleId}$`,
			status: 200,
			body: makeArticle({ id: articleId, title: 'Updated Freshness Title', author }),
			once: false
		});

		// second visit: must reflect the NEW title and NOT the stale one
		await page.goto(`/articles/${articleId}?v=2`, { waitUntil: 'domcontentloaded' });
		await expect(page.getByText(/Updated Freshness Title/i).first()).toBeVisible({
			timeout: 10_000
		});
		await expect(page.getByText(/Original Freshness Title/i)).toHaveCount(0);
	});

	test('article detail is not served from a stale store after a hard reload', async ({
		asAnonymous,
		mockApi,
		page
	}) => {
		skipIfIntegration();

		const articleId = 'freshness-article-2';
		const author = makeUser({ id: 'fresh-author-2', username: 'freshauthor2' });

		await mockApi.set({
			method: 'GET',
			path: `^/v2/articles/${articleId}$`,
			status: 200,
			body: makeArticle({ id: articleId, title: 'Stale Candidate', author }),
			once: false
		});
		await asAnonymous();
		await page.goto(`/articles/${articleId}?v=1`, { waitUntil: 'domcontentloaded' });
		await expect(page.getByText(/Stale Candidate/i).first()).toBeVisible({ timeout: 10_000 });

		await mockApi.set({
			method: 'GET',
			path: `^/v2/articles/${articleId}$`,
			status: 200,
			body: makeArticle({ id: articleId, title: 'Fresh Replacement', author }),
			once: false
		});

		// full reload (new document, store reset) must pick up the replacement
		await page.reload({ waitUntil: 'domcontentloaded' });
		await page.goto(`/articles/${articleId}?v=2`, { waitUntil: 'domcontentloaded' });
		await expect(page.getByText(/Fresh Replacement/i).first()).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText(/Stale Candidate/i)).toHaveCount(0);
	});
});
