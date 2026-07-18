import {
	actAs,
	grantGeolocation,
	makeActor,
	registerActors,
	uniqueGeo
} from '../utils/feature-helpers';
import { expect, skipIfIntegration, test } from '../utils/fixtures';
import {
	longAnswer,
	seedActiveQuest,
	stubQuestUpdate,
	submitDescribeText
} from '../utils/quest-helpers';

// One long journey that strings the v0.6.0 features together across page boundaries
// and across two users, asserting state persists and propagates the whole way:
//   browse trails -> accept (if-then pledge) -> run a step (clue -> action -> reveal)
//   -> Nature Minutes tick up -> the same outdoor time grows the shared circle
//   expedition + garden -> send kudos on a circle-mate -> leave a trailmark ->
//   (as the other user) find + thank the trailmark -> the author gets the private
//   notification, and the kudos recipient gets theirs.
test.describe('Full journey - trails -> circle -> kudos -> trailmarks across two users', () => {
	test('a signed-in user runs a trail, grows the circle, cheers a friend, and leaves a note another user thanks', async ({
		page,
		context,
		mockApi,
		testId,
		gotoHydrated
	}) => {
		skipIfIntegration('drives seeded trails/circle/trailmark mock state + geolocation');

		const geo = uniqueGeo(testId);
		await grantGeolocation(context, geo);

		const alice = makeActor(testId, 'alice');
		const bob = makeActor(testId, 'bob');
		await registerActors(mockApi, alice, bob);
		// Alice + Bob share one circle; their outdoor time grows one shared goal
		await mockApi.setCircle(alice.user.id, [alice.user.id, bob.user.id]);

		// trail-1's run is Alice's active quest so its step interface unlocks; stub validation
		const stepDef = {
			type: 'describe_text',
			description: 'Describe one thing you notice around you.',
			parameters: [0, 0, 20, 800],
			icon: 'i-lucide-pen-line'
		};
		await seedActiveQuest(mockApi, alice.user.id, {
			quest: {
				id: 'trail-1',
				title: 'Neighborhood Wonders',
				description: 'A short walk that ends in a small moment of awe.',
				icon: 'mdi:map-marker-path',
				rarity: 'normal',
				steps: [stepDef],
				reward: 15
			},
			questId: 'trail-1',
			currentStep: stepDef,
			currentStepIndex: 0,
			completed: false,
			progress: []
		});
		await stubQuestUpdate(mockApi, alice.user.id, { validated: true, completed: false });

		await actAs(context, mockApi, alice);

		// === 1. Alice starts a shared expedition (nature_minutes goal) ===
		await gotoHydrated('/circle');
		await expect(page.getByRole('heading', { name: 'Start an Expedition' })).toBeVisible({
			timeout: 15000
		});
		await page
			.getByPlaceholder('Weekend Woods Challenge')
			.fill(`Circle Trek ${testId.slice(0, 6)}`);
		await page.getByRole('button', { name: 'Start Expedition' }).click();
		await expect(
			page.getByRole('heading', { name: `Circle Trek ${testId.slice(0, 6)}` })
		).toBeVisible({ timeout: 15000 });
		// nothing outdoors yet -> the garden is still in its first-minutes state
		await expect(page.getByText(/starts growing on your first outdoor minutes/i)).toBeVisible();

		// === 2. Alice runs a trail step (clue -> action -> reveal) -> Nature Minutes tick up ===
		await gotoHydrated('/trails');
		await expect(page.getByRole('heading', { name: 'Neighborhood Wonders' })).toBeVisible({
			timeout: 15000
		});
		await page.getByRole('button', { name: 'Begin Trail' }).first().click();
		await expect(page.getByRole('heading', { name: 'Make Your Pledge' })).toBeVisible({
			timeout: 12000
		});
		await page.getByPlaceholder('I finish my morning coffee').fill('I step outside');
		await page.getByRole('button', { name: 'Accept & Begin' }).click();
		await page.locator('#tile-0\\:0').click();
		await expect(page.getByRole('heading', { name: 'A Curious Clue' })).toBeVisible({
			timeout: 12000
		});
		await page.getByRole('button', { name: "I'm Ready" }).click();
		await submitDescribeText(page, longAnswer());
		await expect(page.getByRole('heading', { name: 'The Reveal' })).toBeVisible({ timeout: 15000 });
		await expect(page.getByText('+15 Nature Minutes Credited')).toBeVisible();
		await page.getByRole('button', { name: 'Finish Trail' }).click();
		await page.getByRole('button', { name: 'Close Trail' }).click();
		await expect(page.locator('#main-content').getByText('Your Longest Yet')).toBeVisible({
			timeout: 12000
		});

		// === 3. That same outdoor time grew the shared expedition + garden ===
		await gotoHydrated('/circle');
		await expect(
			page.getByRole('heading', { name: `Circle Trek ${testId.slice(0, 6)}` })
		).toBeVisible({ timeout: 15000 });
		// Alice's contribution now shows on the ring's contributor list (contribution, not rank)
		await expect(page.getByRole('listitem').filter({ hasText: '15 min' })).toBeVisible();
		// the garden has left the first-minutes state
		await expect(page.getByText(/starts growing on your first outdoor minutes/i)).toHaveCount(0);

		// === 4. Alice cheers Bob on (counter-free kudos) ===
		const goYou = page.getByRole('button', { name: 'Go You' }).first();
		await expect(goYou).toBeVisible();
		await goYou.click();
		await expect(
			page.getByText(new RegExp(`Cheered ${bob.user.username}`, 'i')).first()
		).toBeVisible({ timeout: 12000 });
		await expect(page.getByText(/\d+\s*(kudos|cheers)/i)).toHaveCount(0);

		// === 5. Alice leaves a trailmark at this spot ===
		const noteText = `Rest here and watch the clouds ${testId.slice(0, 8)}`;
		await gotoHydrated('/trailmarks');
		const composer = page.getByPlaceholder('You made it here. Take a breath and look up.');
		await expect(composer).toBeVisible({ timeout: 15000 });
		await composer.fill(noteText);
		const postBtn = page.getByRole('button', { name: 'Post Note' });
		await expect(postBtn).toBeEnabled({ timeout: 12000 });
		await postBtn.click();
		await expect(page.getByText(noteText)).toBeVisible({ timeout: 12000 });

		// === 6. Bob (the other user) finds the note nearby and thanks it ===
		await actAs(context, mockApi, bob);
		await gotoHydrated('/trailmarks');
		await expect(page.getByText(noteText)).toBeVisible({ timeout: 15000 });
		const thankBtn = page.getByRole('button', { name: 'Thank This Note' });
		await expect(thankBtn).toBeVisible();
		await thankBtn.click();
		await expect(page.getByRole('button', { name: 'Thanked' })).toBeVisible({ timeout: 12000 });

		// Bob also has the warm private kudos acknowledgment waiting
		await gotoHydrated('/profile/notifications');
		await expect(page.getByText('A Cheer From Your Circle')).toBeVisible({ timeout: 15000 });

		// === 7. Back as Alice: her note carries the private thanks + a private notification ===
		await actAs(context, mockApi, alice);
		await gotoHydrated('/trailmarks');
		await expect(page.getByText('1 Quiet Thanks')).toBeVisible({ timeout: 15000 });
		await gotoHydrated('/profile/notifications');
		await expect(page.getByText('Someone Thanked Your Trailmark')).toBeVisible({ timeout: 15000 });
	});
});
