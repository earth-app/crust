import type { Page } from '@playwright/test';

/*
 * Geometry collection for the layout gate.
 *
 * Two things have to settle before any box is measured, and both are load-bearing:
 *   - animations, because a box mid-transition reports its interpolated rect. Infinite animations
 *     (spinners) never finish, so they are skipped rather than waited on or the poll never returns.
 *   - `document.fonts.ready`, because the webfont swap reflows text and a clipping measurement
 *     taken before it is pure noise.
 *
 * Everything is then read in ONE page.evaluate so every rect comes from the same frame.
 */

export type Box = {
	selector: string;
	tag: string;
	width: number;
	height: number;
	right: number;
	disabled: boolean;
	interactive: boolean;
};

export type LayoutReport = {
	counted: number;
	viewportWidth: number;
	documentScrolls: boolean;
	undersized: string[];
	overflowing: string[];
	clipped: string[];
};

export async function settle(page: Page): Promise<void> {
	await page.waitForFunction(
		() => {
			const running = document
				.getAnimations()
				.filter((a) => a.playState === 'running')
				.filter((a) => {
					const timing = (
						a as Animation & { effect?: AnimationEffect }
					).effect?.getComputedTiming?.();
					// a spinner never completes, so waiting on it would hang the poll forever
					return timing ? timing.iterations !== Infinity : true;
				});
			return running.length === 0;
		},
		undefined,
		{ timeout: 15_000 }
	);
	await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

export async function collectLayout(page: Page): Promise<LayoutReport> {
	return page.evaluate(() => {
		const INTERACTIVE = 'a[href],button,[role="button"],input,select,textarea,summary,[tabindex]';

		function label(el: Element): string {
			const id = el.id ? `#${el.id}` : '';
			const cls = (el.getAttribute('class') || '')
				.split(/\s+/)
				.filter(Boolean)
				.slice(0, 3)
				.join('.');
			return `${el.tagName.toLowerCase()}${id}${cls ? '.' + cls : ''}`;
		}

		function hidden(el: Element): boolean {
			for (let n: Element | null = el; n; n = n.parentElement) {
				if (n.getAttribute?.('aria-hidden') === 'true') return true;
				if ((n as HTMLElement).hasAttribute?.('hidden')) return true;
				const cs = getComputedStyle(n);
				if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return true;
			}
			return false;
		}

		const vw = document.documentElement.clientWidth;
		const undersized: string[] = [];
		const overflowing: string[] = [];
		const clipped: string[] = [];
		let counted = 0;

		for (const el of Array.from(document.querySelectorAll<HTMLElement>(INTERACTIVE))) {
			if (hidden(el)) continue;
			const r = el.getBoundingClientRect();
			// a zero-height row wrapper or a toast host is not a target
			if (r.width === 0 || r.height === 0) continue;
			// the skip link is 1x1 until it takes focus, which is the whole point of it
			if (el.closest('.sr-only')) continue;

			counted++;
			const cs = getComputedStyle(el);
			const disabled = el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
			// SC 2.5.8 (AA) is 24x24 css px and exempts links that flow inline in text. computed
			// display is the real distinction: an inline <a> flows in a sentence, while a block or
			// flex one is a control that was given a box on purpose
			const inlineLink = el.tagName === 'A' && cs.display === 'inline';

			if (!disabled && !inlineLink && (r.width < 24 || r.height < 24)) {
				undersized.push(`${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
			}
		}

		for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
			if (hidden(el)) continue;
			const r = el.getBoundingClientRect();
			if (r.width === 0 || r.height === 0) continue;

			// a horizontally scrollable rail is SUPPOSED to be wider than the viewport, so only
			// flag boxes that escape without an author-declared scroll container above them
			const inScrollRail = (() => {
				// stop BELOW the document: crust sets `html, body { overflow-x: hidden }`, so walking
				// all the way up marks every element as railed and silently disables this detector
				// (the planted-defect self-check is what caught that)
				for (
					let n: Element | null = el.parentElement;
					n && n !== document.body && n !== document.documentElement;
					n = n.parentElement
				) {
					const ox = getComputedStyle(n).overflowX;
					if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true;
				}
				return false;
			})();

			if (r.right > vw + 1 && el.children.length === 0 && !inScrollRail) {
				// only the innermost offender: every ancestor stretches with it
				overflowing.push(`${label(el)} right=${Math.round(r.right)} vw=${vw}`);
			}

			const cs = getComputedStyle(el);
			const hasDirectText = Array.from(el.childNodes).some(
				(n) => n.nodeType === Node.TEXT_NODE && (n.textContent || '').trim().length > 0
			);
			const truncates =
				cs.textOverflow === 'ellipsis' ||
				(cs as unknown as { webkitLineClamp?: string }).webkitLineClamp !== 'none';

			if (
				hasDirectText &&
				cs.overflow === 'visible' &&
				!truncates &&
				!el.closest('[data-allow-clip]') &&
				el.children.length === 0
			) {
				const fontSize = parseFloat(cs.fontSize) || 16;
				const lineHeight = parseFloat(cs.lineHeight) || fontSize * 1.2;
				// css splits extra leading above and below the text, so allow a half-leading slack
				const slack = Math.max(2, (lineHeight - fontSize) / 2 + 1);
				if (el.scrollHeight > el.clientHeight + slack) {
					clipped.push(`${label(el)} scrollH=${el.scrollHeight} clientH=${el.clientHeight}`);
				}
			}
		}

		const scroller = document.scrollingElement || document.documentElement;
		return {
			counted,
			viewportWidth: vw,
			documentScrolls: scroller.scrollWidth > scroller.clientWidth + 1,
			undersized,
			overflowing,
			clipped
		};
	});
}

/** Plants one defect per detector, so a gate that has rotted into a no-op fails loudly. */
export async function plantDefects(page: Page): Promise<void> {
	await page.evaluate(() => {
		const stage = document.createElement('div');
		stage.id = 'planted-defects';
		stage.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;';
		stage.innerHTML = `
			<!-- min-*:0 opts this out of the app's own coarse-pointer 44px floor, which would
			     otherwise inflate the plant to 44x44 and leave the detector with nothing to find.
			     the plant exists to prove the DETECTOR fires, not to exercise the app's css -->
			<button style="width:20px;height:20px;min-width:0;min-height:0;padding:0;border:0">x</button>
			<div style="width:4000px;height:4px"></div>
			<p style="height:6px;line-height:20px;font-size:20px;overflow:visible;margin:0">clipped text</p>
		`;
		document.body.appendChild(stage);
	});
}
