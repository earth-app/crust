import { expect, skipIfIntegration, test } from '../utils/fixtures';
import { makeEvent, makeUser } from '../utils/mock-data';

test.describe('Store list/random clobber regression', () => {
	test('random pool does not downgrade an attending event detail', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();

		const eventId = 'clobber-evt';
		const host = makeUser({ id: 'clobber-host', username: 'clobberhost' });

		// authoritative detail: viewer IS attending -> "Leave Event"
		const attendingDetail = makeEvent({
			id: eventId,
			name: 'Clobber Target Event',
			host,
			hostId: host.id,
			is_attending: true
		});

		const poolVersion = makeEvent({
			id: eventId,
			name: 'Clobber Target Event',
			host,
			hostId: host.id,
			is_attending: false
		});
		const poolFiller = makeEvent({ id: 'clobber-filler', name: 'Filler Event' });

		await mockApi.setMany([
			{
				method: 'GET',
				path: `^/v2/events/${eventId}$`,
				status: 200,
				body: attendingDetail,
				once: false
			},
			// random/similar pool re-includes the current event with the downgraded field
			{
				method: 'GET',
				path: '^/v2/events/random$',
				status: 200,
				body: [poolVersion, poolFiller],
				once: false
			}
		]);

		await asUser();
		await gotoHydrated(`/events/${eventId}`);

		// scope to the main detail card; the Similar Events section below renders its
		// own EventCards (each with a Sign Up button) that must not skew the count
		const detailCard = page.locator('#event-profile-card');

		// detail rendered as attending: "Leave Event" present
		await expect(detailCard.getByText(/Leave Event/i).first()).toBeVisible({ timeout: 10_000 });

		// give the page's Similar-Events fetch (fetchRandom -> setEvents) time to run
		// and attempt the clobber; the guard must prevent the downgrade
		await page.waitForTimeout(2000);

		// REGRESSION ASSERTION: the detail control stays attending, never flips to Sign Up
		await expect(detailCard.getByText(/Leave Event/i).first()).toBeVisible();
		await expect(detailCard.getByRole('button', { name: /^Sign Up$/ })).toHaveCount(0);
	});
});
