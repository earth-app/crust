import { expect, skipIfIntegration, test } from '../utils/fixtures';
import { makeArticle, makeUser, paginate } from '../utils/mock-data';

// a small, known set so we can assert exact titles after navigation
function seedArticles(count = 8) {
	const writer = makeUser({ id: 'writer-1', username: 'writer-1' });
	return Array.from({ length: count }, (_, i) =>
		makeArticle({
			id: `nav-art-${i + 1}`,
			title: `Navigation Article ${i + 1}`,
			author: writer,
			author_id: writer.id
		})
	);
}

// override the list + random/recent/older feeds so sections render the seeded set
async function overrideArticleFeeds(mockApi: any, articles: any[]) {
	await mockApi.set({
		method: 'GET',
		path: '^/v2/articles$',
		body: paginate(articles, 1, 25),
		once: false
	});
	// random/recent/older share one mantle handler returning a plain array
	await mockApi.set({
		method: 'GET',
		path: '^/v2/articles/(random|recent|older)$',
		body: articles,
		once: false
	});
	// per-id detail lookups
	for (const a of articles) {
		await mockApi.set({
			method: 'GET',
			path: `^/v2/articles/${a.id}$`,
			body: a,
			once: false
		});
	}
}

test.describe('Article navigation (anonymous)', () => {
	test('clicks a list card into the detail page', async ({
		asAnonymous,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		const articles = seedArticles();
		await overrideArticleFeeds(mockApi, articles);
		await asAnonymous();
		await gotoHydrated('/articles');

		// the Explore section renders ArticleCards; click the first known title
		const card = page.getByText('Navigation Article 1', { exact: true }).first();
		await expect(card).toBeVisible({ timeout: 12_000 });
		await card.click();

		await expect(page).toHaveURL(/\/articles\/nav-art-1/, { timeout: 12_000 });
		await expect(page.getByRole('heading', { level: 1, name: 'Navigation Article 1' })).toBeVisible(
			{ timeout: 12_000 }
		);
	});

	test('does NOT render Related Articles for anonymous', async ({
		asAnonymous,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		const articles = seedArticles();
		await overrideArticleFeeds(mockApi, articles);
		await asAnonymous();
		await gotoHydrated('/articles/nav-art-2');

		await expect(page.getByRole('heading', { level: 1, name: 'Navigation Article 2' })).toBeVisible(
			{ timeout: 12_000 }
		);
		// related section is logged-in only (gated on `user` in [id]/index.vue)
		await expect(page.getByText('Related Articles')).toHaveCount(0);
	});
});

test.describe('Article navigation (logged in)', () => {
	test('renders Related Articles and navigates into a related card', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		const articles = seedArticles();
		await overrideArticleFeeds(mockApi, articles);

		// the recommend_similar route (cloud) drives the related group; return a
		// deterministic trio that excludes the current article so the click target
		// resolves to a different detail page
		const related = [articles[3], articles[4], articles[5]];
		await mockApi.set({
			backend: 'cloud',
			method: 'POST',
			path: '^/v1/articles/recommend_similar_articles$',
			body: related,
			once: false
		});

		await asUser();
		await gotoHydrated('/articles/nav-art-1');

		await expect(page.getByRole('heading', { level: 1, name: 'Navigation Article 1' })).toBeVisible(
			{ timeout: 12_000 }
		);

		const relatedHeading = page.getByText('Related Articles').first();
		await expect(relatedHeading).toBeVisible({ timeout: 12_000 });

		// click a related card (Navigation Article 4 == articles[3]) and land on its page
		const relatedCard = page.getByText('Navigation Article 4', { exact: true }).first();
		await expect(relatedCard).toBeVisible({ timeout: 12_000 });
		await relatedCard.click();

		await expect(page).toHaveURL(/\/articles\/nav-art-4/, { timeout: 12_000 });
		await expect(page.getByRole('heading', { level: 1, name: 'Navigation Article 4' })).toBeVisible(
			{ timeout: 12_000 }
		);
	});

	test('lazy sections (Recent / Older) load on scroll', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		// Recent/Older are gated behind IntersectionObserver sentinels (rootMargin
		// 300px) in articles/index.vue; they only fetch when scrolled near. Assert
		// the eager Explore section first, then scroll to trigger the lazy ones.
		const articles = seedArticles();
		await overrideArticleFeeds(mockApi, articles);
		await asUser();
		await gotoHydrated('/articles');

		await expect(page.getByText('Explore Articles').first()).toBeVisible({ timeout: 12_000 });

		// scroll the lazy sentinels into view to trip the observers
		await page.getByText('Older Articles').first().scrollIntoViewIfNeeded();
		await expect(page.getByText('Recent Articles').first()).toBeVisible({ timeout: 12_000 });
		await expect(page.getByText('Older Articles').first()).toBeVisible({ timeout: 12_000 });
	});
});
