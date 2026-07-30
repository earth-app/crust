import { defineVitestConfig } from '@nuxt/test-utils/config';

export default defineVitestConfig({
	test: {
		environment: 'nuxt',
		include: ['tests/unit/**/*.spec.ts'],
		setupFiles: ['tests/unit/setup.ts'],
		globals: true,
		// every file pays a setupNuxt() beforeAll; on a 4-core CI runner with coverage
		// instrumentation that regularly blows past vitest's 10s default (whichever
		// files happen to start last lose the race and fail the whole suite)
		hookTimeout: 120_000,
		testTimeout: 30_000,
		coverage: {
			provider: 'v8',
			reportsDirectory: 'coverage',
			reporter: ['text', 'json', 'lcov'],
			include: [
				'src/stores/**',
				'src/composables/**',
				'src/shared/**',
				'src/components/admin/marketing/useMarketingExport.ts'
			],
			exclude: ['**/*.d.ts']
		}
	}
});
