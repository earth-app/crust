import type { Page } from '@playwright/test';
import { expect, skipIfIntegration, test } from '../utils/fixtures';
import { makeEvent } from '../utils/mock-data';

async function openCreateModal(page: Page) {
	const trigger = page.getByTitle('Create Event').first();
	await expect(trigger).toBeVisible({ timeout: 15_000 });
	await trigger.click();
	// modal mounts with the "Create New Event" title
	await expect(page.getByText('Create New Event').first()).toBeVisible({ timeout: 8_000 });
}

function submitButton(page: Page) {
	return page
		.getByRole('dialog')
		.getByRole('button', { name: /Create Event/i })
		.first();
}

test.describe('Event create - happy path', () => {
	test('creates an IN_PERSON event and closes the modal', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('create flow depends on mockApi-injected POST /v2/events 201');
		// PUBLIC profile + verified email so the email gate lets the submit through
		await asUser({ account: { visibility: 'PUBLIC', email_verified: true } });

		const created = makeEvent({ id: 'evt-created-1', name: 'My New Picnic', type: 'IN_PERSON' });
		await mockApi.set({
			method: 'POST',
			path: '^/v2/events$',
			status: 201,
			body: created,
			once: false
		});

		await gotoHydrated('/events');
		await openCreateModal(page);

		const dialog = page.getByRole('dialog');
		await dialog.getByPlaceholder('Enter event name').fill('My New Picnic');
		await dialog.getByPlaceholder('Enter site description').fill('An afternoon in the park.');

		await submitButton(page).click();

		// success toast confirms the create call resolved
		await expect(page.getByText(/Event Created/i).first()).toBeVisible({ timeout: 10_000 });
		// modal closes on submitted
		await expect(page.getByText('Create New Event')).toHaveCount(0, { timeout: 10_000 });
	});

	test('creates an ONLINE event (location field hidden)', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('create flow depends on mockApi-injected POST /v2/events 201');
		await asUser({ account: { visibility: 'PUBLIC', email_verified: true } });

		const created = makeEvent({ id: 'evt-created-2', name: 'Online Meetup', type: 'ONLINE' });
		await mockApi.set({
			method: 'POST',
			path: '^/v2/events$',
			status: 201,
			body: created,
			once: false
		});

		await gotoHydrated('/events');
		await openCreateModal(page);

		const dialog = page.getByRole('dialog');
		await dialog.getByPlaceholder('Enter event name').fill('Online Meetup');

		await dialog.getByRole('combobox', { name: /Type/i }).click();
		await page.getByRole('option', { name: /Online/ }).click();

		// the location editor must disappear for ONLINE events (v-if type !== ONLINE)
		await expect(dialog.getByText(/^Address$/)).toHaveCount(0);

		await submitButton(page).click();
		await expect(page.getByText(/Event Created/i).first()).toBeVisible({ timeout: 10_000 });
	});
});

test.describe('Event create - validation', () => {
	test('empty required name keeps the modal open and does not create', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('validation flow depends on mockApi-injected create endpoint');
		await asUser({ account: { visibility: 'PUBLIC', email_verified: true } });

		await mockApi.set({
			method: 'POST',
			path: '^/v2/events$',
			status: 500,
			body: { message: 'Should not be called' },
			once: false
		});

		await gotoHydrated('/events');
		await openCreateModal(page);

		// submit with an empty name -> UForm required validation blocks submit
		await submitButton(page).click();

		// no success toast, modal remains open (title still present)
		await expect(page.getByText(/Event Created/i)).toHaveCount(0);
		await expect(page.getByText('Create New Event').first()).toBeVisible();
	});
});

test.describe('Event create - access', () => {
	test('Create Event trigger is hidden for anonymous users', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/events');
		await expect(page.getByText(/Upcoming Events/i).first()).toBeVisible({ timeout: 15_000 });
		await expect(page.getByTitle('Create Event')).toHaveCount(0);
	});
});
