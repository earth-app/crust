import type { Page, Route } from '@playwright/test';
import { expect, skipIfIntegration, test } from '../../utils/fixtures';
import { makeEvent, makeUser } from '../../utils/mock-data';

const eventHost = makeUser({ id: 'rsvp-host-1', username: 'rsvphost' });
const detailCard = (page: Page) => page.locator('#event-profile-card');

async function setupRsvpFlip(
	page: Page,
	mockApi: any,
	id: string,
	name: string,
	action: 'signup' | 'leave'
) {
	const initialAttending = action === 'leave';
	const eventBody = (attending: boolean) =>
		makeEvent({
			id,
			name,
			host: eventHost,
			hostId: eventHost.id,
			is_attending: attending,
			attendee_count: attending ? 6 : 5
		});

	// SSR (node-side, past page.route) reads the mock override for the initial state
	await mockApi.set({
		method: 'GET',
		path: `^/v2/events/${id}$`,
		body: eventBody(initialAttending),
		once: false
	});

	let acted = false;
	await page.route(new RegExp(`/v2/events/${id}$`), (route: Route) => {
		if (route.request().method() !== 'GET') return route.fallback();
		const attending = acted ? action === 'signup' : initialAttending;
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(eventBody(attending))
		});
	});
	await page.route(new RegExp(`/v2/events/${id}/${action}$`), (route: Route) => {
		acted = true;
		// empty body: a {message} envelope would read as failure and suppress the refetch
		route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
	});
}

// hover-then-click for the lazy-hydrated InfoCard action buttons
async function clickAction(page: Page, name: RegExp) {
	const btn = detailCard(page).getByRole('button', { name }).first();
	await expect(btn).toBeVisible({ timeout: 15_000 });
	await btn.hover();
	await btn.click();
	return btn;
}

test.describe('Event RSVP - sign up', () => {
	test('Sign Up flips the button to Leave Event', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('signup flow depends on mockApi-injected event + signup override');
		await asUser();

		await setupRsvpFlip(page, mockApi, 'evt-rsvp-1', 'RSVP Signup Event', 'signup');

		await gotoHydrated('/events/evt-rsvp-1');
		await expect(page.getByText('RSVP Signup Event').first()).toBeVisible({ timeout: 15_000 });

		await clickAction(page, /^Sign Up$/);

		// button flips to Leave Event after the forced refetch lands
		await expect(
			detailCard(page)
				.getByRole('button', { name: /Leave Event/i })
				.first()
		).toBeVisible({
			timeout: 15_000
		});
		await expect(detailCard(page).getByRole('button', { name: /^Sign Up$/ })).toHaveCount(0);
	});
});

test.describe('Event RSVP - leave', () => {
	test('Leave Event flips the button back to Sign Up', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('leave flow depends on mockApi-injected event + leave override');
		await asUser();

		await setupRsvpFlip(page, mockApi, 'evt-rsvp-2', 'RSVP Leave Event', 'leave');

		await gotoHydrated('/events/evt-rsvp-2');
		await expect(page.getByText('RSVP Leave Event').first()).toBeVisible({ timeout: 15_000 });

		await clickAction(page, /Leave Event/i);

		await expect(
			detailCard(page)
				.getByRole('button', { name: /^Sign Up$/ })
				.first()
		).toBeVisible({
			timeout: 15_000
		});
		await expect(detailCard(page).getByRole('button', { name: /Leave Event/i })).toHaveCount(0);
	});
});

test.describe('Event RSVP - error path', () => {
	test('signup failure does not falsely flip the button', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('error path depends on mockApi-injected 409 signup override');
		await asUser();

		// not attending; the forced refetch is suppressed because signup fails
		// (composable only refetches on res.success), so this stays not-attending
		await mockApi.set({
			method: 'GET',
			path: '^/v2/events/evt-rsvp-3$',
			body: makeEvent({
				id: 'evt-rsvp-3',
				name: 'RSVP Error Event',
				host: eventHost,
				hostId: eventHost.id,
				is_attending: false,
				attendee_count: 5
			}),
			once: false
		});
		// signup returns 409 (already attending / conflict)
		await mockApi.set({
			method: 'POST',
			path: '^/v2/events/evt-rsvp-3/signup$',
			status: 409,
			body: { message: 'Already attending' },
			once: false
		});

		await gotoHydrated('/events/evt-rsvp-3');
		await expect(page.getByText('RSVP Error Event').first()).toBeVisible({ timeout: 15_000 });

		await clickAction(page, /^Sign Up$/);

		// button must NOT flip to Leave Event on a failed signup
		await expect(detailCard(page).getByRole('button', { name: /Leave Event/i })).toHaveCount(0);
		await expect(
			detailCard(page)
				.getByRole('button', { name: /^Sign Up$/ })
				.first()
		).toBeVisible();
	});
});

test.describe('Event RSVP - cancelled event', () => {
	test('signing up for a cancelled event surfaces the Event Cancelled toast', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('cancelled-event guard depends on mockApi-injected event');
		await asUser();

		await mockApi.set({
			method: 'GET',
			path: '^/v2/events/evt-rsvp-cancelled$',
			body: makeEvent({
				id: 'evt-rsvp-cancelled',
				name: 'RSVP Cancelled Event',
				host: eventHost,
				hostId: eventHost.id,
				is_attending: false,
				attendee_count: 5,
				fields: { cancelled: true }
			}),
			once: false
		});

		await gotoHydrated('/events/evt-rsvp-cancelled');
		await expect(page.getByText('RSVP Cancelled Event').first()).toBeVisible({ timeout: 15_000 });

		// Sign Up still renders (timing.has_passed is false), but clicking it hits
		// the cancelled guard in Card.vue which toasts instead of calling the API
		await clickAction(page, /^Sign Up$/);

		await expect(page.getByText(/sign-ups are closed/i).first()).toBeVisible({ timeout: 8_000 });
		await expect(detailCard(page).getByRole('button', { name: /Leave Event/i })).toHaveCount(0);
	});
});

test.describe('Event RSVP - anonymous', () => {
	test('anonymous user clicking Sign Up is redirected to login', async ({
		asAnonymous,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('anonymous RSVP redirect depends on mockApi-injected event');
		await asAnonymous();

		await mockApi.set({
			method: 'GET',
			path: '^/v2/events/evt-rsvp-anon$',
			body: makeEvent({
				id: 'evt-rsvp-anon',
				name: 'RSVP Anon Event',
				host: eventHost,
				hostId: eventHost.id,
				is_attending: false,
				attendee_count: 5
			}),
			once: false
		});

		await gotoHydrated('/events/evt-rsvp-anon');
		await expect(page.getByText('RSVP Anon Event').first()).toBeVisible({ timeout: 15_000 });

		// the button renders for anon (user.value is null, not the host); clicking
		// it routes to /login?redirect=... per the Card.vue guard
		await clickAction(page, /^Sign Up$/);
		await page.waitForURL(/\/login/, { timeout: 15_000 });
		await expect(page).toHaveURL(/redirect=.*events.*evt-rsvp-anon/);
	});
});
