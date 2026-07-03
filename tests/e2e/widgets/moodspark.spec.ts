import { expect, skipIfIntegration, test } from '../utils/fixtures';

// unique topic per test so parallel workers never share a mood tally
function harnessUrl(testId: string, kind = 'MoodSpark') {
	return `/__test__/widget-harness?kind=${kind}&topic=mood-${testId.slice(0, 8)}`;
}

test.describe('MoodSpark widget', () => {
	test('vote POSTs to /v2/mood, toasts, and immediately shows the results bars', async ({
		asUser,
		page,
		testId
	}) => {
		skipIfIntegration('mood is mock-only (real mantle throttles by IP)');
		await asUser();
		await page.goto(harnessUrl(testId), { waitUntil: 'domcontentloaded' });
		await expect(page.getByTestId('harness-ready')).toHaveText('ready', { timeout: 20_000 });

		// before voting the emoji grid is present and the results line is absent
		const loveButton = page.getByRole('button', { name: /Vote Love/i });
		await expect(loveButton).toBeVisible({ timeout: 15_000 });
		await expect(page.getByText(/voice(s)? today/i)).toHaveCount(0);

		const [resp] = await Promise.all([
			page.waitForResponse((r) => /\/v2\/mood\//.test(r.url()) && r.request().method() === 'POST'),
			loveButton.click()
		]);
		expect(resp.status()).toBe(200);
		await expect(page.getByText(/Mood Recorded/i).first()).toBeVisible({ timeout: 8_000 });

		// results view flips in without a reload (showResults folds in myVote)
		await expect(page.getByText(/voice(s)? today/i).first()).toBeVisible({ timeout: 8_000 });
		await expect(page.getByRole('button', { name: /Vote Love/i })).toHaveCount(0);
	});

	test('after a vote, remounting the topic still shows the tally bars', async ({
		asUser,
		page,
		testId
	}) => {
		skipIfIntegration('mood is mock-only');
		await asUser();
		await page.goto(harnessUrl(testId), { waitUntil: 'domcontentloaded' });
		await expect(page.getByTestId('harness-ready')).toHaveText('ready', { timeout: 20_000 });
		await page.getByRole('button', { name: /Vote Curious/i }).click();
		await expect(page.getByText(/Mood Recorded/i).first()).toBeVisible({ timeout: 8_000 });

		// a fresh mount reads the localStorage guard and renders bars + a "voices today" line
		await page.reload();
		await expect(page.getByTestId('harness-ready')).toHaveText('ready', { timeout: 20_000 });
		await expect(page.getByText(/voice(s)? today/i).first()).toBeVisible({ timeout: 10_000 });
		await expect(page.getByRole('button', { name: /Vote Curious/i })).toHaveCount(0);
	});

	test('double-vote guard: localStorage marks the topic voted', async ({
		asUser,
		page,
		testId
	}) => {
		skipIfIntegration('mood is mock-only');
		await asUser();
		await page.goto(harnessUrl(testId), { waitUntil: 'domcontentloaded' });
		await expect(page.getByTestId('harness-ready')).toHaveText('ready', { timeout: 20_000 });

		await page.getByRole('button', { name: /Vote Good/i }).click();
		await expect(page.getByText(/Mood Recorded/i).first()).toBeVisible({ timeout: 8_000 });

		// the storage guard is what blocks a second vote; assert it's set for this topic
		const key = `mood_voted:mood-${testId.slice(0, 8)}:`;
		const marked = await page.evaluate((prefix) => {
			for (let i = 0; i < window.localStorage.length; i++) {
				const k = window.localStorage.key(i);
				if (k && k.startsWith(prefix)) return true;
			}
			return false;
		}, key);
		expect(marked).toBe(true);

		// reloading the same topic re-renders in the voted (bars) state, not the button grid
		await page.reload();
		await expect(page.getByTestId('harness-ready')).toHaveText('ready', { timeout: 20_000 });
		await expect(page.getByRole('button', { name: /Vote Good/i })).toHaveCount(0, {
			timeout: 8_000
		});
	});
});
