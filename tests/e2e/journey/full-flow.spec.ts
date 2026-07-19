import {
	actAs,
	grantGeolocation,
	makeActor,
	registerActors,
	uniqueGeo
} from '../utils/feature-helpers';
import { expect, skipIfIntegration, test } from '../utils/fixtures';

test.describe('Full journey - trail -> shared garden -> kudos -> trailmark -> prompt across two users', () => {
	test('a signed-in user does a trail practice, grows the garden, cheers a friend, leaves notes another user thanks', async ({
		page,
		context,
		mockApi,
		testId,
		gotoHydrated
	}) => {
		skipIfIntegration('drives seeded trails/circle/trailmark/prompt mock state + geolocation');

		const geo = uniqueGeo(testId);
		await grantGeolocation(context, geo);

		const alice = makeActor(testId, 'alice');
		const bob = makeActor(testId, 'bob');
		await registerActors(mockApi, alice, bob);
		// Alice + Bob share one circle; their outdoor time grows one shared goal
		await mockApi.setCircle(alice.user.id, [alice.user.id, bob.user.id]);

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

		// === 2. Alice does a trail practice (pledge -> presence -> reflect -> reveal) ===
		await gotoHydrated('/trails');
		await expect(page.getByRole('heading', { name: 'Neighborhood Wonders' })).toBeVisible({
			timeout: 15000
		});
		// scope to trail-1's card: the catalog sorts by rarity then title (not seed order)
		await page
			.locator('[data-trail-id="trail-1"]')
			.getByRole('button', { name: 'Begin Trail' })
			.click();
		await page.getByRole('button', { name: 'Make My Pledge' }).click();
		await page.getByPlaceholder('I finish my morning coffee').fill('I step outside');
		await page.getByRole('button', { name: 'Accept & Begin' }).click();
		const logBtn = page.getByRole('button', { name: /Log \d+ Nature Minutes/ });
		await expect(logBtn).toBeVisible({ timeout: 12000 });
		await logBtn.click();
		await page.getByRole('button', { name: 'Save Reflection' }).click();
		await expect(page.getByRole('heading', { name: 'A Small Wonder' })).toBeVisible({
			timeout: 15000
		});
		await expect(page.getByText(/\+\d+ Nature Minutes, just for being out there/)).toBeVisible();
		// finishing closes the runner; the page ring shows the credit as a fresh personal best
		await page.getByRole('button', { name: 'Finish' }).click();
		await expect(page.locator('#main-content').getByText('Your Longest Yet')).toBeVisible({
			timeout: 12000
		});

		// === 3. That same outdoor time grew the shared expedition + garden ===
		await gotoHydrated('/circle');
		await expect(
			page.getByRole('heading', { name: `Circle Trek ${testId.slice(0, 6)}` })
		).toBeVisible({ timeout: 15000 });
		// Alice's contribution now shows on the ring's contributor list (contribution, not rank)
		await expect(page.getByRole('listitem').filter({ hasText: '12 min' })).toBeVisible();
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

		// === 6. Bob (the other user) finds the single nearby note and thanks it ===
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

		// === 8. Finally, Alice answers a daily prompt from outside; it surfaces under the prompt ===
		const answerText = `Answering from the trail ${testId.slice(0, 8)}`;
		await gotoHydrated('/prompts/pmt-1');
		await expect(page.getByRole('heading', { name: 'From Outside' })).toBeVisible({
			timeout: 15000
		});
		await page.getByRole('button', { name: 'Answer From Outside' }).click();
		const answerBox = page.getByPlaceholder('You made it here. Take a breath and look up.');
		await expect(answerBox).toBeVisible({ timeout: 12000 });
		await answerBox.fill(answerText);
		const postAnswer = page.getByRole('button', { name: 'Post Note' });
		await expect(postAnswer).toBeEnabled({ timeout: 12000 });
		await postAnswer.click();
		await expect(page.getByText(answerText)).toBeVisible({ timeout: 12000 });
	});
});
