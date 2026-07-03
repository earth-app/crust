import { expect, skipIfIntegration, test } from '../utils/fixtures';
import { makeActiveQuest, makeQuestDefinition, makeQuestStep } from '../utils/mock-data';
import {
	QUEST_HARNESS,
	expectQuestComplete,
	longAnswer,
	openQuestModal,
	openStep,
	seedActiveQuest,
	stubQuestUpdate,
	submitDescribeText,
	waitForHarnessReady
} from '../utils/quest-helpers';

test.describe('Quest completion overlay', () => {
	test('completing the last step shows the title, points, and a working close', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		const user = await asUser();
		const quest = makeQuestDefinition({
			title: 'The Final Step',
			reward: 50,
			steps: [makeQuestStep({ type: 'describe_text', description: 'Wrap it up' })]
		});
		await seedActiveQuest(mockApi, user.id, makeActiveQuest({ quest, progress: [] }));
		await stubQuestUpdate(mockApi, user.id, { validated: true, completed: true });

		await gotoHydrated(QUEST_HARNESS);
		await waitForHarnessReady(page);
		await openQuestModal(page);
		await openStep(page, 0, 0);

		await submitDescribeText(page, longAnswer(220));

		await expectQuestComplete(page);
		// overlay shows the quest title and counts the reward up to +50
		const overlay = page.getByRole('alertdialog');
		await expect(overlay.getByText('The Final Step')).toBeVisible();
		await expect(overlay.getByText('+50')).toBeVisible({ timeout: 8_000 });
		await expect(overlay.getByText('Impact Points')).toBeVisible();

		await page.getByTestId('celebration-close').click();
		await expect(overlay).toBeHidden({ timeout: 8_000 });
	});
});

test.describe('Completed-quest timeline state', () => {
	test('a quest in history renders the timeline as completed', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		const user = await asUser();
		const quest = makeQuestDefinition({
			title: 'Already Done',
			reward: 50,
			steps: [makeQuestStep({ type: 'describe_text', description: 'Past Step' })]
		});
		// no longer the active quest, so questId differs from quest.id
		const active = makeActiveQuest({ quest, progress: [] });
		active.questId = 'a-different-active-quest';
		await seedActiveQuest(mockApi, user.id, active);
		// the store reads res.data.history (a questId-keyed object), not items, so seed that
		// shape directly here; the shared seedQuestHistory only fills `items` (see report)
		await mockApi.set({
			method: 'GET',
			path: `^/v2/users/${user.id}/quest/history`,
			body: {
				total: 1,
				page: 1,
				limit: 25,
				items: [],
				history: { [quest.id]: { quest, completedAt: Date.now() } }
			},
			once: false
		});

		await gotoHydrated(QUEST_HARNESS);
		await waitForHarnessReady(page);
		await openQuestModal(page);

		await expect(page.locator('#quest-button')).toHaveText('Quest Completed', { timeout: 8_000 });
	});
});
