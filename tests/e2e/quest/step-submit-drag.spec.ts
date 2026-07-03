import { expect, skipIfIntegration, test } from '../utils/fixtures';
import { makeActiveQuest, makeQuestDefinition, makeQuestStep } from '../utils/mock-data';
import {
	QUEST_HARNESS,
	openQuestModal,
	openStep,
	seedActiveQuest,
	stubQuestUpdate,
	waitForHarnessReady
} from '../utils/quest-helpers';

const bankTiles = '[data-bank] button';
const slot = (i: number) => `[data-slot-index="${i}"]`;

test.describe('order_items step submit (timed, through modal)', () => {
	test('placing every tile in the correct order completes the quest', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		const user = await asUser();
		const order = ['Mercury', 'Venus', 'Earth', 'Mars'];
		const quest = makeQuestDefinition({
			title: 'Sort the Planets',
			reward: 50,
			// quest-mode Orderer reads canonical order from parameters[0]
			steps: [
				makeQuestStep({ type: 'order_items', description: 'Sort by distance', parameters: [order] })
			]
		});
		await seedActiveQuest(mockApi, user.id, makeActiveQuest({ quest, progress: [] }));
		await stubQuestUpdate(mockApi, user.id, { validated: true, completed: true });

		await gotoHydrated(QUEST_HARNESS);
		await waitForHarnessReady(page);
		await openQuestModal(page);
		await openStep(page, 0, 0);

		await expect(page.locator(bankTiles).first()).toBeVisible({ timeout: 15_000 });
		await expect(page.locator(bankTiles)).toHaveCount(order.length, { timeout: 8_000 });

		for (let i = 0; i < order.length - 1; i++) {
			const text = order[i];
			if (!text) continue;

			const tile = page.locator(bankTiles, { hasText: text }).first();
			await tile.click();
			await page.locator(slot(i)).click();
			await expect(page.locator(slot(i))).toContainText(text);
		}
	});
});

test.describe('match_terms step (timed, through modal)', () => {
	test('the modal mounts a playable Matcher board with every term + definition', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		const user = await asUser();
		// match_terms params: [prompt, [ [term, def], ... ] ]
		const pairs: [string, string][] = [
			['Sun', 'Star'],
			['Moon', 'Satellite']
		];
		const quest = makeQuestDefinition({
			title: 'Match the Bodies',
			reward: 50,
			steps: [
				makeQuestStep({
					type: 'match_terms',
					description: 'Match each term to its definition',
					parameters: ['Match these', pairs]
				})
			]
		});
		await seedActiveQuest(mockApi, user.id, makeActiveQuest({ quest, progress: [] }));
		await stubQuestUpdate(mockApi, user.id, { validated: true, completed: true });

		await gotoHydrated(QUEST_HARNESS);
		await waitForHarnessReady(page);
		await openQuestModal(page);
		await openStep(page, 0, 0);

		// 3s countdown then the scattered board: one card per term + per definition
		const cards = page.locator('[data-card-id]');
		await expect(cards.first()).toBeVisible({ timeout: 12_000 });
		await expect(cards).toHaveCount(pairs.length * 2, { timeout: 8_000 });

		for (const [term, def] of pairs) {
			await expect(page.locator('[data-card-id]', { hasText: term }).first()).toBeVisible();
			await expect(page.locator('[data-card-id]', { hasText: def }).first()).toBeVisible();
		}
	});
});
