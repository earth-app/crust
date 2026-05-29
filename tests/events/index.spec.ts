/**
 * E2E tests for `src/pages/events/index.vue` - event hub.
 */

import { expect, test } from '../utils/fixtures';

test.describe('Events list (anonymous)', () => {
	test('renders Upcoming Events section', async ({ asAnonymous, page, gotoHydrated }) => {
		await asAnonymous();
		await gotoHydrated('/events');
		await expect(page.getByText(/Upcoming Events/i).first()).toBeVisible();
	});

	test('renders Explore Events section', async ({ asAnonymous, page, gotoHydrated }) => {
		await asAnonymous();
		await gotoHydrated('/events');
		await expect(page.getByText(/Explore Events/i).first()).toBeVisible();
	});

	test('renders Recent Events section', async ({ asAnonymous, page, gotoHydrated }) => {
		await asAnonymous();
		await gotoHydrated('/events');
		await expect(page.getByText(/Recent Events/i).first()).toBeVisible();
	});

	test('does NOT show "Recommended for You" for anonymous', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/events');
		await expect(page.getByText('Recommended for You')).toHaveCount(0);
	});

	test('refresh button is visible', async ({ asAnonymous, page, gotoHydrated }) => {
		await asAnonymous();
		await gotoHydrated('/events');
		const refresh = page.getByTitle('Refresh').first();
		await expect(refresh).toBeVisible();
	});
});

test.describe('Events list (logged in)', () => {
	test('shows Recommended for You for a logged-in user', async ({ asUser, page, gotoHydrated }) => {
		await asUser();
		await gotoHydrated('/events');
		await expect(page.getByText('Recommended for You').first()).toBeVisible();
	});

	test('renders Create Event button for logged-in user', async ({ asUser, page, gotoHydrated }) => {
		await asUser({ account: { account_type: 'ORGANIZER' } });
		await gotoHydrated('/events');
		await expect(page.getByTitle('Create Event').first()).toBeVisible();
	});

	test('does NOT show Create Event button for anonymous', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/events');
		await expect(page.getByTitle('Create Event')).toHaveCount(0);
	});
});

test.describe('Events list (error states)', () => {
	test('handles 500 errors gracefully', async ({ asAnonymous, mockApi, page, gotoHydrated }) => {
		await mockApi.setMany([
			{
				method: 'GET',
				path: '^/v2/events$',
				status: 500,
				body: { message: 'Failed' },
				once: false
			},
			{
				method: 'GET',
				path: '^/v2/events/(random|recent|upcoming)$',
				status: 500,
				body: { message: 'Failed' },
				once: false
			}
		]);
		await asAnonymous();
		await gotoHydrated('/events');
		await expect(page).toHaveURL(/\/events(\?|$)/);
	});
});
