import { expect, skipIfIntegration, test } from '../utils/fixtures';

const KIND_HEADINGS: Record<string, RegExp> = {
	MoodSpark: /Mood Spark/i,
	MicroPoll: /Quick Poll/i,
	MicroQuiz: /Quick Trivia/i,
	ImpactTracker: /Today's Impact Goal/i,
	MicroReflection: /Quick Reflection/i,
	RapidFlash: /Rapid Flash Match/i
};

test.describe('WidgetSlot rotation', () => {
	for (const [kind, heading] of Object.entries(KIND_HEADINGS)) {
		test(`resolves the ${kind} component`, async ({ asUser, page, testId }) => {
			skipIfIntegration('widget harness is a mock-only test page');
			await asUser();
			await page.goto(`/__test__/widget-harness?kind=${kind}&topic=rot-${testId.slice(0, 8)}`, {
				waitUntil: 'domcontentloaded'
			});
			await expect(page.getByTestId('harness-ready')).toHaveText('ready', { timeout: 20_000 });
			await expect(page.getByTestId('widget-kind')).toHaveText(kind);
			await expect(page.getByText(heading).first()).toBeVisible({ timeout: 15_000 });
		});
	}

	test('activity-scoped variant is deterministic under a pinned clock', async ({
		asUser,
		page,
		testId
	}) => {
		skipIfIntegration('widget harness is a mock-only test page');
		await asUser();

		// pin the clock so dayOfYearUtc() (the variant seed) is fixed across loads
		await page.clock.setFixedTime(new Date('2026-07-02T12:00:00Z'));

		const url = `/__test__/widget-harness?kind=MoodSpark&activityId=act-1&activityName=Nature&topic=det-${testId.slice(0, 8)}`;
		await page.goto(url, { waitUntil: 'domcontentloaded' });
		await expect(page.getByTestId('harness-ready')).toHaveText('ready', { timeout: 20_000 });
		const first = await page
			.locator('[data-testid="widget-mount"] p.font-medium')
			.first()
			.innerText();

		await page.goto(url, { waitUntil: 'domcontentloaded' });
		await expect(page.getByTestId('harness-ready')).toHaveText('ready', { timeout: 20_000 });
		const second = await page
			.locator('[data-testid="widget-mount"] p.font-medium')
			.first()
			.innerText();

		expect(first).toBe(second);
		// the activity name is slotted into the mood question variant
		expect(first).toContain('Nature');
	});
});
