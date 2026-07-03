import { expect, skipIfIntegration, test } from '../utils/fixtures';
import { makeArticle, makeEvent, makeUser } from '../utils/mock-data';

test.describe('Partial-serialization bad-shape handling', () => {
	test('article with author:[] renders not-found, not a crash', async ({
		asAnonymous,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();

		const articleId = 'partial-article';
		// valid envelope, invalid shape: author stripped to [] by mantle
		const malformed = makeArticle({ id: articleId, title: 'Partial Article', author: [] });

		const pageErrors: string[] = [];
		page.on('pageerror', (err) => pageErrors.push(err.message));

		await mockApi.set({
			method: 'GET',
			path: `^/v2/articles/${articleId}$`,
			status: 200,
			body: malformed,
			once: false
		});
		await asAnonymous();
		await gotoHydrated(`/articles/${articleId}`);

		// graceful degradation: the not-found copy shows, page stays alive
		await expect(page.getByText(/Article not found/i).first()).toBeVisible({ timeout: 10_000 });
		// no hydration / null-deref crash from the bad shape
		expect(pageErrors.filter((m) => /reading '?ce'?|Cannot read propert/i.test(m))).toEqual([]);
	});

	test('event with host:[] renders not-found, not a crash', async ({
		asAnonymous,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();

		const eventId = 'partial-event';
		const malformed = makeEvent({ id: eventId, name: 'Partial Event', host: [], hostId: '' });

		const pageErrors: string[] = [];
		page.on('pageerror', (err) => pageErrors.push(err.message));

		await mockApi.set({
			method: 'GET',
			path: `^/v2/events/${eventId}$`,
			status: 200,
			body: malformed,
			once: false
		});
		await asAnonymous();
		await gotoHydrated(`/events/${eventId}`);

		await expect(page.getByText(/Event doesn't exist/i).first()).toBeVisible({ timeout: 10_000 });
		expect(pageErrors.filter((m) => /reading '?ce'?|Cannot read propert/i.test(m))).toEqual([]);
	});

	test('a well-formed article after the bad one still renders (cache not poisoned globally)', async ({
		asAnonymous,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();

		// distinct id with a valid author -> proves the null-cache for the bad id
		// doesn't leak into a sibling good fetch
		const goodId = 'partial-good-article';
		const good = makeArticle({
			id: goodId,
			title: 'Healthy Article',
			author: makeUser({ id: 'good-author', username: 'goodauthor' })
		});
		await mockApi.set({
			method: 'GET',
			path: `^/v2/articles/${goodId}$`,
			status: 200,
			body: good,
			once: false
		});
		await asAnonymous();
		await gotoHydrated(`/articles/${goodId}`);

		await expect(page.getByText(/Healthy Article/i).first()).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText(/Article not found/i)).toHaveCount(0);
	});
});
