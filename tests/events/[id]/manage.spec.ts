/**
 * E2E tests for `src/pages/events/[id]/manage.vue` — event host management UI.
 *
 * Renders only when event + user are loaded AND the event's `can_edit` flag is
 * true (the page redirects away with an "Access Denied" toast otherwise). We
 * override the event endpoint in each test to set `can_edit: true`.
 *
 * Stability note: the page does NOT await its event fetch during setup — the
 * fetch fires async and the watcher only flips the UI on once the eventStore's
 * cache resolves. We therefore wait with a generous timeout (the dev server's
 * `/events/[id]/manage` route is one of the heavier first-compile hits) and
 * scope the assertion inside `<main>` to dodge the navbar.
 */

import type { Page } from '@playwright/test';
import { expect, test } from '../../utils/fixtures';
import { makeEvent } from '../../utils/mock-data';

function manageableEvent(overrides: Record<string, any> = {}) {
	return makeEvent({ can_edit: true, ...overrides });
}

// Wait until the manage page has rendered the host-edit UI. The page guards
// behind `v-if="event && user"`, and the event load is async, so naive
// assertions race the network. We poll for the "Back to Event" link inside
// <main>, which only mounts after both conditions hold.
async function waitForManageUI(page: Page, timeout = 45_000) {
	await expect(page.locator('main').getByRole('link', { name: /Back to Event/i })).toBeVisible({
		timeout
	});
}

test.describe('Event manage page (anonymous)', () => {
	test('does not render management UI for anonymous users', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/events/evt-1/manage');
		// Buttons should not be visible without a user
		await expect(page.getByRole('button', { name: /Cancel Event/i })).toHaveCount(0);
	});
});

test.describe('Event manage page (logged in)', () => {
	test('renders the management UI for a logged-in user with a valid event', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		await mockApi.set({
			method: 'GET',
			path: '^/v2/events/evt-1$',
			body: manageableEvent({ id: 'evt-1', name: 'Event 1' }),
			once: false
		});
		await asUser();
		await gotoHydrated('/events/evt-1/manage');
		await waitForManageUI(page);
	});

	test('shows the View Attendees button with attendee count', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		await mockApi.set({
			method: 'GET',
			path: '^/v2/events/evt-1$',
			body: manageableEvent({ id: 'evt-1', name: 'Event 1', attendee_count: 12 }),
			once: false
		});
		await asUser();
		await gotoHydrated('/events/evt-1/manage');
		await waitForManageUI(page);
		await expect(page.locator('main').getByRole('button', { name: /View Attendees/i })).toBeVisible(
			{
				timeout: 5_000
			}
		);
	});

	test('shows the Cancel Event button for an upcoming event', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		await mockApi.set({
			method: 'GET',
			path: '^/v2/events/evt-2$',
			body: manageableEvent({ id: 'evt-2', name: 'Event 2' }),
			once: false
		});
		await asUser();
		await gotoHydrated('/events/evt-2/manage');
		await waitForManageUI(page);
		await expect(page.locator('main').getByRole('button', { name: /Cancel Event/i })).toBeVisible({
			timeout: 5_000
		});
	});

	test('shows Uncancel when event is already cancelled', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		await mockApi.set({
			method: 'GET',
			path: '^/v2/events/evt-cancelled$',
			body: manageableEvent({
				id: 'evt-cancelled',
				name: 'Cancelled Event',
				fields: { cancelled: true }
			}),
			once: false
		});
		await asUser();
		await gotoHydrated('/events/evt-cancelled/manage');
		await waitForManageUI(page);
		await expect(page.locator('main').getByRole('button', { name: /Uncancel Event/i })).toBeVisible(
			{
				timeout: 5_000
			}
		);
	});

	test('redirects when current user is not authorized to edit', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		await mockApi.set({
			method: 'GET',
			path: '^/v2/events/evt-noedit$',
			body: makeEvent({ id: 'evt-noedit', name: 'No Edit Event', can_edit: false }),
			once: false
		});
		await asUser();
		await gotoHydrated('/events/evt-noedit/manage');
		await page.waitForURL(/\/events\/evt-noedit$/, { timeout: 15_000 });
	});
});
