/**
 * Content-resilience + cross-content navigation regression suite.
 *
 * Guards the shared request layer (makeRequest -> normalizeResponseBody + one-shot retry)
 * and the single-item store cache guards (classifyItemFetch) against the native-transport
 * failure modes that used to blank the UI or clobber a good cache with not-found:
 *
 *   (a) a JSON body arriving as an unparsed STRING (CapacitorHttp text body)
 *   (b) a body wrapped in the { data, status, url } transport ENVELOPE
 *   (c) a PARTIAL object missing required fields (anon-stripped serializeUser, truncation)
 *   (d) a transient 500 that RECOVERS on retry
 *
 * Each asserts the UI renders / resolves gracefully - no crash, no perpetual <Loading>.
 */

import { expect, skipIfIntegration, test } from '../utils/fixtures';
import { makeActivity, makeArticle, makeEvent, makePrompt } from '../utils/mock-data';

const TEXT_PLAIN = { 'content-type': 'text/plain' };

test.describe('Cross-content navigation does not blank between types', () => {
	test('walks list -> detail across articles, prompts, events, activities', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		await asAnonymous();

		await gotoHydrated('/articles');
		await expect(page.getByText(/Recent Articles/i).first()).toBeVisible({ timeout: 12_000 });

		await gotoHydrated('/articles/art-1');
		await expect(page.getByText(/Article 1\b/).first()).toBeVisible({ timeout: 12_000 });

		await gotoHydrated('/prompts/pmt-1');
		await expect(page.getByText(/Sample prompt 1\?/).first()).toBeVisible({ timeout: 12_000 });

		await gotoHydrated('/events/evt-1');
		await expect(page.getByText(/Event 1\b/).first()).toBeVisible({ timeout: 12_000 });

		await gotoHydrated('/activities/act-1');
		await expect(page.getByText(/Sample Activity 1\b/i).first()).toBeVisible({ timeout: 12_000 });

		// back to an article detail: the earlier good render must not have been clobbered
		await gotoHydrated('/articles/art-2');
		await expect(page.getByText(/Article 2\b/).first()).toBeVisible({ timeout: 12_000 });
	});
});

test.describe('Article detail self-heals malformed responses', () => {
	test('renders when the body arrives as an unparsed JSON string', async ({
		asAnonymous,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		await mockApi.set({
			method: 'GET',
			path: '^/v2/articles/art-str-1$',
			status: 200,
			headers: TEXT_PLAIN,
			body: JSON.stringify(makeArticle({ id: 'art-str-1', title: 'Stringified Article' })),
			once: false
		});
		await asAnonymous();
		await gotoHydrated('/articles/art-str-1');
		await expect(page.getByText('Stringified Article').first()).toBeVisible({ timeout: 12_000 });
	});

	test('renders when the body is wrapped in a { data } envelope', async ({
		asAnonymous,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		await mockApi.set({
			method: 'GET',
			path: '^/v2/articles/art-env-1$',
			status: 200,
			body: {
				data: makeArticle({ id: 'art-env-1', title: 'Enveloped Article' }),
				status: 200,
				url: '/v2/articles/art-env-1'
			},
			once: false
		});
		await asAnonymous();
		await gotoHydrated('/articles/art-env-1');
		await expect(page.getByText('Enveloped Article').first()).toBeVisible({ timeout: 12_000 });
	});

	test('resolves gracefully (no crash) on a partial object missing the author', async ({
		asAnonymous,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		await mockApi.set({
			method: 'GET',
			path: '^/v2/articles/art-partial-1$',
			status: 200,
			body: { id: 'art-partial-1', title: 'Half Built' },
			once: false
		});
		await asAnonymous();
		await gotoHydrated('/articles/art-partial-1');
		// partial payload is treated as not-found; the app-shell stays interactive, URL stable
		await expect(page).toHaveURL(/\/articles\/art-partial-1/);
		await expect(page.locator('body')).toBeVisible();
	});

	test('recovers after a transient 500 (retry hits the healthy backend)', async ({
		asAnonymous,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		// one-shot 500; makeRequest retries the GET and the second attempt falls through to
		// the seeded default article
		await mockApi.set({
			method: 'GET',
			path: '^/v2/articles/art-4$',
			status: 500,
			body: { message: 'Internal error' },
			once: true
		});
		await asAnonymous();
		await gotoHydrated('/articles/art-4');
		await expect(page.getByText(/Article 4\b/).first()).toBeVisible({ timeout: 12_000 });
	});
});

test.describe('Prompt detail self-heals malformed responses', () => {
	test('renders when the body is wrapped in a { data } envelope', async ({
		asAnonymous,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		await mockApi.set({
			method: 'GET',
			path: '^/v2/prompts/pmt-env-1$',
			status: 200,
			body: {
				data: makePrompt({ id: 'pmt-env-1', prompt: 'Enveloped prompt body?' }),
				status: 200
			},
			once: false
		});
		await asAnonymous();
		await gotoHydrated('/prompts/pmt-env-1');
		await expect(page.getByText('Enveloped prompt body?').first()).toBeVisible({ timeout: 12_000 });
	});

	test('recovers after a transient 500', async ({ asAnonymous, mockApi, page, gotoHydrated }) => {
		skipIfIntegration();
		await mockApi.set({
			method: 'GET',
			path: '^/v2/prompts/pmt-3$',
			status: 500,
			body: { message: 'Internal error' },
			once: true
		});
		await asAnonymous();
		await gotoHydrated('/prompts/pmt-3');
		await expect(page.getByText(/Sample prompt 3\?/).first()).toBeVisible({ timeout: 12_000 });
	});
});

test.describe('Event detail self-heals malformed responses', () => {
	test('renders when the body arrives as an unparsed JSON string', async ({
		asAnonymous,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		await mockApi.set({
			method: 'GET',
			path: '^/v2/events/evt-str-1$',
			status: 200,
			headers: TEXT_PLAIN,
			body: JSON.stringify(makeEvent({ id: 'evt-str-1', name: 'Stringified Event' })),
			once: false
		});
		await asAnonymous();
		await gotoHydrated('/events/evt-str-1');
		await expect(page.getByText('Stringified Event').first()).toBeVisible({ timeout: 12_000 });
	});

	test('recovers after a transient 500', async ({ asAnonymous, mockApi, page, gotoHydrated }) => {
		skipIfIntegration();
		await mockApi.set({
			method: 'GET',
			path: '^/v2/events/evt-3$',
			status: 500,
			body: { message: 'Internal error' },
			once: true
		});
		await asAnonymous();
		await gotoHydrated('/events/evt-3');
		await expect(page.getByText(/Event 3\b/).first()).toBeVisible({ timeout: 12_000 });
	});
});

test.describe('Activity detail self-heals malformed responses', () => {
	test('renders when the body is wrapped in a { data } envelope', async ({
		asAnonymous,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		await mockApi.set({
			method: 'GET',
			path: '^/v2/activities/act-env-1$',
			status: 200,
			body: {
				data: makeActivity({ id: 'act-env-1', name: 'Enveloped Activity' }),
				status: 200
			},
			once: false
		});
		await asAnonymous();
		await gotoHydrated('/activities/act-env-1');
		await expect(page.getByText('Enveloped Activity').first()).toBeVisible({ timeout: 12_000 });
	});

	test('recovers after a transient 500', async ({ asAnonymous, mockApi, page, gotoHydrated }) => {
		skipIfIntegration();
		await mockApi.set({
			method: 'GET',
			path: '^/v2/activities/act-3$',
			status: 500,
			body: { message: 'Internal error' },
			once: true
		});
		await asAnonymous();
		await gotoHydrated('/activities/act-3');
		await expect(page.getByText(/Sample Activity 3\b/i).first()).toBeVisible({ timeout: 12_000 });
	});
});

test.describe('Profile editor loads + saves under degraded responses', () => {
	test('editor renders even when a secondary fetch is transiently degraded', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		await asUser();
		// a flaky secondary fetch (attending events) 500s once; the editor must still render
		await mockApi.set({
			method: 'GET',
			path: '^/v2/users/[^/]+/events/attending$',
			status: 500,
			body: { message: 'Internal error' },
			once: true
		});
		await gotoHydrated('/profile');
		await expect(page.locator('#bio')).toBeVisible({ timeout: 15_000 });
	});

	test('inline bio save still surfaces the success toast', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('mutates the real admin account; relies on mock PATCH shallow-merge');
		await asUser();
		await mockApi.set({
			method: 'PATCH',
			path: '^/v2/users/current$',
			status: 200,
			body: { id: 'test-user-1', account: { bio: 'Resilient bio' } },
			once: false
		});

		await gotoHydrated('/profile');
		await expect(page.locator('#bio')).toBeVisible({ timeout: 12_000 });

		const bioEditable = page
			.locator('div.cursor-pointer')
			.filter({ hasText: 'A test user' })
			.first();
		await bioEditable.click();
		const bioInput = page.getByRole('textbox').filter({ hasText: '' }).first();
		await expect(bioInput).toBeVisible({ timeout: 8000 });
		await bioInput.fill('Resilient bio');
		await bioInput.press('Enter');

		await expect(page.getByText(/Profile Updated/i).first()).toBeVisible({ timeout: 8000 });
	});
});
