import {
	actAs,
	grantGeolocation,
	makeActor,
	registerActors,
	uniqueGeo
} from '../utils/feature-helpers';
import { expect, skipIfIntegration, test } from '../utils/fixtures';

// Trailmarks: leave a short kind note at a place; the next visitor finds it and
// thanks the NOTE (not the person). Thanks are private to the author - the author
// gets a quiet acknowledgment, and no public tally is ever shown to anyone else.
test.describe('Trailmarks - leave, find, thank across users', () => {
	test('A leaves a note, B finds and thanks it, A gets the private thanks (no public tally)', async ({
		page,
		context,
		mockApi,
		testId,
		gotoHydrated
	}) => {
		skipIfIntegration('drives seeded mock trailmark state + geolocation');

		const geo = uniqueGeo(testId);
		await grantGeolocation(context, geo);

		const alice = makeActor(testId, 'alice');
		const bob = makeActor(testId, 'bob');
		await registerActors(mockApi, alice, bob);

		const noteText = `Look up at the sky right here ${testId.slice(0, 8)}`;

		// --- Alice leaves a note at this spot ---
		await actAs(context, mockApi, alice);
		await gotoHydrated('/trailmarks');

		const composer = page.getByPlaceholder('You made it here. Take a breath and look up.');
		await expect(composer).toBeVisible({ timeout: 15000 });
		await composer.fill(noteText);
		const postBtn = page.getByRole('button', { name: 'Post Note' });
		await expect(postBtn).toBeEnabled({ timeout: 12000 });
		await postBtn.click();

		// her own note renders as hers: no "Thank This Note" button and no public tally
		await expect(page.getByText(noteText)).toBeVisible({ timeout: 12000 });
		await expect(page.getByRole('button', { name: 'Thank This Note' })).toHaveCount(0);

		// --- Bob, nearby, finds Alice's note and thanks it ---
		await actAs(context, mockApi, bob);
		await gotoHydrated('/trailmarks');
		await expect(page.getByText(noteText)).toBeVisible({ timeout: 15000 });
		// Bob never sees a "Quiet Thanks" tally or a "Your Note" marker on someone else's note
		await expect(page.getByText(/Quiet Thanks/)).toHaveCount(0);
		await expect(page.getByText('Your Note')).toHaveCount(0);

		const thankBtn = page.getByRole('button', { name: 'Thank This Note' });
		await expect(thankBtn).toBeVisible();
		await thankBtn.click();
		await expect(page.getByRole('button', { name: 'Thanked' })).toBeVisible({ timeout: 12000 });
		// still no public number anywhere on Bob's view after thanking
		await expect(page.getByText(/Quiet Thanks/)).toHaveCount(0);

		// --- Alice returns: her note now carries the private "Quiet Thanks" acknowledgment ---
		await actAs(context, mockApi, alice);
		await gotoHydrated('/trailmarks');
		await expect(page.getByText(noteText)).toBeVisible({ timeout: 15000 });
		await expect(page.getByText('1 Quiet Thanks')).toBeVisible({ timeout: 12000 });

		// and the author gets the private notification for the thanks
		await gotoHydrated('/profile/notifications');
		await expect(page.getByText('Someone Thanked Your Trailmark')).toBeVisible({ timeout: 15000 });
	});

	test('a far-away note is not surfaced as nearby', async ({
		page,
		context,
		mockApi,
		testId,
		gotoHydrated
	}) => {
		skipIfIntegration('drives seeded mock trailmark state + geolocation');

		const here = uniqueGeo(testId);
		await grantGeolocation(context, here);

		const alice = makeActor(testId, 'alice');
		await registerActors(mockApi, alice);
		await actAs(context, mockApi, alice);

		// leave a note from a geolocation ~2700km away (well beyond the 2km max radius),
		// then move back here. the latitude offset stays inside the valid [-90, 90] range.
		const farNote = `A note across the world ${testId.slice(0, 8)}`;
		const farLat = here.latitude >= 0 ? here.latitude - 25 : here.latitude + 25;
		await context.setGeolocation({ latitude: farLat, longitude: here.longitude });
		await gotoHydrated('/trailmarks');
		const composer = page.getByPlaceholder('You made it here. Take a breath and look up.');
		await expect(composer).toBeVisible({ timeout: 15000 });
		await composer.fill(farNote);
		const postBtn = page.getByRole('button', { name: 'Post Note' });
		await expect(postBtn).toBeEnabled({ timeout: 12000 });
		await postBtn.click();
		await expect(page.getByText(farNote)).toBeVisible({ timeout: 12000 });

		// move back to the original spot; the far note must not appear nearby
		await context.setGeolocation(here);
		await gotoHydrated('/trailmarks');
		await expect(page.getByText('No Notes Nearby Yet. Be the First to Leave One.')).toBeVisible({
			timeout: 15000
		});
		await expect(page.getByText(farNote)).toHaveCount(0);
	});
});
