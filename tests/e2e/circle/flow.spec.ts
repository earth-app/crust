import { actAs, makeActor, registerActors } from '../utils/feature-helpers';
import { expect, skipIfIntegration, test } from '../utils/fixtures';
import { makeExpedition, makeGarden } from '../utils/mock-data';

test.describe('Circles & Expeditions - shared goal, garden, counter-free kudos', () => {
	test('members share one expedition + garden; kudos reaches the recipient counter-free', async ({
		page,
		context,
		mockApi,
		testId,
		gotoHydrated
	}) => {
		skipIfIntegration('drives seeded circle/expedition/garden mock state');

		const alice = makeActor(testId, 'alice');
		const bob = makeActor(testId, 'bob');
		await registerActors(mockApi, alice, bob);

		// Alice + Bob are one circle; seed a shared expedition where BOTH already contributed
		await mockApi.setCircle(alice.user.id, [alice.user.id, bob.user.id]);
		const expTitle = `Woods Run ${testId.slice(0, 6)}`;
		await mockApi.seedExpedition(
			makeExpedition({
				id: `exp-${alice.user.id}`,
				owner_uid: alice.user.id,
				title: expTitle,
				goal: 'nature_minutes',
				target: 1000,
				contributors: [
					{ uid: alice.user.id, username: alice.user.username, contribution: 300 },
					{ uid: bob.user.id, username: bob.user.username, contribution: 300 }
				]
			})
		);
		await mockApi.seedGarden(
			makeGarden({ owner_uid: alice.user.id, level: 6, total_minutes: 600, elementCount: 40 })
		);

		// --- Alice sees the shared expedition (combined ring) + grown garden ---
		await actAs(context, mockApi, alice);
		await gotoHydrated('/circle');
		await expect(page.getByRole('heading', { name: expTitle })).toBeVisible({ timeout: 15000 });
		// combined progress = (300 + 300) / 1000 = 60%
		await expect(page.getByText('60%')).toBeVisible();
		// both members appear in the shared-goal contribution list, framed as contribution
		// (each with their minutes, not the members roster) and never as a rank/position
		await expect(
			page.getByRole('listitem').filter({ hasText: alice.user.username }).filter({ hasText: 'min' })
		).toBeVisible();
		await expect(
			page.getByRole('listitem').filter({ hasText: bob.user.username }).filter({ hasText: 'min' })
		).toBeVisible();
		await expect(page.getByText(/#\s*1\b|1st place|Rank\b/i)).toHaveCount(0);
		// the shared garden is grown, not the first-minutes empty state
		await expect(page.getByRole('heading', { name: 'Shared Garden', exact: true })).toBeVisible();
		await expect(page.getByText(/starts growing on your first outdoor minutes/i)).toHaveCount(0);

		// --- Alice sends counter-free kudos to Bob ---
		const goYou = page.getByRole('button', { name: 'Go You' }).first();
		await expect(goYou).toBeVisible();
		await goYou.click();
		// the giver gets the warm, self-referential acknowledgment (giver-benefit framing)
		await expect(
			page.getByText(new RegExp(`Cheered ${bob.user.username}`, 'i')).first()
		).toBeVisible({ timeout: 12000 });
		await expect(page.getByText('Encouraging someone lifts you, too.').first()).toBeVisible();
		// no numeric tally / counter is ever rendered in the kudos surface
		await expect(page.getByText(/\d+\s*(kudos|cheers)/i)).toHaveCount(0);

		// --- Bob sees the SAME shared expedition (state propagates across users) ---
		await actAs(context, mockApi, bob);
		await gotoHydrated('/circle');
		await expect(page.getByRole('heading', { name: expTitle })).toBeVisible({ timeout: 15000 });
		await expect(page.getByText('60%')).toBeVisible();

		// --- Bob receives the warm, private, counter-free acknowledgment ---
		await gotoHydrated('/profile/notifications');
		await expect(page.getByText('A Cheer From Your Circle')).toBeVisible({ timeout: 15000 });
	});

	test('starting an expedition shows the empty ring + first-minutes garden state', async ({
		page,
		context,
		mockApi,
		testId,
		gotoHydrated
	}) => {
		skipIfIntegration('drives circle/expedition mock state');

		const alice = makeActor(testId, 'alice');
		const bob = makeActor(testId, 'bob');
		await registerActors(mockApi, alice, bob);
		// a circle with a member so the shared goal can actually start
		await mockApi.setCircle(alice.user.id, [alice.user.id, bob.user.id]);
		await actAs(context, mockApi, alice);

		await gotoHydrated('/circle');
		// no active expedition yet -> the start form is shown
		await expect(page.getByRole('heading', { name: 'Start an Expedition' })).toBeVisible({
			timeout: 15000
		});
		await page.getByPlaceholder('Weekend Woods Challenge').fill(`Dawn Loop ${testId.slice(0, 6)}`);
		await page.getByRole('button', { name: 'Start Expedition' }).click();

		// the fresh expedition renders with a 0% ring and the empty garden prompt
		await expect(
			page.getByRole('heading', { name: `Dawn Loop ${testId.slice(0, 6)}` })
		).toBeVisible({
			timeout: 15000
		});
		await expect(page.getByText('0%')).toBeVisible();
		await expect(page.getByText(/starts growing on your first outdoor minutes/i)).toBeVisible();
	});

	test('an empty circle blocks the expedition start and prompts an invite', async ({
		page,
		context,
		mockApi,
		testId,
		gotoHydrated
	}) => {
		skipIfIntegration('drives circle/expedition mock state');

		const solo = makeActor(testId, 'solo');
		await registerActors(mockApi, solo);
		// a self-only circle has no other members: a shared goal needs people first
		await mockApi.setCircle(solo.user.id, [solo.user.id]);
		await actAs(context, mockApi, solo);

		await gotoHydrated('/circle');
		await expect(page.getByRole('heading', { name: 'Start an Expedition' })).toBeVisible({
			timeout: 15000
		});
		// the start button flips to an invite prompt and opens the invite modal
		const inviteStart = page.getByRole('button', { name: 'Invite Friends to Start' });
		await expect(inviteStart).toBeVisible();
		await inviteStart.click();
		await expect(page.getByText('An expedition is a shared goal.')).toBeVisible({ timeout: 12000 });
	});
});
