import { actAs, makeActor, registerActors } from '../utils/feature-helpers';
import { expect, skipIfIntegration, test } from '../utils/fixtures';
import {
	longAnswer,
	seedActiveQuest,
	stubQuestUpdate,
	submitDescribeText
} from '../utils/quest-helpers';

// Curiosity Trails: browse a themed catalog, accept a trail with an if-then pledge,
// then run each step (a curiosity clue -> the action -> an awe reveal). Nature Minutes
// are credited toward a personal weekly ring that is framed as a personal best and is
// never compared against anyone.
test.describe('Curiosity Trails - browse, pledge, run, Nature Minutes', () => {
	test('browse -> theme filter -> if-then pledge -> curiosity clue', async ({
		page,
		context,
		mockApi,
		testId,
		gotoHydrated
	}) => {
		skipIfIntegration('drives the seeded trail catalog');

		const walker = makeActor(testId, 'walker');
		await registerActors(mockApi, walker);
		await actAs(context, mockApi, walker);

		await gotoHydrated('/trails');
		// browse: the seeded catalog renders
		await expect(page.getByRole('heading', { name: 'Neighborhood Wonders' })).toBeVisible({
			timeout: 15000
		});
		// the Nature Minutes ring is framed as personal, never compared
		await expect(page.getByText('Personal, Never Compared')).toBeVisible();

		// theme filter narrows the catalog client-side
		await page.getByRole('button', { name: 'Curiosity', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Hidden Histories' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Neighborhood Wonders' })).toHaveCount(0);
		await page.getByRole('button', { name: 'All', exact: true }).click();

		// open the first trail's runner and make the if-then pledge
		await page.getByRole('button', { name: 'Begin Trail' }).first().click();
		await expect(page.getByRole('heading', { name: 'Make Your Pledge' })).toBeVisible({
			timeout: 12000
		});
		const accept = page.getByRole('button', { name: 'Accept & Begin' });
		// the pledge cannot be accepted until a trigger ("when") is set
		await expect(accept).toBeDisabled();
		await page.getByPlaceholder('I finish my morning coffee').fill('I finish lunch');
		await expect(accept).toBeEnabled();
		await accept.click();
		await expect(page.getByText(/Your Pledge: when I finish lunch/)).toBeVisible({
			timeout: 12000
		});

		// open the first step: it opens with a curiosity clue before the action
		await page.locator('#tile-0\\:0').click();
		await expect(page.getByRole('heading', { name: 'A Curious Clue' })).toBeVisible({
			timeout: 12000
		});
		await expect(page.getByRole('button', { name: "I'm Ready" })).toBeVisible();
	});

	test('run a step end to end: clue -> action -> reveal -> Nature Minutes tick up', async ({
		page,
		context,
		mockApi,
		testId,
		gotoHydrated
	}) => {
		skipIfIntegration('drives the trail runner + seeded quest progress');

		const walker = makeActor(testId, 'walker');
		await registerActors(mockApi, walker);
		await actAs(context, mockApi, walker);

		// treat trail-1's run as the active quest so its step interface unlocks,
		// and stub the server-side step validation to succeed
		const stepDef = {
			type: 'describe_text',
			description: 'Describe one thing you notice around you.',
			parameters: [0, 0, 20, 800],
			icon: 'i-lucide-pen-line'
		};
		await seedActiveQuest(mockApi, walker.user.id, {
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
		await stubQuestUpdate(mockApi, walker.user.id, { validated: true, completed: false });

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

		// clue -> action
		await page.locator('#tile-0\\:0').click();
		await expect(page.getByRole('heading', { name: 'A Curious Clue' })).toBeVisible({
			timeout: 12000
		});
		await page.getByRole('button', { name: "I'm Ready" }).click();

		// action: submit the describe_text step
		await submitDescribeText(page, longAnswer());

		// reveal: the awe payoff + the Nature Minutes credit
		await expect(page.getByRole('heading', { name: 'The Reveal' })).toBeVisible({ timeout: 15000 });
		await expect(page.getByText('+15 Nature Minutes Credited')).toBeVisible();
		await page.getByRole('button', { name: 'Finish Trail' }).click();

		// close the runner and confirm the page ring shows the new-personal-best framing
		// (the +15 credit was already asserted at the reveal; a fresh best renders "Your Longest Yet")
		await page.getByRole('button', { name: 'Close Trail' }).click();
		await expect(page.locator('#main-content').getByText('Your Longest Yet')).toBeVisible({
			timeout: 12000
		});
	});
});
