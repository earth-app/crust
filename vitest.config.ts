import { defineVitestConfig } from '@nuxt/test-utils/config';

export default defineVitestConfig({
	test: {
		environment: 'nuxt',
		include: ['tests/unit/**/*.spec.ts'],
		setupFiles: ['tests/unit/setup.ts'],
		globals: true,
		hookTimeout: 120_000,
		testTimeout: 30_000,
		coverage: {
			provider: 'v8',
			reportsDirectory: 'coverage',
			reporter: ['text', 'json', 'lcov'],
			include: ['src/stores/**', 'src/composables/**', 'src/shared/**', 'src/components/**'],
			exclude: ['**/*.d.ts', 'src/components/**/*.stories.ts']
		}
	}
});
