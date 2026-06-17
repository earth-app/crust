/**
 * Mobile/touch interaction tests for the quest step components, driven through the
 * gated harness page at /__test__/drag-harness.
 *
 * These components are shared into the `sky` Capacitor app (via the @earth-app/crust
 * tarball), so they run in two engines: Chromium (Android System WebView + Android
 * Chrome) and WebKit (iOS WKWebView + iOS Safari). The `mobile-chromium` project
 * covers the former; run `bun run test:e2e:mobile:webkit` to also exercise the latter
 * on the same specs (gated behind PLAYWRIGHT_WEBKIT — CI installs chromium only).
 *
 * Regression net for the mobile drag rework: tiles must declare `touch-action: none`
 * (so neither the browser nor Ionic's WebView can claim the gesture as a scroll), a
 * touch drag must pick up immediately and behave like the desktop mouse drag (place,
 * eject-leaving-a-gap, tap-to-place), and Matcher must still match by touch.
 */

import { expect, test } from '../utils/fixtures';
import { center, touchDrag } from './drag-helpers';

const ORDERER = '/__test__/drag-harness?c=orderer';
const MATCHER = '/__test__/drag-harness?c=matcher';

const bankTiles = '[data-bank] button';
const slot = (i: number) => `[data-slot-index="${i}"]`;

test.describe('Orderer — mobile touch drag', () => {
	test.beforeEach(async ({ gotoHydrated, page }) => {
		await gotoHydrated(ORDERER);
		await expect(page.locator(bankTiles).first()).toBeVisible();
	});

	test('draggable tiles declare touch-action: none', async ({ page }) => {
		await expect(page.locator(bankTiles).first()).toHaveCSS('touch-action', 'none');
	});

	test('touch-drags a tile from the bank into a slot', async ({ page }) => {
		const firstTile = page.locator(bankTiles).first();
		const label = (await firstTile.textContent())!.trim();

		await touchDrag(page, await center(firstTile), await center(page.locator(slot(0))));

		await expect(page.locator(slot(0))).toContainText(label);
		await expect(page.getByTestId('emitted-order')).toHaveText(label);
		await expect(page.locator(bankTiles, { hasText: label })).toHaveCount(0);
	});

	test('touch-ejects a placed tile back to the bank, freeing the slot', async ({ page }) => {
		const label = (await page.locator(bankTiles).nth(0).textContent())!.trim();
		await touchDrag(
			page,
			await center(page.locator(bankTiles).nth(0)),
			await center(page.locator(slot(0)))
		);
		await expect(page.getByTestId('emitted-order')).toHaveText(label);

		const placed = page.locator(slot(0)).getByText(label, { exact: true });
		await touchDrag(page, await center(placed), await center(page.locator('[data-bank]')));

		await expect(page.locator(slot(0))).toContainText('Empty');
		await expect(page.getByTestId('emitted-order')).toBeEmpty();
		await expect(page.locator(bankTiles, { hasText: label })).toHaveCount(1);
	});

	test('tap to select then tap an empty slot places the tile', async ({ page }) => {
		const firstTile = page.locator(bankTiles).first();
		const label = (await firstTile.textContent())!.trim();

		await firstTile.tap();
		await page.locator(slot(1)).tap();

		await expect(page.locator(slot(1))).toContainText(label);
		await expect(page.getByTestId('emitted-order')).toHaveText(label);
	});
});

test.describe('Matcher — mobile touch', () => {
	test('counts down, then matching every pair by tapping wins', async ({ page, gotoHydrated }) => {
		await gotoHydrated(MATCHER);

		const cards = page.locator('[data-card-id]');
		await expect(cards.first()).toBeVisible({ timeout: 12_000 });

		const tapMatch = async (term: string, def: string) => {
			await page.locator('[data-card-id]', { hasText: term }).first().tap();
			await page.locator('[data-card-id]', { hasText: def }).first().tap();
		};

		await tapMatch('Sun', 'Star');
		await tapMatch('Moon', 'Satellite');

		await expect(page.getByRole('heading', { name: /All Matched/i })).toBeVisible({
			timeout: 12_000
		});
	});
});
