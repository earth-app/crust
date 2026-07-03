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

		// timed step: 3s countdown precedes the bank tiles
		await expect(page.locator(bankTiles).first()).toBeVisible({ timeout: 12_000 });

		// tap-to-place (selectBankTile -> onSlotClick) is far less flaky than a pointer
		// drag inside a modal; the last placement auto-submits and unmounts the board,
		// so only assert slot content for the non-final slots and let the win state confirm.
		for (const [i, label] of order.entries()) {
			const tile = page.locator(bankTiles, { hasText: label }).first();
			await tile.click();
			await page.locator(slot(i)).click();
			if (i < order.length - 1) await expect(page.locator(slot(i))).toContainText(label);
		}

		// deterministic modal-integration proof: the correct order drives the Orderer to
		// its win phase inside the quest modal, then it auto-submits (the "Saving
		// Progress..." spinner). This is the unique thing THIS spec covers (modal ->
		// playable Orderer -> correct tap-order -> win -> auto-submit fires).
		await expect(page.getByRole('heading', { name: 'Correct Order!' })).toBeVisible({
			timeout: 8_000
		});
		await expect(page.getByText('Saving Progress...')).toBeVisible({ timeout: 8_000 });

		// the completing-submit -> global Quest Complete overlay is NOT asserted here:
		// it proxies through the crust Nitro route to cloud, and in dev that server-side
		// hop stalls for minutes under Vite compile contention (passes fast in prod).
		// The auto-submit -> overlay path is already covered deterministically by
		// step-submit-text.spec.ts (same celebration overlay via the same route) and
		// the Orderer win transition by drag-harness.spec.ts.
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
