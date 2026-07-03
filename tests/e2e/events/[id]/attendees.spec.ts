import type { Page } from '@playwright/test';
import { expect, skipIfIntegration, test } from '../../utils/fixtures';
import { makeEvent, makeUser, paginate } from '../../utils/mock-data';

const eventHost = makeUser({
	id: 'att-host-1',
	username: 'atthost',
	full_name: 'Attendee Host'
});

function manageableEvent(overrides: Record<string, any> = {}) {
	return makeEvent({
		host: eventHost,
		hostId: eventHost.id,
		can_edit: true,
		...overrides
	});
}

async function openAttendeesDrawer(page: Page) {
	const trigger = page.getByRole('button', { name: /Attendees \(/i }).first();
	await expect(trigger).toBeVisible({ timeout: 15_000 });
	await trigger.hover();
	await trigger.click();
}

test.describe('Event attendees drawer', () => {
	test('opens the drawer and renders seeded attendees plus the host', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('attendee drawer depends on mockApi-injected can_edit event + attendees');
		await asUser();

		const alice = makeUser({ id: 'att-alice', username: 'alice', full_name: 'Alice Adams' });
		const bob = makeUser({ id: 'att-bob', username: 'bob', full_name: 'Bob Baker' });

		await mockApi.set({
			method: 'GET',
			path: '^/v2/events/evt-att-1$',
			body: manageableEvent({ id: 'evt-att-1', name: 'Attendees Event', attendee_count: 3 }),
			once: false
		});
		await mockApi.set({
			method: 'GET',
			path: '^/v2/events/evt-att-1/attendees$',
			body: paginate([alice, bob], 1, 25),
			once: false
		});

		await gotoHydrated('/events/evt-att-1');
		await expect(page.getByText('Attendees Event').first()).toBeVisible({ timeout: 15_000 });

		await openAttendeesDrawer(page);

		// drawer title uses comma(attendee_count)
		await expect(page.getByText(/Event Attendees \(3\)/i).first()).toBeVisible({ timeout: 8_000 });

		// host is prepended client-side
		await expect(page.getByText('@atthost').first()).toBeVisible({ timeout: 8_000 });
		// seeded attendees render
		await expect(page.getByText('@alice').first()).toBeVisible();
		await expect(page.getByText('@bob').first()).toBeVisible();
	});

	test('renders the full attendee list at once (no incremental pagination)', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('full-list render depends on mockApi-injected attendees page');
		await asUser();

		// 12 attendees in one page - the drawer renders them all, there is no
		// load-more wiring on the detail card so the whole page must render
		const attendees = Array.from({ length: 12 }, (_, i) =>
			makeUser({ id: `bulk-${i}`, username: `bulk${i}`, full_name: `Bulk User ${i}` })
		);

		await mockApi.set({
			method: 'GET',
			path: '^/v2/events/evt-att-2$',
			body: manageableEvent({ id: 'evt-att-2', name: 'Bulk Attendees Event', attendee_count: 12 }),
			once: false
		});
		await mockApi.set({
			method: 'GET',
			path: '^/v2/events/evt-att-2/attendees$',
			body: paginate(attendees, 1, 25),
			once: false
		});

		await gotoHydrated('/events/evt-att-2');
		await expect(page.getByText('Bulk Attendees Event').first()).toBeVisible({ timeout: 15_000 });

		await openAttendeesDrawer(page);

		// first and last seeded attendees both present -> full list rendered
		await expect(page.getByText('@bulk0').first()).toBeVisible({ timeout: 8_000 });
		await expect(page.getByText('@bulk11').first()).toBeVisible({ timeout: 8_000 });
		// host prepended too
		await expect(page.getByText('@atthost').first()).toBeVisible();
	});

	test('drawer with an empty attendee list still shows the host', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('empty-attendees drawer depends on mockApi-injected event');
		await asUser();

		await mockApi.set({
			method: 'GET',
			path: '^/v2/events/evt-att-3$',
			body: manageableEvent({ id: 'evt-att-3', name: 'Empty Attendees Event', attendee_count: 1 }),
			once: false
		});
		await mockApi.set({
			method: 'GET',
			path: '^/v2/events/evt-att-3/attendees$',
			body: paginate([], 1, 25),
			once: false
		});

		await gotoHydrated('/events/evt-att-3');
		await expect(page.getByText('Empty Attendees Event').first()).toBeVisible({ timeout: 15_000 });

		await openAttendeesDrawer(page);
		await expect(page.getByText(/Event Attendees \(1\)/i).first()).toBeVisible({ timeout: 8_000 });
		await expect(page.getByText('@atthost').first()).toBeVisible({ timeout: 8_000 });
	});
});
