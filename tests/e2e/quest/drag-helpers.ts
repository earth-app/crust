/**
 * Pointer-drag helpers for the quest step interaction specs (Orderer / Matcher).
 *
 * `mouseDrag` uses Playwright's real mouse (desktop chromium). `touchDrag`
 * synthesizes the pointer stream the `useLongPressDrag` composable listens for
 * (pointerdown on the source element, then pointermove/pointerup on window) with
 * `pointerType: 'touch'` — Playwright's touchscreen only taps, so this is how we
 * drive a touch drag end-to-end.
 *
 * Not a `*.spec.ts` file, so Playwright won't collect it as a test.
 */

import type { Locator, Page } from '@playwright/test';

export interface Point {
	x: number;
	y: number;
}

export async function center(locator: Locator): Promise<Point> {
	await locator.scrollIntoViewIfNeeded();
	const box = await locator.boundingBox();
	if (!box) throw new Error('locator has no bounding box (not visible?)');
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Real mouse drag: pointerdown → stepped moves → pointerup. */
export async function mouseDrag(page: Page, from: Point, to: Point, steps = 12): Promise<void> {
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	for (let i = 1; i <= steps; i++) {
		await page.mouse.move(
			from.x + ((to.x - from.x) * i) / steps,
			from.y + ((to.y - from.y) * i) / steps
		);
	}
	await page.mouse.up();
}

/**
 * Touch drag via dispatched PointerEvents. pointerdown goes to the element under
 * the start point (so the component's @pointerdown handler fires); the moves and
 * the release go to window, where the composable's listeners live.
 */
export async function touchDrag(page: Page, from: Point, to: Point, steps = 12): Promise<void> {
	await page.evaluate(
		({ from, to, steps }) => {
			const startEl = document.elementFromPoint(from.x, from.y);
			if (!startEl) throw new Error('no element under touch start point');
			const fire = (type: string, x: number, y: number, target: EventTarget) =>
				target.dispatchEvent(
					new PointerEvent(type, {
						pointerId: 1,
						pointerType: 'touch',
						isPrimary: true,
						clientX: x,
						clientY: y,
						bubbles: true,
						cancelable: true
					})
				);
			fire('pointerdown', from.x, from.y, startEl);
			for (let i = 1; i <= steps; i++) {
				fire(
					'pointermove',
					from.x + ((to.x - from.x) * i) / steps,
					from.y + ((to.y - from.y) * i) / steps,
					window
				);
			}
			fire('pointerup', to.x, to.y, window);
		},
		{ from, to, steps }
	);
}
