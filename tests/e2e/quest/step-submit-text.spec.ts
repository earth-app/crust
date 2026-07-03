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

const textQuest = (overrides: Record<string, any> = {}) =>
	makeQuestDefinition({
		title: 'Write It Down',
		reward: 50,
		steps: [makeQuestStep({ type: 'describe_text', description: 'Tell us a story', ...overrides })]
	});

test.describe('describe_text step submit', () => {
	test('valid submit (not completing) closes the step modal', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		const user = await asUser();
		const quest = textQuest();
		await seedActiveQuest(mockApi, user.id, makeActiveQuest({ quest, progress: [] }));
		await stubQuestUpdate(mockApi, user.id, { validated: true, completed: false });

		await gotoHydrated(QUEST_HARNESS);
		await waitForHarnessReady(page);
		await openQuestModal(page);
		await openStep(page, 0, 0);

		await submitDescribeText(page, longAnswer(220));

		// host unmounts the component shortly after a validated submit
		await expect(page.getByPlaceholder('Type your answer here...')).toBeHidden({ timeout: 8_000 });
		// no completion overlay on a non-final step
		await expect(page.getByRole('alertdialog')).toBeHidden();
	});

	test('completing submit fires the Quest Complete overlay; close dismisses it', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		const user = await asUser();
		const quest = textQuest();
		await seedActiveQuest(mockApi, user.id, makeActiveQuest({ quest, progress: [] }));
		await stubQuestUpdate(mockApi, user.id, { validated: true, completed: true });

		await gotoHydrated(QUEST_HARNESS);
		await waitForHarnessReady(page);
		await openQuestModal(page);
		await openStep(page, 0, 0);

		await submitDescribeText(page, longAnswer(220));

		await expectQuestComplete(page);
		await page.getByTestId('celebration-close').click();
		await expect(page.getByRole('alertdialog')).toBeHidden({ timeout: 8_000 });
	});

	test('validation failure shows the error alert and keeps the modal open', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		const user = await asUser();
		const quest = textQuest();
		await seedActiveQuest(mockApi, user.id, makeActiveQuest({ quest, progress: [] }));
		await stubQuestUpdate(mockApi, user.id, {
			validated: false,
			message: 'Your answer was off topic.'
		});

		await gotoHydrated(QUEST_HARNESS);
		await waitForHarnessReady(page);
		await openQuestModal(page);
		await openStep(page, 0, 0);

		await submitDescribeText(page, longAnswer(220));

		await expect(page.getByText('Your answer was off topic.')).toBeVisible({ timeout: 8_000 });
		// modal stays open so the user can retry
		await expect(page.getByPlaceholder('Type your answer here...')).toBeVisible();
	});

	test('Submit is disabled until the min length is met', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		const user = await asUser();
		// parameters[2] sets min length; 50 is the floor so use that
		const quest = textQuest({ parameters: [null, null, 50] });
		await seedActiveQuest(mockApi, user.id, makeActiveQuest({ quest, progress: [] }));
		await stubQuestUpdate(mockApi, user.id, { validated: true, completed: false });

		await gotoHydrated(QUEST_HARNESS);
		await waitForHarnessReady(page);
		await openQuestModal(page);
		await openStep(page, 0, 0);

		const box = page.getByPlaceholder('Type your answer here...');
		const submit = page.getByRole('button', { name: 'Submit', exact: true });

		// under the floor -> disabled + the requirement hint shows
		await box.click();
		await page.keyboard.insertText('too short');
		await expect(page.getByText('At least 50 characters required.')).toBeVisible();
		await expect(submit).toBeDisabled();

		// once over the floor the button enables
		await box.click();
		await page.keyboard.insertText('y'.repeat(60));
		await expect(submit).toBeEnabled();
	});
});
