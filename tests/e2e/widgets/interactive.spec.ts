import { expect, skipIfIntegration, test } from '../utils/fixtures';

function harness(kind: string, testId: string, extra = '') {
	return `/__test__/widget-harness?kind=${kind}&topic=w-${testId.slice(0, 8)}${extra}`;
}

// domcontentloaded avoids waiting on the dev server's background feed fetches, which can stall 'load'
async function openHarness(page: any, url: string) {
	await page.goto(url, { waitUntil: 'domcontentloaded' });
	await expect(page.getByTestId('harness-ready')).toHaveText('ready', { timeout: 20_000 });
}

test.describe('MicroQuiz widget', () => {
	test('answering correctly reveals feedback and a Next control', async ({
		asUser,
		page,
		testId
	}) => {
		skipIfIntegration('widget harness is a mock-only test page');
		await asUser();
		await openHarness(page, harness('MicroQuiz', testId));

		await expect(page.getByText(/Quick Trivia/i)).toBeVisible({ timeout: 15_000 });
		// first default question's correct answer is "71%"
		await page.getByRole('button', { name: /71%/ }).click();
		await expect(page.getByText(/most of earth is water/i)).toBeVisible({ timeout: 8_000 });
		await expect(page.getByRole('button', { name: /^Next$/i })).toBeVisible();
	});
});

test.describe('RapidFlash widget', () => {
	test('start reveals the term/definition grid', async ({ asUser, page, testId }) => {
		skipIfIntegration('widget harness is a mock-only test page');
		await asUser();
		await openHarness(page, harness('RapidFlash', testId));

		await expect(page.getByText(/Rapid Flash Match/i)).toBeVisible({ timeout: 15_000 });
		await page.getByRole('button', { name: /Start Round/i }).click();
		// the Start CTA is replaced by the term/definition grid once the round begins
		await expect(page.getByRole('button', { name: /Start Round/i })).toHaveCount(0, {
			timeout: 8_000
		});
		// default pool includes "Biome"
		await expect(page.getByRole('button', { name: /Biome/i }).first()).toBeVisible({
			timeout: 8_000
		});
	});
});

test.describe('MicroPoll widget', () => {
	test('authed vote hits the poll endpoint and shows an aggregate', async ({
		asUser,
		page,
		testId
	}) => {
		skipIfIntegration('poll aggregate is mock-only');
		await asUser();
		await openHarness(page, harness('MicroPoll', testId));

		await expect(page.getByText(/Quick Poll/i)).toBeVisible({ timeout: 15_000 });
		// default poll options for the generic (no-activity) variant
		const first = page.getByRole('button', { name: /Plant a tree/i });
		await expect(first).toBeVisible();

		const [postResp] = await Promise.all([
			page.waitForResponse(
				(r) => /\/v2\/users\/current\/poll$/.test(r.url()) && r.request().method() === 'POST'
			),
			first.click()
		]);
		expect(postResp.status()).toBe(200);
		// authed voters see the "N votes so far" aggregate line
		await expect(page.getByText(/vote(s)? so far/i)).toBeVisible({ timeout: 8_000 });
	});

	test('anonymous vote is client-only and shows the sign-in nudge', async ({
		asAnonymous,
		page,
		testId
	}) => {
		skipIfIntegration('widget harness is a mock-only test page');
		await asAnonymous();
		await openHarness(page, harness('MicroPoll', testId));

		await expect(page.getByText(/Quick Poll/i)).toBeVisible({ timeout: 15_000 });
		await page.getByRole('button', { name: /Walk 1 mile/i }).click();
		await expect(page.getByText(/Sign in to make your vote count/i)).toBeVisible({
			timeout: 8_000
		});
	});
});

test.describe('MicroReflection widget', () => {
	test('saving a reflection persists locally and shows the saved state', async ({
		asUser,
		page,
		testId
	}) => {
		skipIfIntegration('widget harness is a mock-only test page');
		await asUser();
		await openHarness(page, harness('MicroReflection', testId));

		await expect(page.getByText(/Quick Reflection/i)).toBeVisible({ timeout: 15_000 });
		await page.getByPlaceholder(/A short thought is enough/i).fill('A calm walk this morning.');
		await page.getByRole('button', { name: /Save Reflection/i }).click();

		await expect(page.getByText(/Reflection Saved/i)).toBeVisible({ timeout: 8_000 });
		const stored = await page.evaluate(() => window.localStorage.getItem('reflections'));
		expect(stored).toContain('A calm walk this morning.');
	});
});

test.describe('ImpactTracker widget', () => {
	test('marking today complete starts a streak', async ({ asUser, page, testId }) => {
		skipIfIntegration('widget harness is a mock-only test page');
		await asUser();
		await openHarness(page, harness('ImpactTracker', testId));

		await expect(page.getByText(/Today's Impact Goal/i)).toBeVisible({ timeout: 15_000 });
		await page.getByRole('button', { name: /Mark Today Complete/i }).click();
		await expect(page.getByText(/Done for Today/i)).toBeVisible({ timeout: 8_000 });
		await expect(page.getByText(/Streak: 1 consecutive day/i)).toBeVisible();
	});
});
