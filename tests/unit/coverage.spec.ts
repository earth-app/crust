import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { E2E_OUTPUT_DIR, PROJECT_ROOT, toLcov, toRepoRelative } from '../e2e/utils/coverage';

describe('toRepoRelative', () => {
	it('strips the absolute project-root prefix to a repo-relative src path', () => {
		const abs = `${PROJECT_ROOT}/src/components/OfflineBanner.vue`;
		expect(toRepoRelative(abs)).toBe('src/components/OfflineBanner.vue');
	});

	it('falls back to the first src/ segment for a path outside the project root', () => {
		const foreign = '/zzz-foreign-root/src/composables/useArticle.ts';
		expect(toRepoRelative(foreign)).toBe('src/composables/useArticle.ts');
	});

	it('leaves an already-relative path untouched', () => {
		expect(toRepoRelative('src/stores/event.ts')).toBe('src/stores/event.ts');
	});

	it('returns falsy input unchanged', () => {
		expect(toRepoRelative('')).toBe('');
	});
});

describe('toLcov', () => {
	it('emits repo-relative SF: paths and never an absolute CI path', () => {
		const merged = {
			'src/components/OfflineBanner.vue': {
				path: 'src/components/OfflineBanner.vue',
				statementMap: { '0': { start: { line: 1 }, end: { line: 1 } } },
				fnMap: {},
				branchMap: {},
				s: { '0': 3 },
				f: {},
				b: {}
			}
		};
		const lcov = toLcov(merged);
		expect(lcov).toContain('SF:src/components/OfflineBanner.vue');
		expect(lcov).not.toContain('/home/runner');
		expect(lcov).toContain('end_of_record');
	});
});

/* regression: the e2e lane moved to `.output-e2e` but coverage still resolved `.output`, so every
   served chunk failed its sourcemap lookup with ENOENT and the run reported no coverage at all */
describe('coverage reads the directory the e2e lane actually serves', () => {
	const scripts = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8'))
		.scripts as Record<string, string>;

	it('builds, serves and reads the same output directory', () => {
		expect(scripts['build:test']).toContain(`NITRO_OUTPUT_DIR=${E2E_OUTPUT_DIR}`);
		expect(scripts['start:test']).toContain(`${E2E_OUTPUT_DIR}/server/index.mjs`);
	});
});
