/**
 * Cross-cutting performance assertions.
 *
 * Each page should hydrate within a generous budget. Failing one of these is a
 * signal that an SSR data fetch, hydration mismatch, or large bundle has
 * regressed performance for that route. Budgets are deliberately loose
 * (10s for ISR pages, 6s for client-only pages) so they catch regressions
 * without false positives on a cold dev server.
 */

import { expect, test } from './utils/fixtures';

const PUBLIC_ROUTES: Array<{ path: string; budgetMs: number; loggedIn?: boolean }> = [
	{ path: '/', budgetMs: 10_000 },
	{ path: '/about', budgetMs: 8000 },
	{ path: '/terms-of-service', budgetMs: 8000 },
	{ path: '/privacy-policy', budgetMs: 8000 },
	{ path: '/activities', budgetMs: 10_000 },
	{ path: '/articles', budgetMs: 10_000 },
	{ path: '/events', budgetMs: 10_000 },
	{ path: '/prompts', budgetMs: 10_000 }
];

test.describe('Page hydration performance budgets', () => {
	for (const route of PUBLIC_ROUTES) {
		test(`navigates to ${route.path} under ${route.budgetMs}ms`, async ({
			page,
			gotoHydrated,
			asAnonymous
		}) => {
			await asAnonymous();
			const start = Date.now();
			await gotoHydrated(route.path);
			const elapsed = Date.now() - start;
			expect(elapsed).toBeLessThan(route.budgetMs);
		});
	}
});

test.describe('Performance metrics — DOMContentLoaded budget', () => {
	test('homepage DOMContentLoaded < 4s', async ({ page, gotoHydrated, asAnonymous }) => {
		await asAnonymous();
		await gotoHydrated('/');
		const dcl = await page.evaluate(() => {
			const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
			return nav?.domContentLoadedEventEnd ?? 0;
		});
		expect(dcl).toBeGreaterThan(0);
		expect(dcl).toBeLessThan(4000);
	});
});
