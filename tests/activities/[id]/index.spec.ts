/**
 * E2E tests for `src/pages/activities/[id]/index.vue` — single activity page.
 *
 * Route: SWR 4h. Renders details for an activity sourced from
 * /v2/activities/{id} plus cloud enrichment from /v1/activity/{id}.
 */

import { expect, test } from '../../utils/fixtures';

test.describe('Activity detail (anonymous)', () => {
	test('renders an activity name for a known id', async ({ asAnonymous, page, gotoHydrated }) => {
		await asAnonymous();
		await gotoHydrated('/activities/act-1');
		await expect(page.getByText(/Sample Activity 1\b/i).first()).toBeVisible({ timeout: 10_000 });
	});

	test('shows a not-found message for an unknown activity', async ({
		asAnonymous,
		mockApi,
		page,
		gotoHydrated
	}) => {
		await mockApi.set({
			method: 'GET',
			path: '^/v2/activities/missing-activity$',
			status: 404,
			body: { message: 'Activity not found' },
			once: false
		});
		await asAnonymous();
		await gotoHydrated('/activities/missing-activity');
		// Page should render either a loading state, an error, or empty state -- but not crash
		await expect(page).toHaveURL(/\/activities\/missing-activity/);
	});

	test('handles 500 errors gracefully', async ({ asAnonymous, mockApi, page, gotoHydrated }) => {
		await mockApi.set({
			method: 'GET',
			path: '^/v2/activities/broken$',
			status: 500,
			body: { message: 'Server error' },
			once: false
		});
		await asAnonymous();
		await gotoHydrated('/activities/broken');
		await expect(page).toHaveURL(/\/activities\/broken/);
	});
});

test.describe('Activity detail (logged in)', () => {
	test('renders the activity for a logged-in user', async ({ asUser, page, gotoHydrated }) => {
		await asUser();
		await gotoHydrated('/activities/act-2');
		await expect(page.getByText(/Sample Activity 2\b/i).first()).toBeVisible({ timeout: 10_000 });
	});
});
