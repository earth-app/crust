// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * `prepack` copies nuxt.config.library.ts over nuxt.config.ts before publish, so the library config
 * is what @earth-app/crust actually ships to sky. @nuxt/ui REPLACES ui.theme.colors rather than
 * extending it, so any drift between the two files silently drops a colour slot from the published
 * layer -- which is exactly how sky ended up rendering `tertiary` as an empty colour while crust
 * rendered it fine.
 */

function themeColors(file: string): string[] {
	const source = readFileSync(new URL(`../../../${file}`, import.meta.url), 'utf8').replace(
		/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
		''
	);

	const match = /ui:\s*\{[\s\S]*?colors:\s*\[([\s\S]*?)\]/.exec(source);
	expect(match, `${file} declares ui.theme.colors`).not.toBeNull();

	return [...match![1]!.matchAll(/'([\w-]+)'/g)].map((m) => m[1]!);
}

describe('published layer colour config', () => {
	it('mirrors ui.theme.colors between the app and library configs', () => {
		expect(themeColors('nuxt.config.library.ts')).toEqual(themeColors('nuxt.config.ts'));
	});

	// @nuxt/ui appends `neutral` unconditionally in every place that matters. listing it here emits
	// `--color-neutral: var(--ui-neutral)`, and the colors plugin destructures --ui-neutral out
	// before generating flat role aliases, so bg-neutral / text-neutral / border-neutral silently
	// resolve to empty
	it('never lists neutral, which @nuxt/ui appends itself', () => {
		for (const file of ['nuxt.config.ts', 'nuxt.config.library.ts']) {
			expect(themeColors(file), `${file} must not list neutral`).not.toContain('neutral');
		}
	});
});
