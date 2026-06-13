/**
 * E2E tests for `src/pages/events/[id]/index.vue` - single event page.
 */

import { expect, skipIfIntegration, test } from '../../utils/fixtures';

test.describe('Event detail (anonymous)', () => {
	test('renders event details for known id', async ({ asAnonymous, page, gotoHydrated }) => {
		skipIfIntegration();
		await asAnonymous();
		await gotoHydrated('/events/evt-1');
		await expect(page.getByText(/Event 1\b/).first()).toBeVisible({ timeout: 10_000 });
	});

	test('handles 404 for unknown event id', async ({ asAnonymous, mockApi, page, gotoHydrated }) => {
		await mockApi.set({
			method: 'GET',
			path: '^/v2/events/no-such-event$',
			status: 404,
			body: { message: 'Event not found' },
			once: false
		});
		await asAnonymous();
		await gotoHydrated('/events/no-such-event');
		await expect(page).toHaveURL(/\/events\/no-such-event/);
	});
});

test.describe('Event detail (logged in)', () => {
	test('renders event for logged-in user', async ({ asUser, page, gotoHydrated }) => {
		skipIfIntegration();
		await asUser();
		await gotoHydrated('/events/evt-2');
		await expect(page.getByText(/Event 2\b/).first()).toBeVisible({ timeout: 10_000 });
	});
});
