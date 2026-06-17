/**
 * Desktop (mouse) interaction tests for the drag-driven quest step components,
 * driven through the gated harness page at /__test__/drag-harness.
 *
 *   - Orderer (untimed — mirrors the article quiz): place, swap, move-to-empty
 *     leaves a gap, eject back to the bank, click-to-place.
 *   - Matcher (timed quest step): countdown → drag pairs together → win.
 *
 * The mobile/touch counterpart lives in drag-harness.mobile.spec.ts.
 */

import { expect, test } from '../utils/fixtures';
import { center, mouseDrag } from './drag-helpers';

const ORDERER = '/__test__/drag-harness?c=orderer';
const MATCHER = '/__test__/drag-harness?c=matcher';

const bankTiles = '[data-bank] button';
const slot = (i: number) => `[data-slot-index="${i}"]`;

test.describe('Orderer — desktop drag', () => {
	test.beforeEach(async ({ gotoHydrated, page }) => {
		await gotoHydrated(ORDERER);
		// untimed Orderer starts in "playing" immediately, so the bank renders right away
		await expect(page.locator(bankTiles).first()).toBeVisible();
	});

	test('drags a tile from the bank into a slot', async ({ page }) => {
		const firstTile = page.locator(bankTiles).first();
		const label = (await firstTile.textContent())!.trim();

		await mouseDrag(page, await center(firstTile), await center(page.locator(slot(0))));

		await expect(page.locator(slot(0))).toContainText(label);
		await expect(page.getByTestId('emitted-order')).toHaveText(label);
		// the tile left the bank
		await expect(page.locator(bankTiles, { hasText: label })).toHaveCount(0);
	});

	test('swaps two placed tiles when one is dropped onto the other', async ({ page }) => {
		const tileA = (await page.locator(bankTiles).nth(0).textContent())!.trim();
		await mouseDrag(
			page,
			await center(page.locator(bankTiles).nth(0)),
			await center(page.locator(slot(0)))
		);

		const tileB = (await page.locator(bankTiles).nth(0).textContent())!.trim();
		await mouseDrag(
			page,
			await center(page.locator(bankTiles).nth(0)),
			await center(page.locator(slot(1)))
		);
		await expect(page.getByTestId('emitted-order')).toHaveText(`${tileA},${tileB}`);

		// drag slot 0 onto slot 1 → they swap
		const placedA = page.locator(slot(0)).getByText(tileA, { exact: true });
		await mouseDrag(page, await center(placedA), await center(page.locator(slot(1))));
		await expect(page.getByTestId('emitted-order')).toHaveText(`${tileB},${tileA}`);
	});

	test('moving a tile to an empty slot leaves the original slot empty', async ({ page }) => {
		const tile = (await page.locator(bankTiles).nth(0).textContent())!.trim();
		await mouseDrag(
			page,
			await center(page.locator(bankTiles).nth(0)),
			await center(page.locator(slot(0)))
		);
		await expect(page.locator(slot(0))).toContainText(tile);

		const placed = page.locator(slot(0)).getByText(tile, { exact: true });
		await mouseDrag(page, await center(placed), await center(page.locator(slot(2))));

		await expect(page.locator(slot(2))).toContainText(tile);
		await expect(page.locator(slot(0))).toContainText('Empty');
		await expect(page.locator(slot(0))).not.toContainText(tile);
	});

	test('ejecting a placed tile returns it to the bank and frees the slot', async ({ page }) => {
		const bankCountBefore = await page.locator(bankTiles).count();
		const tile = (await page.locator(bankTiles).nth(0).textContent())!.trim();

		await mouseDrag(
			page,
			await center(page.locator(bankTiles).nth(0)),
			await center(page.locator(slot(0)))
		);
		await expect(page.getByTestId('emitted-order')).toHaveText(tile);

		// drag it from the slot back up to the bank
		const placed = page.locator(slot(0)).getByText(tile, { exact: true });
		await mouseDrag(page, await center(placed), await center(page.locator('[data-bank]')));

		await expect(page.getByTestId('emitted-order')).toBeEmpty();
		await expect(page.locator(slot(0))).toContainText('Empty');
		await expect(page.locator(bankTiles, { hasText: tile })).toHaveCount(1);
		await expect(page.locator(bankTiles)).toHaveCount(bankCountBefore);
	});

	test('clicking a bank tile then an empty slot places it', async ({ page }) => {
		const firstTile = page.locator(bankTiles).first();
		const label = (await firstTile.textContent())!.trim();

		await firstTile.click();
		await page.locator(slot(1)).click();

		await expect(page.locator(slot(1))).toContainText(label);
		await expect(page.getByTestId('emitted-order')).toHaveText(label);
	});
});

test.describe('Matcher — desktop drag', () => {
	test('counts down, then matching every pair by dragging wins', async ({ page, gotoHydrated }) => {
		await gotoHydrated(MATCHER);

		// 3s countdown precedes the board
		const cards = page.locator('[data-card-id]');
		await expect(cards.first()).toBeVisible({ timeout: 12_000 });
		// let the scatter + entrance transition settle before reading positions
		await page.waitForTimeout(700);

		const dragMatch = async (term: string, def: string) => {
			const from = await center(page.locator('[data-card-id]', { hasText: term }).first());
			const to = await center(page.locator('[data-card-id]', { hasText: def }).first());
			await mouseDrag(page, from, to);
		};

		await dragMatch('Sun', 'Star');
		await dragMatch('Moon', 'Satellite');

		await expect(page.getByRole('heading', { name: /All Matched/i })).toBeVisible({
			timeout: 12_000
		});
	});
});
