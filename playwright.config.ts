/**
 * Playwright configuration for the Crust E2E test suite.
 *
 * Two "modes":
 *   - Default (mocked): Mock backends boot via globalSetup; Playwright's
 *                       webServer starts the Nuxt dev server with mocked env.
 *                       Fast and CI-friendly. Used by build.yml's `test` job.
 *   - Integration:      MOCK_DISABLED=1 to skip the mock servers - tests assume
 *                       real mantle2 (8787) + cloud (9898) are already running.
 *                       Used by e2e.yml.
 *
 * Coverage:
 *   When COVERAGE=1, the page fixture starts V8 JS coverage on chromium and
 *   the global teardown merges raw traces into coverage/lcov.info + summary
 *   for codecov upload.
 */

import type { ConfigOptions } from '@nuxt/test-utils/playwright';
import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = fileURLToPath(new URL('.', import.meta.url));
const isCI = !!process.env.CI;
const coverage = process.env.COVERAGE === '1';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
const prodServer = process.env.PLAYWRIGHT_PROD === '1';

const reporters: any[] = [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]];

if (isCI) {
	reporters.push(['github']);
	reporters.push(['junit', { outputFile: 'playwright-report/junit.xml' }]);
}

export default defineConfig<ConfigOptions>({
	testDir: './tests/e2e',
	testIgnore: ['**/utils/**'],
	fullyParallel: true,
	forbidOnly: isCI,
	retries: isCI ? 2 : 3,
	workers: prodServer ? 4 : coverage ? 2 : isCI ? 2 : undefined,
	timeout: 120_000,
	expect: {
		timeout: 12_000
	},
	globalSetup: fileURLToPath(new URL('./tests/e2e/utils/global-setup.ts', import.meta.url)),
	globalTeardown: fileURLToPath(new URL('./tests/e2e/utils/global-teardown.ts', import.meta.url)),
	reporter: reporters,
	// Keep test artifacts OUT of the HTML reporter folder. The HTML reporter
	// clears its output dir before generating the report, which would wipe out
	// failure screenshots / traces and produce a CI warning. Two distinct dirs.
	outputDir: 'playwright-results',
	webServer: {
		command: prodServer
			? 'test -f .output/server/index.mjs || bun run build:test && bun run start:test'
			: 'bun run dev:test',
		url: BASE_URL,
		reuseExistingServer: !isCI,
		timeout: prodServer ? 360_000 : 240_000,
		stdout: 'pipe',
		stderr: 'pipe'
	},
	use: {
		baseURL: BASE_URL,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
		actionTimeout: 12_000,
		navigationTimeout: prodServer ? 30_000 : 90_000,
		nuxt: {
			rootDir: PROJECT_ROOT,
			host: BASE_URL + '/'
		}
	},
	projects: [
		{
			name: 'chromium',
			// mobile/responsive specs belong to the Pixel 7 project
			testIgnore: /\.(mobile|responsive)\.spec\.ts$/,
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'mobile-chromium',
			testMatch: /\.(mobile|responsive)\.spec\.ts$/,
			use: { ...devices['Pixel 7'] }
		}
	]
});
