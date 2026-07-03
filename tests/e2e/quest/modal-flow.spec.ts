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

const threeStepQuest = () =>
	makeQuestDefinition({
		title: 'Trail of Three',
		description: 'A three-step warmup quest.',
		steps: [
			makeQuestStep({ type: 'describe_text', description: 'Step One' }),
			makeQuestStep({ type: 'describe_text', description: 'Step Two' }),
			makeQuestStep({ type: 'describe_text', description: 'Step Three' })
		]
	});

test.describe('Quest modal shell', () => {
	test('renders the quest header, start button, and timeline tiles', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		const user = await asUser();
		const quest = threeStepQuest();
		await seedActiveQuest(mockApi, user.id, makeActiveQuest({ quest, progress: [] }));

		await gotoHydrated(QUEST_HARNESS);
		await waitForHarnessReady(page);
		await openQuestModal(page);

		// header reads the Quest definition title + description
		await expect(page.getByRole('heading', { name: 'Trail of Three' })).toBeVisible();
		await expect(page.getByText('A three-step warmup quest.')).toBeVisible();

		// timeline start/end button + every step tile + the end medal render
		await expect(page.locator('#quest-button')).toBeVisible();
		await expect(page.locator('#tile-0\\:0')).toBeVisible();
		await expect(page.locator('#tile-1\\:0')).toBeVisible();
		await expect(page.locator('#tile-2\\:0')).toBeVisible();
		await expect(page.locator('#tile-end')).toBeVisible();
	});

	test('opening a step tile shows the step modal; Close returns to the timeline', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		const user = await asUser();
		const quest = threeStepQuest();
		await seedActiveQuest(mockApi, user.id, makeActiveQuest({ quest, progress: [] }));

		await gotoHydrated(QUEST_HARNESS);
		await waitForHarnessReady(page);
		await openQuestModal(page);

		// tile 0 is the current step (progress empty) so its interactive body renders
		await openStep(page, 0, 0);
		await expect(page.getByPlaceholder('Type your answer here...')).toBeVisible();

		// dismiss the step modal and confirm the timeline button is still there
		await page.getByRole('button', { name: 'Close' }).last().click();
		await expect(page.getByPlaceholder('Type your answer here...')).toBeHidden({ timeout: 8_000 });
		await expect(page.locator('#quest-button')).toBeVisible();
	});

	test('dismissing the modal (Escape) closes the whole quest modal', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		const user = await asUser();
		const quest = threeStepQuest();
		await seedActiveQuest(mockApi, user.id, makeActiveQuest({ quest, progress: [] }));

		await gotoHydrated(QUEST_HARNESS);
		await waitForHarnessReady(page);
		await openQuestModal(page);
		await expect(page.getByRole('heading', { name: 'Trail of Three' })).toBeVisible();

		// with no step open the fullscreen modal is dismissible, so Escape closes it
		await page.keyboard.press('Escape');
		await expect(page.locator('#quest-button')).toBeHidden({ timeout: 8_000 });
	});

	test('completed-step-count testid reflects seeded progress', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		const user = await asUser();
		const quest = threeStepQuest();
		// two of three steps already complete
		await seedActiveQuest(
			mockApi,
			user.id,
			makeActiveQuest({
				quest,
				progress: [
					makeQuestProgressEntry({ type: 'describe_text', index: 0 }),
					makeQuestProgressEntry({ type: 'describe_text', index: 1 })
				]
			})
		);

		await gotoHydrated(QUEST_HARNESS);
		await waitForHarnessReady(page);

		await expect(page.getByTestId('completed-step-count')).toHaveText('2');
	});
});
