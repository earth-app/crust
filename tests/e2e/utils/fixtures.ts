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

		// Block external network calls that slow tests down without changing
		// observable behavior: Cloudflare Turnstile, Google Fonts, image CDN,
		// YouTube embeds, Iconify CDN (we ship icons locally), Pixabay/Wikipedia
		// thumbnails. They never resolve fast enough on a busy dev server to
		// matter for assertions and they add 5-15s of variance per test.
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
		// Clear the Nitro server's in-memory apiCache (and request dedupe queue)
		// so default mock data doesn't bleed across tests. Best-effort with a
		// hard 3s timeout - under heavy CI load the dev server can pause for
		// minutes on a single request, and we don't want the fixture setup to
		// consume the whole test's 120s budget on this one call. The cache
		// disable flag (`DISABLE_API_CACHE=1`) is the primary defense; this
		// reset is a belt-and-suspenders.
		try {
			const ac = new AbortController();
			const timer = setTimeout(() => ac.abort(), 3_000);
			await fetch('http://127.0.0.1:3000/api/__test__/reset', {
				method: 'POST',
				signal: ac.signal
			}).catch(() => {});
			clearTimeout(timer);
		} catch {
			// dev server may not be up yet on first test; non-fatal
		}
		await use(client);
		// Same timeout discipline on teardown - never let cleanup block the
		// next test if the dev server is wedged.
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
				// Integration mode: hit real mantle2. We don't have a way to
				// create arbitrary users on the fly, so log in as the seeded
				// admin/admin account that `startup.sh` provisions. Most "logged
				// in" tests just need *some* authenticated user.
				return await loginAsRealAdmin(context, overrides);
			}
			// Mock mode: each test gets a unique user id + session token derived
			// from its testId so parallel workers don't overwrite each other.
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

	/**
	 * Navigate and wait for Nuxt to finish hydrating AND the auth store to
	 * resolve (`currentUser` no longer undefined). Most pages branch on
	 * `user === null` (anonymous) vs `user` (logged in); asserting before the
	 * auth fetch resolves causes flaky failures on a busy dev server.
	 *
	 * For routes that have ISR/SWR cache rules in `nuxt.config.ts`
	 * (`/events/**`, `/articles/**`, `/prompts/**`, `/activities/**`, `/`)
	 * we append a per-test cache-bust query (`_t={testId}`) so that an
	 * earlier test's SSR HTML - rendered before this test's mock overrides
	 * were in place - doesn't leak across tests. URL assertions in those
	 * spec files use substring regexes that are tolerant of the trailing
	 * query.
	 */
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
			// Best-effort hydration wait - Nuxt sets `window.useNuxtApp` after
			// hydration is complete. Bail out after 8s if the marker never
			// appears (e.g. a hard error page).
			await page
				.waitForFunction(
					() =>
						typeof (window as any).useNuxtApp === 'function' &&
						(window as any).useNuxtApp().isHydrating === false,
					{ timeout: 8_000 }
				)
				.catch(() => {});
			// Wait for the auth store to be in a settled state:
			//   - currentUser is `null` or a user object (not undefined), AND
			//   - no in-flight fetchPromise.
			// Pinia ships the store via `useNuxtApp().$pinia` which we read
			// directly.
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

/**
 * Conditional `test.skip()` for tests that hardcode mock-shaped data (e.g.
 * specific entity IDs like `act-1`, names like "Sample Activity 1", or rely on
 * `mockApi.set` overrides that don't take effect against the real backend).
 *
 * Call inside a test body. No-op outside integration mode.
 */
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

/**
 * Time how long a navigation + hydration cycle takes. Returns a millisecond
 * count that tests can assert against to catch performance regressions.
 */
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
