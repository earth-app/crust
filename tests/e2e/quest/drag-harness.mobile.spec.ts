/**
 * Mobile/touch interaction tests for the Orderer quest step, driven through the
 * gated harness page at /__test__/drag-harness on a Pixel 7 (mobile-chromium
 * project — see playwright.config.ts).
 *
 * This is the regression net for the mobile drag rework: the tiles must declare
 * `touch-action: none` (so the browser can't claim the gesture as a scroll) and
 * a touch drag must pick up immediately and behave like the desktop mouse drag —
 * place into a slot, eject back to the bank leaving a gap, and tap-to-place.
 */

import { expect, test } from '../utils/fixtures';
import { center, touchDrag } from './drag-helpers';

const ORDERER = '/__test__/drag-harness?c=orderer';

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
