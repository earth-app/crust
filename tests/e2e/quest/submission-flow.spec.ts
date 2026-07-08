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
	stubQuestUpdateError,
	submitDescribeText,
	waitForHarnessReady
} from '../utils/quest-helpers';

// the descriptive 5xx copy comes verbatim from Submission.vue's describeSubmitFailure()
const FIVE_XX_COPY = /server had a problem saving this step|error 500|progress wasn't lost/i;
// the sparkle burst is a short-lived aria-hidden canvas in the step modal body; the drawing
// SketchCanvas canvas is NOT aria-hidden, so this only ever matches the celebration burst
const SPARKLE = 'canvas[aria-hidden="true"]';

const describeTextQuest = (steps = 1) =>
	makeQuestDefinition({
		title: 'Flow Quest',
		reward: 50,
		steps: Array.from({ length: steps }, (_, i) =>
			makeQuestStep({ type: 'describe_text', description: `Step ${i + 1}` })
		)
	});

const drawQuest = () =>
	makeQuestDefinition({
		title: 'Sketch Quest',
		reward: 50,
		steps: [makeQuestStep({ type: 'draw_picture', description: 'Draw something' })]
	});

test.describe('Quest submission flow: happy path', () => {
	test('a validated submit fires the sparkle burst, closes the step, and advances the timeline', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		// motion must be allowed for the sparkle canvas to mount
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		const user = await asUser();
		const quest = describeTextQuest(2);
		await seedActiveQuest(mockApi, user.id, makeActiveQuest({ quest, progress: [] }));
		// non-final step: validated but not quest-completing, so we see the per-step burst + advance
		await stubQuestUpdate(mockApi, user.id, { validated: true, completed: false });

		await gotoHydrated(QUEST_HARNESS);
		await waitForHarnessReady(page);
		await openQuestModal(page);
		await openStep(page, 0, 0);

		// arm the sparkle catch before submitting - it mounts the moment the trigger increments
		// and is torn down when the step modal auto-closes ~650ms later
		const sawSparkle = page
			.locator(SPARKLE)
			.first()
			.waitFor({ state: 'attached', timeout: 8_000 })
			.then(() => true)
			.catch(() => false);

		await submitDescribeText(page, longAnswer(220));

		expect(await sawSparkle).toBe(true);
		// the step modal auto-closes on success (the interactive body unmounts)...
		await expect(page.getByPlaceholder('Type your answer here...')).toBeHidden({ timeout: 8_000 });
		// ...the timeline advanced: one step is now recorded as complete...
		await expect(page.getByTestId('completed-step-count')).toHaveText('1', { timeout: 8_000 });
		// ...and this non-final step raised NO quest-complete overlay
		await expect(page.getByRole('alertdialog')).toBeHidden();
	});

	test('completing the final step fires the Quest Complete celebration overlay', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		const user = await asUser();
		const quest = describeTextQuest(1);
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
});

test.describe('Quest submission flow: failure edge cases', () => {
	// draw_picture routes through Submission.vue's own submitPhoto() - the code path that carries
	// describeSubmitFailure. describe_text/match/order delegate submission to their child
	// components, which have separate error handling, so they can't exercise this copy. A blank
	// SketchCanvas Confirm produces a valid image File without needing a real drawing gesture.
	test('a 5xx surfaces the reassuring server-error copy, with no celebration and no advance', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		const user = await asUser();
		const quest = drawQuest();
		await seedActiveQuest(mockApi, user.id, makeActiveQuest({ quest, progress: [] }));
		await stubQuestUpdateError(mockApi, user.id, { status: 500 });

		await gotoHydrated(QUEST_HARNESS);
		await waitForHarnessReady(page);
		await openQuestModal(page);
		await openStep(page, 0, 0);

		// blank-canvas Confirm -> submitPhoto. client image moderation fail-opens (<= 8s) before the
		// request reaches the stubbed 500, so allow generous headroom on the error assertion.
		await page.getByRole('button', { name: 'Confirm' }).click();

		await expect(page.getByText(FIVE_XX_COPY).first()).toBeVisible({ timeout: 15_000 });
		// no celebration of any kind fired
		await expect(page.getByRole('alertdialog')).toBeHidden();
		await expect(page.locator(SPARKLE)).toHaveCount(0);
		// the step modal stays open + usable so the user can retry
		await expect(page.getByRole('button', { name: 'Confirm' })).toBeVisible();
		await expect(page.getByTestId('completed-step-count')).toHaveText('0');
	});

	test('a 4xx surfaces the server reason, not a raw status code, and does not celebrate', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration();
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		const user = await asUser();
		const quest = drawQuest();
		const reason = 'That drawing does not match the prompt.';
		await seedActiveQuest(mockApi, user.id, makeActiveQuest({ quest, progress: [] }));
		await stubQuestUpdateError(mockApi, user.id, { status: 400, message: reason });

		await gotoHydrated(QUEST_HARNESS);
		await waitForHarnessReady(page);
		await openQuestModal(page);
		await openStep(page, 0, 0);

		await page.getByRole('button', { name: 'Confirm' }).click();

		// the server's short reason is surfaced verbatim, never a raw "[400] /api/..." string
		await expect(page.getByText(reason).first()).toBeVisible({ timeout: 15_000 });
		await expect(page.getByText(/^\[400\]/)).toHaveCount(0);
		await expect(page.getByText(/\/api\/user\/updateQuest/)).toHaveCount(0);
		await expect(page.getByRole('alertdialog')).toBeHidden();
		await expect(page.locator(SPARKLE)).toHaveCount(0);
	});
});
