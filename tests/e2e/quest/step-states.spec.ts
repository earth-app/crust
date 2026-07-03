import { expect, skipIfIntegration, test } from '../utils/fixtures';
import {
	makeActiveQuest,
	makeQuestDefinition,
	makeQuestProgressEntry,
	makeQuestStep
} from '../utils/mock-data';
import {
	QUEST_HARNESS,
	openQuestModal,
	openStep,
	seedActiveQuest,
	waitForHarnessReady
} from '../utils/quest-helpers';

test.describe('Quest step states', () => {
	test('a step from a non-active quest shows the unlock prompt', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		const user = await asUser();
		const quest = makeQuestDefinition({
			title: 'Not Yours Yet',
			steps: [makeQuestStep({ type: 'describe_text', description: 'Locked Step' })]
		});
		// questId mismatches quest.id so Timeline.isCurrentQuest is false
		const active = makeActiveQuest({ quest, progress: [] });
		active.questId = 'some-other-active-quest';
		await seedActiveQuest(mockApi, user.id, active);

		await gotoHydrated(QUEST_HARNESS);
		await waitForHarnessReady(page);
		await openQuestModal(page);
		await openStep(page, 0, 0);

		await expect(page.getByText('Start this quest to unlock the step interface.')).toBeVisible({
			timeout: 8_000
		});
	});

	test('an already-completed step shows "Already completed"', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		const user = await asUser();
		const quest = makeQuestDefinition({
			title: 'One Done',
			steps: [
				makeQuestStep({ type: 'describe_text', description: 'Finished Step' }),
				makeQuestStep({ type: 'describe_text', description: 'Next Step' })
			]
		});
		await seedActiveQuest(
			mockApi,
			user.id,
			makeActiveQuest({
				quest,
				progress: [makeQuestProgressEntry({ type: 'describe_text', index: 0 })]
			})
		);

		await gotoHydrated(QUEST_HARNESS);
		await waitForHarnessReady(page);
		await openQuestModal(page);
		// step 0 is a past (completed) tile and stays clickable
		await openStep(page, 0, 0);

		await expect(page.getByText('Already completed')).toBeVisible({ timeout: 8_000 });
	});

	test('a respond_to_prompt step shows the dedicated-interface copy', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		const user = await asUser();
		const quest = makeQuestDefinition({
			title: 'Prompt Quest',
			steps: [makeQuestStep({ type: 'respond_to_prompt', description: 'Answer the prompt' })]
		});
		await seedActiveQuest(mockApi, user.id, makeActiveQuest({ quest, progress: [] }));

		await gotoHydrated(QUEST_HARNESS);
		await waitForHarnessReady(page);
		await openQuestModal(page);
		await openStep(page, 0, 0);

		await expect(
			page.getByText('This step is completed through its dedicated interface.')
		).toBeVisible({ timeout: 8_000 });
	});

	test('an attend_event step shows the dedicated-interface copy', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		const user = await asUser();
		const quest = makeQuestDefinition({
			title: 'Event Quest',
			steps: [makeQuestStep({ type: 'attend_event', description: 'Show up to the event' })]
		});
		await seedActiveQuest(mockApi, user.id, makeActiveQuest({ quest, progress: [] }));

		await gotoHydrated(QUEST_HARNESS);
		await waitForHarnessReady(page);
		await openQuestModal(page);
		await openStep(page, 0, 0);

		await expect(
			page.getByText('This step is completed through its dedicated interface.')
		).toBeVisible({ timeout: 8_000 });
	});

	test('an article_read_time step shows the read-time progress copy', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		const user = await asUser();
		const quest = makeQuestDefinition({
			title: 'Read Quest',
			steps: [
				makeQuestStep({
					type: 'article_read_time',
					description: 'Read for a while',
					// parameters[1] is the fallback target seconds
					parameters: [null, 120]
				})
			]
		});
		// the read bar only renders when activeReadTime carries an entry for the step
		const active = makeActiveQuest({
			quest,
			progress: [],
			activeReadTime: [{ stepIndex: 0, accumulatedSeconds: 30, targetSeconds: 120 }]
		});
		await seedActiveQuest(mockApi, user.id, active);

		await gotoHydrated(QUEST_HARNESS);
		await waitForHarnessReady(page);
		await openQuestModal(page);
		await openStep(page, 0, 0);

		await expect(
			page.getByText('Keep reading to complete this step', { exact: false })
		).toBeVisible({ timeout: 8_000 });
	});

	test('a mobile_only step is intercepted by the Timeline with a mobile toast', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		const user = await asUser();
		const quest = makeQuestDefinition({
			title: 'Mobile Quest',
			steps: [
				makeQuestStep({ type: 'describe_text', description: 'Phone-only step', mobile_only: true })
			]
		});
		await seedActiveQuest(mockApi, user.id, makeActiveQuest({ quest, progress: [] }));

		await gotoHydrated(QUEST_HARNESS);
		await waitForHarnessReady(page);
		await openQuestModal(page);

		// clicking a mobile-only tile never opens the step modal; it raises a toast instead.
		// Nuxt UI renders both a visually-hidden aria-live announcer AND the visible toast
		// with the same text, so scope to the visible toast description (locator :visible)
		// to avoid a strict-mode match on the hidden announcer.
		await page.locator('#tile-0\\:0').click();
		await expect(
			page
				.locator('[data-slot="description"]:visible', {
					hasText: 'This step can only be completed in The Earth App mobile app'
				})
				.first()
		).toBeVisible({ timeout: 8_000 });
		await expect(page.getByPlaceholder('Type your answer here...')).toBeHidden();
	});
});
