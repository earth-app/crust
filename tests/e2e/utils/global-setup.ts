/**
 * Playwright global setup.
 *
 * Boots the mock backend servers exactly once before all workers start. The
 * servers stay alive for the lifetime of the Playwright run and are torn down
 * in global-teardown.
 *
 * The Nuxt dev server itself is started by @nuxt/test-utils's playwright
 * integration (see `nuxt:` in playwright.config.ts) and reads
 * NUXT_PUBLIC_API_BASE_URL / NUXT_PUBLIC_CLOUD_BASE_URL pointing to these mocks.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMockServers } from './mock-server';

const __dirname = dirname(fileURLToPath(import.meta.url));
// repo root is three up from tests/e2e/utils (must match coverage.ts + fixtures.ts)
const PROJECT_ROOT = resolve(__dirname, '../../..');
const RAW_COVERAGE_DIR = resolve(PROJECT_ROOT, '.coverage', 'raw');
const INTEGRATION_SESSION_FILE = resolve(PROJECT_ROOT, '.integration-session.json');

/**
 * Real-backend integration mode shares a single session across all workers.
 *
 * mantle2 applies two distinct rate limits to the `/v2/users/login` endpoint:
 *   - global: 60 requests per ~28s window per client IP
 *   - per-account: a fresh `session_token` can only be issued every ~25s
 *
 * With 152 tests × 4 workers each calling `loginAsRealAdmin` per test, those
 * limits get blown immediately and every subsequent test fails with 409/429.
 * Logging in *once* in globalSetup and writing the token to a temp file lets
 * every fixture invocation reuse the same cookie - zero login traffic after
 * setup. The file is git-ignored and lives for the duration of the run.
 */
async function loginAndCacheAdminSession() {
	const apiBase = process.env.NUXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8787';
	const auth = Buffer.from('admin:admin').toString('base64');
	const res = await fetch(`${apiBase}/v2/users/login`, {
		method: 'POST',
		headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' }
	});
	if (!res.ok) {
		throw new Error(`[setup] integration login failed (${res.status}): ${await res.text()}`);
	}
	const body = (await res.json()) as { session_token?: string };
	const token = body.session_token;
	if (!token) {
		throw new Error('[setup] integration login succeeded but no session_token returned');
	}
	let user: Record<string, any> = {
		id: 'real-admin',
		username: 'admin',
		account: { account_type: 'ADMINISTRATOR' }
	};
	const me = await fetch(`${apiBase}/v2/users/current`, {
		headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
	});
	if (me.ok) user = (await me.json()) as Record<string, any>;
	writeFileSync(INTEGRATION_SESSION_FILE, JSON.stringify({ session_token: token, user }));
	console.log(`[setup] cached real admin session (user=${user.username || 'admin'})`);
}

export default async function globalSetup() {
	// Clear any previous coverage run
	if (existsSync(RAW_COVERAGE_DIR)) {
		rmSync(RAW_COVERAGE_DIR, { recursive: true, force: true });
	}
	if (process.env.COVERAGE === '1') {
		mkdirSync(RAW_COVERAGE_DIR, { recursive: true });
	}
	// Remove any stale session from a prior run before deciding whether to mint
	// a new one - keeps mock-mode runs from accidentally seeing the file.
	if (existsSync(INTEGRATION_SESSION_FILE)) {
		rmSync(INTEGRATION_SESSION_FILE, { force: true });
	}

	// Skip mock server boot when an explicit MOCK_DISABLED flag is set --
	// e.g. when running the integration workflow against the real mantle2/cloud.
	if (process.env.MOCK_DISABLED === '1') {
		console.log('[setup] MOCK_DISABLED=1 → skipping mock server boot');
		await loginAndCacheAdminSession();
	} else {
		await startMockServers();
	}

	const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
	const prodMode = process.env.PLAYWRIGHT_PROD === '1';
	const deadline = Date.now() + 180_000;
	let up = false;
	while (Date.now() < deadline && !up) {
		try {
			const r = await fetch(baseURL, { signal: AbortSignal.timeout(15_000) });
			if (r.status < 500) {
				up = true;
				console.log(`[setup] ${prodMode ? 'prod' : 'dev'} server reachable (status=${r.status})`);
				break;
			}
		} catch {
			// not yet up
		}
		await new Promise((r) => setTimeout(r, 1500));
	}
	if (!up) {
		console.warn('[setup] server warmup timed out - tests may have slow first hits');
		return;
	}

	if (process.env.MOCK_DISABLED !== '1') {
		try {
			const html = await (await fetch(baseURL, { signal: AbortSignal.timeout(15_000) })).text();
			if (!html.includes('127.0.0.1') && !html.includes('localhost')) {
				throw new Error(
					`[setup] ABORT: the server on ${baseURL} is NOT wired to the local mock backend ` +
						'(no local api base found in its runtime payload). Refusing to run - a stale/foreign ' +
						"server pointed at production would receive the suite's mutations (real signups!). Stop it " +
						'so Playwright starts a fresh test server (reuseExistingServer is off for prod e2e).'
				);
			}
		} catch (e) {
			if (e instanceof Error && e.message.includes('ABORT')) throw e;
			console.warn(`[setup] api-base safety check could not complete: ${(e as Error).message}`);
		}
	}

	if (prodMode) {
		// No per-route Vite compile in the prod bundle. Done.
		return;
	}

	// Pre-compile the heaviest routes (each one triggers a Vite cold compile
	// the first time it's visited). This makes individual tests feel snappy.
	const warmRoutes = [
		'/',
		'/about',
		'/login',
		'/signup',
		'/verify-email',
		'/change-password',
		'/admin',
		'/profile',
		'/profile/testuser',
		'/profile/testuser/badges',
		'/profile/quests',
		'/profile/notifications',
		'/activities',
		'/activities/act-1',
		'/articles',
		'/articles/new',
		'/articles/art-1',
		'/events',
		'/events/evt-1',
		'/events/evt-1/manage',
		'/prompts',
		'/prompts/new',
		'/prompts/pmt-1',
		'/terms-of-service',
		'/privacy-policy'
	];
	// Warm routes sequentially - Vite's compiler is single-threaded so firing
	// requests in parallel just creates head-of-line contention. A serial
	// warm-up of 25 routes typically finishes in 15-20s and dramatically
	// improves per-test navigation times since the chunks are now cached.
	const warmStart = Date.now();
	let warmed = 0;
	for (const route of warmRoutes) {
		try {
			await fetch(`${baseURL}${route}`, { signal: AbortSignal.timeout(45_000) });
			warmed++;
		} catch {
			// best effort
		}
	}
	console.log(
		`[setup] warmed ${warmed}/${warmRoutes.length} routes in ${Date.now() - warmStart}ms`
	);
}
