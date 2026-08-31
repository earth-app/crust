import type { Page } from '@playwright/test';
import {
	avatarStates,
	expectNoPlaceholderWobble,
	FALLBACK_SRC,
	PHOTO_ROUTE,
	readAvatarTrace,
	servePhoto,
	servePhotoMissing,
	traceAvatars
} from '../utils/avatar-trace';
import { expect, integrationMode, skipIfIntegration, test } from '../utils/fixtures';
import { MANTLE_PORT } from '../utils/mock-server';

/**
 * The header and the home hero both render `avatar128`, and six mount handlers call
 * `fetchAvatarBlobs` directly. While the store cleared its failure flags on entry, every one of
 * those mounts republished "we don't know yet" over a verdict already reached - so the avatar
 * swung between the placeholder and an untested remote url that renders as an empty circle.
 *
 * These record the whole src sequence across navigation rather than sampling one moment, because
 * a flicker is a transition and no single assertion can see it.
 */

function photoUser(testId: string) {
	const id = `pp-${testId.slice(0, 8)}`;
	return {
		id,
		username: `photo-${testId.slice(0, 6)}`,
		full_name: 'Pho To',
		account: { avatar_url: `http://127.0.0.1:${MANTLE_PORT}/v2/users/${id}/profile_photo` }
	};
}

const navAvatar = (page: Page) => page.locator('header img, nav img').first();

async function settle(page: Page) {
	await expect(navAvatar(page)).toBeVisible({ timeout: 12_000 });
	await page.waitForTimeout(2_000);
}

// the home widget calls fetchAvatarBlobs for every row, bypassing safeUrl's retry gate, so the
// signed-in user has to be ON the board for the header's own url to get re-probed.
// intercepted at the page rather than on the shared mock server, whose overrides are reset
// globally between tests and so cannot survive a parallel run
async function seedLeaderboardWith(page: Page, userId: string) {
	await page.route(/\/api\/user\/leaderboard/, async (route) => {
		// the route normalises to a flat { id, streak } list before the client sees it
		return route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify([
				{ id: userId, streak: 1500 },
				{ id: 'author-1', streak: 1200 },
				{ id: 'host-1', streak: 900 }
			])
		});
	});
}

async function navigateInApp(page: Page, label: string) {
	await page.locator(`header a[href="${label}"], nav a[href="${label}"]`).first().click();
	await expect(page).toHaveURL(new RegExp(`${label}/?$`), { timeout: 12_000 });
	await settle(page);
}

test.describe('Avatar flicker', () => {
	test.beforeEach(async ({ page }) => {
		skipIfIntegration('drives injected profile_photo failures');
		await traceAvatars(page);
	});

	test('a user with no photo settles on the placeholder and stays there', async ({
		page,
		asUser,
		testId,
		gotoHydrated
	}) => {
		const counts = await servePhotoMissing(page);
		const user = photoUser(testId);
		// the home page's leaderboard widget probes every row's avatar_url directly on mount,
		// so putting the signed-in user on the board is what re-probes the header's own url
		await seedLeaderboardWith(page, user.id);
		await asUser(user);

		await gotoHydrated('/');
		await settle(page);

		// the verdict is reached once per page load: three sizes, no retry on a 4xx. every mount
		// handler after that must read the settled state rather than re-probing
		const afterFirstLoad = counts.fetches;
		expect(afterFirstLoad).toBeLessThanOrEqual(3);
		await page.waitForTimeout(4_000);
		expect(counts.fetches, 'the endpoint was re-probed after settling').toBe(afterFirstLoad);

		// walk the app WITHOUT reloading: a reload rebuilds the store, so a settled verdict would
		// never meet the mount handlers that re-probe it
		await navigateInApp(page, '/activities');
		await navigateInApp(page, '/prompts');
		await navigateInApp(page, '/');

		// and then the refreshes the user said did not help
		await gotoHydrated('/');
		await settle(page);

		const trace = await readAvatarTrace(page);
		expect(trace.length, 'no avatar src was recorded').toBeGreaterThan(0);
		expectNoPlaceholderWobble(trace);

		await expect(navAvatar(page)).toHaveAttribute('src', FALLBACK_SRC);
	});

	test('a healthy photo never shows the placeholder at any point', async ({
		page,
		asUser,
		testId,
		gotoHydrated
	}) => {
		await servePhoto(page);
		await asUser(photoUser(testId));

		await gotoHydrated('/');
		await settle(page);
		await navigateInApp(page, '/activities');
		await navigateInApp(page, '/prompts');
		await navigateInApp(page, '/');

		const trace = await readAvatarTrace(page);
		expect(trace.filter((entry) => FALLBACK_SRC.test(entry.src))).toEqual([]);
		expectNoPlaceholderWobble(trace);

		await expect
			.poll(async () => navAvatar(page).evaluate((el: HTMLImageElement) => el.naturalWidth), {
				timeout: 12_000
			})
			.toBeGreaterThan(0);
	});

	test('a transient failure never degrades to the placeholder', async ({
		page,
		asUser,
		testId,
		gotoHydrated
	}) => {
		await servePhoto(page, 99, 503);
		await asUser(photoUser(testId));

		await gotoHydrated('/');
		await settle(page);
		await navigateInApp(page, '/activities');
		await navigateInApp(page, '/prompts');
		await navigateInApp(page, '/');

		const trace = await readAvatarTrace(page);
		expect(trace.filter((entry) => FALLBACK_SRC.test(entry.src))).toEqual([]);
		expectNoPlaceholderWobble(trace);
	});

	test('each avatar element takes at most a couple of srcs over a whole session', async ({
		page,
		asUser,
		testId,
		gotoHydrated
	}) => {
		await servePhoto(page, 3);
		await asUser(photoUser(testId));

		await gotoHydrated('/');
		await settle(page);
		await navigateInApp(page, '/activities');
		await navigateInApp(page, '/prompts');
		await navigateInApp(page, '/');

		const trace = await readAvatarTrace(page);
		const ids = [...new Set(trace.map((entry) => entry.id))];
		expect(ids.length).toBeGreaterThan(0);

		for (const id of ids) {
			const states = avatarStates(trace, id);
			// remote url, then at most one settle (blob or placeholder). more is oscillation
			expect(states.length, `img#${id}: ${states.join(' -> ')}`).toBeLessThanOrEqual(2);
		}
	});
});

test.describe('Avatar against the real backend', () => {
	test.skip(!integrationMode, 'integration lane only');

	test('the published avatar_url is routable and renders bytes', async ({
		page,
		asUser,
		gotoHydrated
	}) => {
		await traceAvatars(page);
		await asUser();

		const statuses: number[] = [];
		page.on('response', (res) => {
			if (PHOTO_ROUTE.test(res.url())) statuses.push(res.status());
		});

		await gotoHydrated('/');
		await settle(page);

		await expect.poll(() => statuses.length, { timeout: 15_000 }).toBeGreaterThan(0);
		// a 404 here means the url the API publishes does not match the route it points at
		expect(statuses.filter((status) => status >= 400)).toEqual([]);
		expectNoPlaceholderWobble(await readAvatarTrace(page));
	});
});
