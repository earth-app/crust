import { defineVitestConfig } from '@nuxt/test-utils/config';

export default defineVitestConfig({
	test: {
		environment: 'nuxt',
		include: ['tests/unit/**/*.spec.ts'],
		globals: true,
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
