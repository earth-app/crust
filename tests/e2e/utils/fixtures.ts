/**
 * Playwright fixtures for E2E tests.
 *
 * Importing { test, expect } from this module gives you the standard Nuxt
 * test-utils playwright fixtures plus our project-specific extensions:
 *
 *   - mockApi: control-plane client to override backend responses
 *   - asUser / asAdmin / asAnonymous: shortcut for setting auth state
 *   - coverageCollector: per-test V8 JS coverage collection (chromium only)
 *
 * Tests should prefer importing from here over @nuxt/test-utils/playwright
 * directly so they pick up coverage, identity, and override behavior.
 */

import { test as baseTest, expect } from '@nuxt/test-utils/playwright';
import type { BrowserContext, Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { saveCoverageForTest } from './coverage';
import { MockClient } from './mock-client';
import { makeAdmin, makeUser } from './mock-data';

const __dirname = dirname(fileURLToPath(import.meta.url));
// repo root is three up from tests/e2e/utils (must match global-setup.ts)
const INTEGRATION_SESSION_FILE = resolve(__dirname, '../../../.integration-session.json');

/**
 * `true` when running against the real mantle2/cloud backends rather than the
 * in-process mocks. Specs that depend on seeded mock data can branch on this
 * via `test.skip(integrationMode, '…')`.
 */
export const integrationMode = process.env.MOCK_DISABLED === '1';

/**
 * Origin the app under test is served from. Must follow `PLAYWRIGHT_BASE_URL`
 * (see playwright.config.ts): a hardcoded `:3000` silently talks to whatever
 * else owns that port when the suite runs elsewhere.
 */
export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';

/**
 * Every tour that auto-plays via `startTourIfNew(...)` on mount. Marking them
 * all complete before the first navigation keeps the fixed-position SiteTour
 * dim/tooltip layers from intercepting clicks mid-spec. Keep in sync with the
 * `startTourIfNew` call sites in `src/`.
 */
export const AUTO_START_TOUR_IDS = [
	'trails',
	'trailmarks',
	'shared-garden',
	'verify-email',
	'notifications'
];

/**
 * Integration-mode login helper: when `MOCK_DISABLED=1` is set, the test suite
 * is running against the real mantle2 backend booted by `e2e.yml`. That
 * backend is seeded by `startup.sh` with a single admin user (admin/admin).
 *
 * mantle2 enforces aggressive rate limits on `/v2/users/login` (60 req per
 * 28-second window globally, plus a ~25s per-account cooldown between token
 * re-issues). With 152 tests × 4 workers each calling this per-test, those
 * limits get blown immediately. Instead we log in ONCE in globalSetup and
 * cache `{session_token, user}` to a temp file; every fixture invocation
 * reads that file and stamps the same cookie on its browser context - zero
 * additional login requests across the entire run.
 */
let cachedSession: { session_token: string; user: Record<string, any> } | null = null;
function loadIntegrationSession() {
	if (cachedSession) return cachedSession;
	try {
		const raw = readFileSync(INTEGRATION_SESSION_FILE, 'utf-8');
		cachedSession = JSON.parse(raw);
		return cachedSession!;
	} catch (err) {
		throw new Error(
			`[integration] cached session file not found at ${INTEGRATION_SESSION_FILE} - global-setup must run with MOCK_DISABLED=1 first. ${(err as Error).message}`
		);
	}
}

async function loginAsRealAdmin(
	context: BrowserContext,
	_overrides: Record<string, any> = {}
): Promise<Record<string, any>> {
	const session = loadIntegrationSession();
	await context.addCookies([
		{
			name: 'session_token',
			value: session.session_token,
			domain: '127.0.0.1',
			path: '/',
			sameSite: 'Lax',
			secure: false
		}
	]);
	return session.user;
}

export interface TestFixtures {
	testId: string;
	mockApi: MockClient;
	asAnonymous: () => Promise<void>;
	asUser: (overrides?: Record<string, any>) => Promise<Record<string, any>>;
	asAdmin: (overrides?: Record<string, any>) => Promise<Record<string, any>>;
	gotoHydrated: (path: string) => Promise<void>;
}

export const test = baseTest.extend<TestFixtures>({
	// One UUID per test → used to scope mock overrides + the X-Test-Id header
	testId: async ({}, use) => {
		await use(randomUUID());
	},

	// Browser context is rebuilt with a header injector + JS coverage hooks
	context: async ({ context, testId, browserName }, use) => {
		await context.setExtraHTTPHeaders({ 'x-test-id': testId });

		// Stamp X-Test-Id on every request so that requests routed through the
		// Nuxt server (which then re-fetches backend) keep the same identity.
		// We also surface it via a cookie because some Nitro routes strip headers.
		await context.addCookies([
			{
				name: 'x-test-id',
				value: testId,
				domain: '127.0.0.1',
				path: '/',
				sameSite: 'Lax'
			}
		]);

		await context.route(
			/^https?:\/\/(challenges\.cloudflare\.com|fonts\.(?:googleapis|gstatic)\.com|api\.iconify\.design|cdn\.earth-app\.com|i\.ytimg\.com|www\.youtube\.com|pixabay\.com|upload\.wikimedia\.org|en\.wikipedia\.org)\//,
			(route) => route.fulfill({ status: 204, body: '' })
		);

		// Coverage hooks - chromium only
		if (browserName === 'chromium' && process.env.COVERAGE) {
			await context.addInitScript(() => {
				// noop: presence of script ensures consistent context
			});
		}

		await context.addInitScript((ids) => {
			try {
				window.localStorage.setItem('earth_app_completed_tours', JSON.stringify(ids));
			} catch {
				// storage unavailable pre-navigation; harmless
			}
		}, AUTO_START_TOUR_IDS);

		await use(context);
	},

	// Decorate page with auto-coverage start/stop
	page: async ({ page, browserName }, use, testInfo) => {
		const coverageEnabled = browserName === 'chromium' && process.env.COVERAGE === '1';
		if (coverageEnabled) {
			await page.coverage.startJSCoverage({ resetOnNavigation: false });
		}
		await use(page);
		if (coverageEnabled) {
			try {
				const entries = await page.coverage.stopJSCoverage();
				await saveCoverageForTest(testInfo.testId, entries);
			} catch {
				// page may have been closed already
			}
		}
	},

	mockApi: async ({ testId }, use) => {
		const client = new MockClient(testId);
		try {
			const ac = new AbortController();
			const timer = setTimeout(() => ac.abort(), 3_000);
			await fetch(`${BASE_URL}/api/__test__/reset`, {
				method: 'POST',
				signal: ac.signal
			}).catch(() => {});
			clearTimeout(timer);
		} catch {
			// dev server may not be up yet on first test; non-fatal
		}
		await use(client);

		const ac = new AbortController();
		const timer = setTimeout(() => ac.abort(), 3_000);
		await client.reset({ signal: ac.signal }).catch(() => {});
		clearTimeout(timer);
	},

	asAnonymous: async ({ context, mockApi }, use) => {
		const fn = async () => {
			await mockApi.loginAs(null);
			await context.clearCookies({ name: 'session_token' });
		};
		await use(fn);
	},

	asUser: async ({ context, mockApi, testId }, use) => {
		const fn = async (overrides: Record<string, any> = {}) => {
			if (process.env.MOCK_DISABLED === '1') {
				return await loginAsRealAdmin(context, overrides);
			}

			const sessionToken = `mock-token-${testId}`;
			const user = makeUser({
				id: overrides.id ?? `test-user-${testId.slice(0, 8)}`,
				username: overrides.username ?? `testuser-${testId.slice(0, 6)}`,
				...overrides
			});
			await mockApi.registerUser(user);
			await mockApi.loginAs(user.id, sessionToken);
			await context.addCookies([
				{
					name: 'session_token',
					value: sessionToken,
					domain: '127.0.0.1',
					path: '/',
					sameSite: 'Lax',
					secure: false
				}
			]);
			return user;
		};
		await use(fn);
	},

	asAdmin: async ({ context, mockApi, testId }, use) => {
		const fn = async (overrides: Record<string, any> = {}) => {
			if (process.env.MOCK_DISABLED === '1') {
				return await loginAsRealAdmin(context, overrides);
			}
			const sessionToken = `mock-admin-token-${testId}`;
			const admin = makeAdmin({
				id: overrides.id ?? `admin-user-${testId.slice(0, 8)}`,
				username: overrides.username ?? `admin-${testId.slice(0, 6)}`,
				...overrides
			});
			await mockApi.registerUser(admin);
			await mockApi.loginAs(admin.id, sessionToken);
			await context.addCookies([
				{
					name: 'session_token',
					value: sessionToken,
					domain: '127.0.0.1',
					path: '/',
					sameSite: 'Lax',
					secure: false
				}
			]);
			return admin;
		};
		await use(fn);
	},

	gotoHydrated: async ({ page, testId }, use) => {
		const cachedPath = (p: string) =>
			/^\/$|^\/(events|articles|prompts|activities)(\/|$|\?)/.test(p);
		const fn = async (path: string) => {
			let url = path;
			if (cachedPath(path)) {
				const sep = path.includes('?') ? '&' : '?';
				url = `${path}${sep}_t=${testId.slice(0, 12)}`;
			}
			await page.goto(url, { waitUntil: 'domcontentloaded' });
			await page
				.waitForFunction(
					() =>
						typeof (window as any).useNuxtApp === 'function' &&
						(window as any).useNuxtApp().isHydrating === false,
					{ timeout: 8_000 }
				)
				.catch(() => {});

			await page
				.waitForFunction(
					() => {
						const nuxt = (window as any).useNuxtApp?.();
						if (!nuxt) return true;
						const pinia = nuxt.$pinia;
						if (!pinia) return true;
						const auth = pinia.state.value?.auth;
						if (!auth) return true;
						return auth.currentUser !== undefined && !auth.fetchPromise;
					},
					{ timeout: 8_000 }
				)
				.catch(() => {});
		};
		await use(fn);
	}
});

export { expect };

export function skipIfIntegration(reason: string = 'requires seeded mock data') {
	test.skip(integrationMode, reason);
}

export async function expectToast(page: Page, partial: string | RegExp) {
	// Nuxt UI renders toasts inside a portal with data attribute
	const matcher = typeof partial === 'string' ? new RegExp(partial, 'i') : partial;
	await expect(page.getByText(matcher).first()).toBeVisible({ timeout: 5000 });
}

export async function expectTitleContains(page: Page, partial: string) {
	await expect(page).toHaveTitle(new RegExp(partial, 'i'));
}

export async function findByRoleName(
	page: Page,
	role: Parameters<Page['getByRole']>[0],
	name: string | RegExp
) {
	return page.getByRole(role, { name }).first();
}

export async function timeNavigation(
	page: Page,
	url: string,
	waitFor: () => Promise<unknown>
): Promise<number> {
	const start = performance.now();
	await page.goto(url);
	await waitFor();
	return performance.now() - start;
}
