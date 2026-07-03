import { expect, skipIfIntegration, test } from '../utils/fixtures';

const PRIMITIVE_URL = '/__test__/widget-harness?primitives=1';

async function open(page: any) {
	await page.goto(PRIMITIVE_URL, { waitUntil: 'domcontentloaded' });
	await expect(page.getByTestId('harness-ready')).toHaveText('ready', { timeout: 20_000 });
	await expect(page.getByTestId('primitive-mount')).toBeVisible({ timeout: 15_000 });
}

test.describe('Animation primitives (motion on)', () => {
	test('SparkleBurst paints a canvas when triggered', async ({ asUser, page }) => {
		skipIfIntegration('primitive harness is a mock-only test page');
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await asUser();
		await open(page);

		// canvas is absent until a burst fires
		await expect(page.locator('[data-testid="primitive-mount"] canvas')).toHaveCount(0);
		await page.getByTestId('sparkle-trigger').click();
		await expect(page.locator('[data-testid="primitive-mount"] canvas')).toHaveCount(1, {
			timeout: 5_000
		});
	});

	test('PulseRing renders the animated ring', async ({ asUser, page }) => {
		skipIfIntegration('primitive harness is a mock-only test page');
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await asUser();
		await open(page);
		await expect(page.locator('.pulse-ring-anim')).toBeVisible({ timeout: 8_000 });
	});

	test('CountUp lands on its final value', async ({ asUser, page }) => {
		skipIfIntegration('primitive harness is a mock-only test page');
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await asUser();
		await open(page);
		await page.getByTestId('countup-trigger').click();
		await expect(page.getByTestId('countup-target')).toHaveText(/500/, { timeout: 8_000 });
	});

	test('AnimatedGradientBorder renders its rotating ring', async ({ asUser, page }) => {
		skipIfIntegration('primitive harness is a mock-only test page');
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await asUser();
		await open(page);
		await expect(page.locator('.gradient-border-ring')).toHaveCount(1, { timeout: 8_000 });
	});
});

test.describe('Animation primitives (reduced motion)', () => {
	test('SparkleBurst does not paint, PulseRing/GradientRing are skipped, CountUp still lands', async ({
		asUser,
		page
	}) => {
		skipIfIntegration('primitive harness is a mock-only test page');
		// emulate before navigation so useMediaQuery reads the reduced preference on mount
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await asUser();
		await open(page);

		// sanity: the reduced-motion emulation actually reached the page
		const matches = await page.evaluate(
			() => window.matchMedia('(prefers-reduced-motion: reduce)').matches
		);
		expect(matches).toBe(true);

		// sparkle burst is suppressed - no canvas even after a trigger
		await page.getByTestId('sparkle-trigger').click();
		await page.waitForTimeout(500);
		await expect(page.locator('[data-testid="primitive-mount"] canvas')).toHaveCount(0);

		// pulse ring + gradient ring elements are not rendered under reduced motion
		await expect(page.locator('.pulse-ring-anim')).toHaveCount(0);
		await expect(page.locator('.gradient-border-ring')).toHaveCount(0);

		// countup still shows the value (it just jumps instead of animating)
		await page.getByTestId('countup-trigger').click();
		await expect(page.getByTestId('countup-target')).toHaveText(/500/, { timeout: 8_000 });
	});
});
