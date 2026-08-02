import { collectLayout, plantDefects, settle } from './utils/a11y-helpers';
import { expect, test } from './utils/fixtures';

/*
 * Layout quality on the surfaces every visitor sees.
 *
 * crust is not phone-only, so each surface is measured at BOTH ends of the viewport range: a
 * container that behaves at 1440px can still overflow at 360px, and a tap target that clears 24px
 * on desktop can collapse once the row wraps. The `.responsive.spec.ts` suffix routes this file to
 * the Pixel 7 project (chromium ignores that suffix), so the widths are driven in-test rather than
 * by adding another playwright project.
 */

const SURFACES = ['/', '/activities', '/articles', '/events', '/about'];
const WIDTHS = [
	{ name: 'phone', width: 360, height: 800 },
	{ name: 'desktop', width: 1440, height: 900 }
];

test.describe('layout quality', () => {
	// the settle poll plus a full-document geometry pass is slow under 4-way parallelism
	test.slow();

	for (const path of SURFACES) {
		test(`${path} has usable targets, no overflow and no clipped text`, async ({
			page,
			asAnonymous,
			gotoHydrated
		}) => {
			await asAnonymous();

			for (const vp of WIDTHS) {
				await page.setViewportSize({ width: vp.width, height: vp.height });
				await gotoHydrated(path);
				await settle(page);

				const report = await collectLayout(page);

				// a surface that measured nothing is a broken test, not a passing one
				expect(
					report.counted,
					`${path} @${vp.name} exposed no interactive boxes to measure`
				).toBeGreaterThan(0);

				// soft so one run reports every violation on the surface instead of the first
				expect
					.soft(report.undersized, `${path} @${vp.name}: targets under 24x24 (SC 2.5.8)`)
					.toEqual([]);
				expect
					.soft(report.overflowing, `${path} @${vp.name}: elements past the viewport edge`)
					.toEqual([]);
				expect
					.soft(report.clipped, `${path} @${vp.name}: text taller than its own box`)
					.toEqual([]);
				expect
					.soft(report.documentScrolls, `${path} @${vp.name}: document scrolls sideways`)
					.toBe(false);
			}
		});
	}

	test('the detectors actually fire', async ({ page, asAnonymous, gotoHydrated }) => {
		// without this the whole gate could silently degrade to a no-op and still look green
		await asAnonymous();
		await gotoHydrated('/about');
		await settle(page);

		const before = await collectLayout(page);
		await plantDefects(page);
		const after = await collectLayout(page);

		// each planted defect must move its own counter, whatever the page already had
		expect(after.undersized.length, 'undersized detector').toBeGreaterThan(
			before.undersized.length
		);
		expect(after.overflowing.length, 'overflow detector').toBeGreaterThan(
			before.overflowing.length
		);
		expect(after.clipped.length, 'clipping detector').toBeGreaterThan(before.clipped.length);
	});
});
