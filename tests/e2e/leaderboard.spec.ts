import { expect, expectToast, skipIfIntegration, test } from './utils/fixtures';
import { makeUser } from './utils/mock-data';

test.describe('Leaderboard (anonymous)', () => {
	test.beforeEach(async ({ asAnonymous }) => {
		await asAnonymous();
	});

	test('renders the hero and the default Points board', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/leaderboard');
		await expect(page.getByRole('heading', { name: 'Leaderboard', exact: true })).toBeVisible();
		await expect(
			page.getByRole('heading', { name: /Points Leaderboard \(Showing 10\)/ })
		).toBeVisible({ timeout: 12_000 });
	});

	test('global board renders rows from the seeded users', async ({ page, gotoHydrated }) => {
		skipIfIntegration('asserts the seeded mock user @author; real backend has different users');
		await gotoHydrated('/leaderboard');
		await expect(page.getByText('@author').first()).toBeVisible({ timeout: 12_000 });
	});

	test('exposes scope tabs and metric toggles', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/leaderboard');
		await expect(page.getByRole('tab', { name: 'Global' })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Friends' })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Circle' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Points' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Articles' })).toBeVisible();
	});

	test('switching metric to Articles updates the heading', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/leaderboard');
		await page.getByRole('button', { name: 'Articles' }).click();
		await expect(
			page.getByRole('heading', { name: /Articles Leaderboard \(Showing 10\)/ })
		).toBeVisible({ timeout: 12_000 });
	});

	test('non-global scope prompts anonymous visitors to sign in', async ({ page, gotoHydrated }) => {
		await gotoHydrated('/leaderboard');
		await page.getByRole('tab', { name: 'Friends' }).click();
		await expect(
			page.getByText(/Sign in to see how you stack up against your friends/i)
		).toBeVisible({ timeout: 8_000 });
	});
});

test.describe('Leaderboard (logged in)', () => {
	test('friends scope renders rows with a Challenge action', async ({
		asUser,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration(
			'friends scope needs seeded friend rows (@author); real admin has no friends'
		);
		await asUser();
		await gotoHydrated('/leaderboard');
		await page.getByRole('tab', { name: 'Friends' }).click();
		await expect(page.getByText('@author').first()).toBeVisible({ timeout: 12_000 });
		await expect(page.getByRole('button', { name: 'Challenge' }).first()).toBeVisible();
	});
});

test.describe('Leaderboard scope switching (logged in)', () => {
	test('Global -> Friends -> Circle each refetches and renders its own rows', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('asserts seeded usernames and scope-specific row counts');

		// distinct usernames per scope so we can prove the board actually swapped
		const friendUser = makeUser({ id: 'author-1', username: 'friendrow' });
		const circleUser = makeUser({ id: 'host-1', username: 'circlerow' });
		await mockApi.setMany([
			{
				method: 'GET',
				path: /^\/v2\/users\/[^/]+\/leaderboard$/,
				body: {
					scope: 'friends',
					type: 'points',
					items: [{ rank: 1, value: 800, user: friendUser }],
					total: 1
				},
				once: false
			}
		]);

		await asUser();
		await gotoHydrated('/leaderboard');

		// Friends scope: scoped mantle route serves the friends rows
		await page.getByRole('tab', { name: 'Friends' }).click();
		await expect(page.getByText('@friendrow').first()).toBeVisible({ timeout: 12_000 });

		// swap the scoped route to circle rows before switching, since switching
		// to an already-loaded tab is instant but Circle has nothing cached yet
		await mockApi.set({
			method: 'GET',
			path: /^\/v2\/users\/[^/]+\/leaderboard$/,
			body: {
				scope: 'circle',
				type: 'points',
				items: [{ rank: 1, value: 500, user: circleUser }],
				total: 1
			},
			once: false
		});

		await page.getByRole('tab', { name: 'Circle' }).click();
		await expect(page.getByText('@circlerow').first()).toBeVisible({ timeout: 12_000 });

		// back to Global - resolves via the cloud proxy fan-out (seeded @author etc.)
		await page.getByRole('tab', { name: 'Global' }).click();
		await expect(
			page.getByRole('heading', { name: /Points Leaderboard \(Showing 10\)/ })
		).toBeVisible({ timeout: 12_000 });
	});
});

test.describe('Leaderboard metric switching (anonymous, global)', () => {
	test.beforeEach(async ({ asAnonymous }) => {
		await asAnonymous();
	});

	// global scope is visible to anonymous visitors, so metric switching is
	// exercisable without auth - each metric resolves a different proxy route
	test('Points -> Articles -> Prompts -> Events each updates the heading', async ({
		page,
		gotoHydrated
	}) => {
		await gotoHydrated('/leaderboard');

		const expectHeading = async (label: string) =>
			expect(
				page.getByRole('heading', { name: new RegExp(`${label} Leaderboard \\(Showing 10\\)`) })
			).toBeVisible({ timeout: 12_000 });

		await expectHeading('Points');

		await page.getByRole('button', { name: 'Articles' }).click();
		await expectHeading('Articles');

		await page.getByRole('button', { name: 'Prompts' }).click();
		await expectHeading('Prompts');

		await page.getByRole('button', { name: 'Events' }).click();
		await expectHeading('Events');
	});
});

test.describe('Leaderboard size control', () => {
	test('changing the size input refetches and updates the (Showing N) heading', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/leaderboard');

		await expect(
			page.getByRole('heading', { name: /Points Leaderboard \(Showing 10\)/ })
		).toBeVisible({ timeout: 12_000 });

		// UInputNumber starts at 10 (min 5, step 15). ArrowUp snaps to the step grid
		// anchored at min: 5, 20, 35... so 10 -> 20 (not 25), then refetches (size
		// changes force a refresh). asserting 20 matches the real snap behavior.
		const input = page.getByRole('spinbutton').first();
		await input.focus();
		await input.press('ArrowUp');

		await expect(
			page.getByRole('heading', { name: /Points Leaderboard \(Showing 20\)/ })
		).toBeVisible({ timeout: 12_000 });
	});
});

test.describe('Leaderboard challenge flow (logged in, friends scope)', () => {
	test('Challenge button opens the picker and sends a challenge', async ({
		asUser,
		mockApi,
		page,
		gotoHydrated
	}) => {
		skipIfIntegration('needs a seeded friend row + a quest to challenge with');

		const friendUser = makeUser({ id: 'author-1', username: 'challengeable' });
		await mockApi.setMany([
			// friends board with a single challengeable row (not self)
			{
				method: 'GET',
				path: /^\/v2\/users\/[^/]+\/leaderboard$/,
				body: {
					scope: 'friends',
					type: 'points',
					items: [{ rank: 1, value: 800, user: friendUser }],
					total: 1
				},
				once: false
			},
			// the challenger needs at least one quest in the picker - daily quest pool
			{
				method: 'GET',
				path: '^/v2/users/quests$',
				body: {
					total: 1,
					quests: [
						{ id: 'q-daily', title: 'Daily Explorer', icon: 'mdi:trophy', steps: [], reward: 25 }
					]
				},
				once: false
			},
			// the actual challenge POST
			{
				method: 'POST',
				path: /^\/v2\/users\/current\/quest\/challenge$/,
				status: 201,
				body: { id: 'chal-1', status: 'pending' },
				once: false
			}
		]);

		await asUser();
		await gotoHydrated('/leaderboard');

		await page.getByRole('tab', { name: 'Friends' }).click();
		await expect(page.getByText('@challengeable').first()).toBeVisible({ timeout: 12_000 });

		await page.getByRole('button', { name: 'Challenge' }).first().click();

		// picker modal: choose the seeded quest (auto-selected) and send
		await expect(page.getByText(/Pick a quest to challenge/i)).toBeVisible({ timeout: 8_000 });
		await page.getByRole('button', { name: 'Send Challenge' }).click();

		await expectToast(page, /Challenge Sent/i);
	});
});

test.describe('Leaderboard sign-in prompt (anonymous, circle scope)', () => {
	test('Circle scope prompts anonymous visitors to sign in', async ({
		asAnonymous,
		page,
		gotoHydrated
	}) => {
		await asAnonymous();
		await gotoHydrated('/leaderboard');
		await page.getByRole('tab', { name: 'Circle' }).click();
		await expect(
			page.getByText(/Sign in to see how you stack up against your circle/i)
		).toBeVisible({ timeout: 8_000 });
	});
});
