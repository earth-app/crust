/**
 * Cross-cutting performance assertions.
 *
 * Each page should hydrate within a budget. Failing one of these is a signal
 * that an SSR data fetch, hydration mismatch, or large bundle has regressed
 * performance for that route.
 *
 * Budgets are mode-dependent: in `PLAYWRIGHT_PROD=1` we run against the
 * pre-built bundle and use realistic numbers (1-2s for static pages, 3-4s for
 * ISR pages). In dev mode (Vite compile-on-demand) we 3x everything to avoid
 * false positives on cold compiles - these budgets still catch a 30s
 * regression, but they don't penalize a 7s cold compile that has nothing to
 * do with the code being tested.
 */

import { expect, integrationMode, test } from './utils/fixtures';

const PROD = process.env.PLAYWRIGHT_PROD === '1';
const COVERAGE = process.env.COVERAGE === '1';
// Overhead factors stack: cold-compile, real-backend round-trips, and V8 JS
// coverage instrumentation each add real per-page cost (often 50-100% on
// top), and a CI run can hit more than one. Multiplying keeps the test
// meaningful - catches a 25s+ regression - without chasing flake on a
// shared 4-worker runner. Without the COVERAGE multiplier, prerendered
// pages like /terms-of-service trip the 3s budget on instrumented runs
// where the page itself takes ~1.5s.
const scale = (ms: number): number => {
	let factor = 1;
	if (!PROD) factor *= 3;
	else if (integrationMode) factor *= 3;
	if (COVERAGE) factor *= 2;
	return ms * factor;
};

const PUBLIC_ROUTES: Array<{ path: string; budgetMs: number }> = [
	{ path: '/', budgetMs: scale(4_000) },
	{ path: '/about', budgetMs: scale(3_000) },
	{ path: '/terms-of-service', budgetMs: scale(3_000) },
	{ path: '/privacy-policy', budgetMs: scale(3_000) },
	{ path: '/activities', budgetMs: scale(4_000) },
	{ path: '/articles', budgetMs: scale(4_000) },
	{ path: '/events', budgetMs: scale(4_000) },
	{ path: '/prompts', budgetMs: scale(4_000) }
];

test.describe('Page hydration performance budgets', () => {
	for (const route of PUBLIC_ROUTES) {
		test(`navigates to ${route.path} under ${route.budgetMs}ms`, async ({
			gotoHydrated,
			asAnonymous
		}) => {
			await asAnonymous();
			const start = Date.now();
			await gotoHydrated(route.path);
			expect(Date.now() - start).toBeLessThan(route.budgetMs);
		});
	}
});

test.describe('Performance metrics - DOMContentLoaded budget', () => {
	test('homepage DOMContentLoaded within budget', async ({ page, gotoHydrated, asAnonymous }) => {
		await asAnonymous();
		await gotoHydrated('/');
		const dcl = await page.evaluate(() => {
			const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
			return nav?.domContentLoadedEventEnd ?? 0;
		});
		expect(dcl).toBeGreaterThan(0);
		expect(dcl).toBeLessThan(scale(2_000));
	});
});
