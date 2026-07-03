import { expect, skipIfIntegration, test } from '../../utils/fixtures';
import { makePrompt, makePromptResponse } from '../../utils/mock-data';

const PROMPT_ID = 'pmt-paginate-1';
const PROMPT_TEXT = 'Tell me a long story.';

function makePage(prefix: string, count: number) {
	return Array.from({ length: count }, (_, i) =>
		makePromptResponse({
			id: `${prefix}-${i + 1}`,
			prompt_id: PROMPT_ID,
			response: `${prefix} response ${i + 1}`
		})
	);
}

test.describe('Prompt response pagination', () => {
	test('renders page 1 then loads page 2 when the sentinel intersects', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('relies on ordered mock overrides for paged responses');
		await asUser();

		await mockApi.set({
			method: 'GET',
			path: `^/v2/prompts/${PROMPT_ID}$`,
			body: makePrompt({ id: PROMPT_ID, prompt: PROMPT_TEXT, visibility: 'PUBLIC' }),
			once: false
		});

		// the override matcher strips the query and the override stack is LIFO
		// (newest override is matched first), so register in REVERSE consume order:
		// empty stopper first, then page B, then page A last -> page A is at the
		// front and consumed by the first GET, page B by the second, then the
		// persistent empty body flips hasMore false.
		await mockApi.set({
			method: 'GET',
			path: `^/v2/prompts/${PROMPT_ID}/responses$`,
			body: { items: [], total: 40 },
			once: false
		});
		await mockApi.set({
			method: 'GET',
			path: `^/v2/prompts/${PROMPT_ID}/responses$`,
			body: { items: makePage('pageB', 15), total: 40 },
			once: true
		});
		await mockApi.set({
			method: 'GET',
			path: `^/v2/prompts/${PROMPT_ID}/responses$`,
			body: { items: makePage('pageA', 25), total: 40 },
			once: true
		});

		await gotoHydrated(`/prompts/${PROMPT_ID}`);
		await expect(page.getByText(PROMPT_TEXT).first()).toBeVisible({ timeout: 10_000 });

		// page 1 content present
		await expect(page.getByText('pageA response 1').first()).toBeVisible({ timeout: 10_000 });

		// scroll the sentinel into view to fire the IntersectionObserver
		const sentinel = page.locator('div.h-1');
		await sentinel.scrollIntoViewIfNeeded().catch(() => {});
		await page.mouse.wheel(0, 4000);

		// page 2 content loads
		await expect(page.getByText('pageB response 1').first()).toBeVisible({ timeout: 10_000 });
	});

	test('renders the initial page and the sentinel exists', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		await asUser();

		await mockApi.set({
			method: 'GET',
			path: `^/v2/prompts/${PROMPT_ID}$`,
			body: makePrompt({ id: PROMPT_ID, prompt: PROMPT_TEXT, visibility: 'PUBLIC' }),
			once: false
		});
		await mockApi.set({
			method: 'GET',
			path: `^/v2/prompts/${PROMPT_ID}/responses$`,
			body: { items: makePage('only', 25), total: 25 },
			once: false
		});

		await gotoHydrated(`/prompts/${PROMPT_ID}`);
		await expect(page.getByText(PROMPT_TEXT).first()).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText('only response 1').first()).toBeVisible({ timeout: 10_000 });
		// sentinel is present while hasMore (a non-empty page leaves hasMore true)
		await expect(page.locator('div.h-1').first()).toBeAttached();
	});
});
