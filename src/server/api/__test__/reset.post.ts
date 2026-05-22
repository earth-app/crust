/**
 * Test-only endpoint that clears the long-lived in-memory caches inside the
 * Nitro process. Mounted only when NUXT_DISABLE_API_CACHE=1 (i.e. the test
 * env). Required because the dev server reuses a single Node process across
 * all Playwright workers, and the warmup phase (or an earlier test) can
 * prime caches with default mock data that later tests need to be invalidated.
 *
 * The Playwright `mockApi` fixture hits this in its setup so each test sees
 * fresh fetches against the mock backend.
 */

import { apiCache_TEST_ONLY_CLEAR } from '~/shared/utils/util';

export default defineEventHandler(() => {
	if (
		process.env.NUXT_DISABLE_API_CACHE !== '1' &&
		process.env.DISABLE_API_CACHE !== '1' &&
		process.env.NODE_ENV !== 'test'
	) {
		throw createError({
			statusCode: 404,
			statusMessage: 'Not found'
		});
	}

	apiCache_TEST_ONLY_CLEAR();
	return { ok: true };
});
