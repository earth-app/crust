/**
 * Playwright global teardown.
 *
 * Stops the mock backend servers and (if COVERAGE=1) merges raw V8 coverage
 * files into lcov + summary reports so codecov can ingest them.
 */

import { mergeAndReport } from './coverage';
import { stopMockServers } from './mock-server';

export default async function globalTeardown() {
	if (process.env.COVERAGE === '1') {
		try {
			await mergeAndReport();
		} catch (err) {
			console.error('[teardown] coverage merge failed:', err);
		}
	}
	if (process.env.MOCK_DISABLED !== '1') {
		await stopMockServers();
	}
}
