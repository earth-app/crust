import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toLcov, toRepoRelative } from '../e2e/utils/coverage';

// regression: v8-to-istanbul keys coverage by absolute on-disk path; codecov
// matches onto the repo tree by repo-relative path, so absolute CI paths made
// the whole e2e-integration report "unusable". paths must come out repo-relative.
describe('toRepoRelative', () => {
	it('strips the CI triple-nested absolute prefix to a repo-relative src path', () => {
		// exact shape codecov rejected: earth-app/crust checked out into a crust/
		// subdir of the /home/runner/work/crust/crust workspace
		const ci = '/home/runner/work/crust/crust/crust/src/components/OfflineBanner.vue';
		expect(toRepoRelative(ci)).toBe('src/components/OfflineBanner.vue');
	});

	it('strips the local project-root prefix', () => {
		const abs = resolve(process.cwd(), 'src/composables/useArticle.ts');
		expect(toRepoRelative(abs)).toBe('src/composables/useArticle.ts');
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
