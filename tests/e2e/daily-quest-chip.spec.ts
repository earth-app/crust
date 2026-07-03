import { expect, skipIfIntegration, test } from './utils/fixtures';

const DAILY_QUEST_ID = 'q-daily-chip';
const DAILY_QUEST_TITLE = 'Daily Explorer';

// a single plain (non-premium, non-mobile) quest -> the deterministic pick is unambiguous
async function seedQuestPool(mockApi: any) {
	await mockApi.set({
		method: 'GET',
		path: '^/v2/users/quests$',
		body: {
			total: 1,
			quests: [
				{
					id: DAILY_QUEST_ID,
					title: DAILY_QUEST_TITLE,
					description: 'A quest for the chip test.',
					icon: 'mdi:compass-rose',
					rarity: 'normal',
					steps: [],
					reward: 25
				}
			]
		},
		once: false
	});
}

// the UTC date key the composable derives - keep in lockstep with useDailyQuest
function utcDateKey(): string {
	const now = new Date();
	const y = now.getUTCFullYear();
	const m = String(now.getUTCMonth() + 1).padStart(2, '0');
	const d = String(now.getUTCDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

test.describe('Daily quest chip (logged in)', () => {
	test("logged-in user with a quest pool sees the Today's Quest chip", async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('relies on a seeded quest pool override');

		await asUser();
		await seedQuestPool(mockApi);

		await gotoHydrated('/');

		const chip = page.locator('#daily-quest-chip');
		await expect(chip).toBeVisible({ timeout: 12_000 });
		// the chip title carries the quest name ("Today's Quest: <title>")
		await expect(chip).toHaveAttribute('title', new RegExp(`Today's Quest: ${DAILY_QUEST_TITLE}`));
	});

	test('anonymous visitor sees no daily-quest chip', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/');
		// chip is inside the logged-in NavBar branch only
		await expect(page.locator('#daily-quest-chip')).toHaveCount(0);
	});

	test('tapping the chip sets the tapped flag and opens the quest', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('relies on a seeded quest pool override');

		await asUser();
		await seedQuestPool(mockApi);

		await gotoHydrated('/');

		const chip = page.locator('#daily-quest-chip');
		await expect(chip).toBeVisible({ timeout: 12_000 });

		// not tapped yet today
		const key = `daily_quest_tapped:${utcDateKey()}`;
		const before = await page.evaluate((k) => window.localStorage.getItem(k), key);
		expect(before).toBeNull();

		await chip.click();

		// navigates to the quests page with the quest queued to open
		await expect(page).toHaveURL(new RegExp(`/profile/quests/?\\?open=${DAILY_QUEST_ID}`));

		// the tap flag is persisted so the pulse won't reappear today
		const after = await page.evaluate((k) => window.localStorage.getItem(k), key);
		expect(after).toBe('1');
	});

	test('an already-tapped flag persists across a reload', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('relies on a seeded quest pool override');

		await asUser();
		await seedQuestPool(mockApi);

		// pre-seed the tapped flag before the app reads it
		const key = `daily_quest_tapped:${utcDateKey()}`;
		await page.goto('/');
		await page.evaluate((k) => window.localStorage.setItem(k, '1'), key);

		await gotoHydrated('/');

		// chip still renders (tap only controls the pulse, not chip presence)
		await expect(page.locator('#daily-quest-chip')).toBeVisible({ timeout: 12_000 });
		const flag = await page.evaluate((k) => window.localStorage.getItem(k), key);
		expect(flag).toBe('1');
	});
});
