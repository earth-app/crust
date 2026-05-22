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

import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMockServers } from './mock-server';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const RAW_COVERAGE_DIR = resolve(PROJECT_ROOT, '.coverage', 'raw');

export default async function globalSetup() {
	// Clear any previous coverage run
	if (existsSync(RAW_COVERAGE_DIR)) {
		rmSync(RAW_COVERAGE_DIR, { recursive: true, force: true });
	}
	if (process.env.COVERAGE === '1') {
		mkdirSync(RAW_COVERAGE_DIR, { recursive: true });
	}

	// Skip mock server boot when an explicit MOCK_DISABLED flag is set --
	// e.g. when running the integration workflow against the real mantle2/cloud.
	if (process.env.MOCK_DISABLED === '1') {
		console.log('[setup] MOCK_DISABLED=1 → skipping mock server boot');
	} else {
		await startMockServers();
	}

	// Warm up the Nuxt dev server — first request is slow because Vite compiles
	// on demand. We warm a representative set of routes so the per-test
	// navigation budget stays sane.
	const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
	const deadline = Date.now() + 180_000;
	let up = false;
	while (Date.now() < deadline && !up) {
		try {
			const r = await fetch(baseURL, { signal: AbortSignal.timeout(15_000) });
			if (r.status < 500) {
				up = true;
				console.log(`[setup] dev server reachable (status=${r.status})`);
				break;
			}
		} catch {
			// not yet up
		}
		await new Promise((r) => setTimeout(r, 1500));
	}
	if (!up) {
		console.warn('[setup] dev server warmup timed out — tests may have slow first hits');
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
	// Warm routes sequentially — Vite's compiler is single-threaded so firing
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
