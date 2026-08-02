// @vitest-environment node
import { readFileSync } from 'node:fs';
import tailwindColors from 'tailwindcss/colors';
import { describe, expect, it } from 'vitest';

/*
 * The highest-value gate in the design suite, because the failure it catches is SILENT.
 *
 * @nuxt/ui resolves `ui.colors.primary: 'brand'` at RUNTIME, emitting
 *   --ui-color-primary-500: var(--color-brand-500, <fallback>)
 * where <fallback> comes from `tailwindcss/colors`. For a name that is not a tailwind palette key
 * the fallback is the EMPTY STRING. Tailwind separately drops any @theme key that is neither
 * `static` nor referenced by a generated utility, and nothing in src/ ever writes the literal
 * `--color-brand-500` (the plugin's injected <style> is invisible to the scanner).
 *
 * So a custom ramp declared in plain `@theme` resolves to empty: primary text inherits its parent
 * colour, primary backgrounds go transparent, and NOTHING THROWS. The build is green, the tests
 * are green, and the app ships with no brand colour.
 */

const CSS = readFileSync(new URL('../../../src/assets/css/main.css', import.meta.url), 'utf8');
const SOURCE = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

const APP_CONFIG = readFileSync(
	new URL('../../../src/app.config.ts', import.meta.url),
	'utf8'
).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

const TAILWIND_NAMES = new Set(Object.keys(tailwindColors));

function staticThemeBody(): string {
	const match = /@theme\s+static\s*\{([\s\S]*?)\n\}/.exec(SOURCE);
	expect(match, 'main.css declares an `@theme static` block').not.toBeNull();
	return match![1]!;
}

function aliasTargets(): Record<string, string> {
	const block = /colors:\s*\{([\s\S]*?)\n\t\t\}/.exec(APP_CONFIG);
	expect(block, 'app.config.ts declares ui.colors').not.toBeNull();

	const entries: Record<string, string> = {};
	for (const m of block![1]!.matchAll(/(\w+)\s*:\s*'([\w-]+)'/g)) {
		entries[m[1]!] = m[2]!;
	}
	return entries;
}

describe('custom colour aliases survive tailwind tree-shaking', () => {
	it('maps at least the roles crust actually uses', () => {
		const targets = aliasTargets();
		for (const role of ['primary', 'secondary', 'success', 'error', 'warning', 'neutral']) {
			expect(targets[role], `ui.colors.${role} is mapped`).toBeTruthy();
		}
	});

	it('declares every non-tailwind alias target inside @theme static', () => {
		const body = staticThemeBody();
		const missing: string[] = [];

		for (const [role, target] of Object.entries(aliasTargets())) {
			// a real tailwind palette name gets a hardcoded literal fallback from getColor(), so it
			// needs no static declaration and is safe to leave to the framework
			if (TAILWIND_NAMES.has(target)) continue;

			for (const shade of SHADES) {
				if (!new RegExp(`--color-${target}-${shade}\\s*:`).test(body)) {
					missing.push(`ui.colors.${role} -> --color-${target}-${shade}`);
				}
			}
		}

		expect(
			missing,
			'these would resolve to an EMPTY colour at runtime with no error thrown'
		).toEqual([]);
	});

	it('keeps the gray alias out of @theme static so it can still tree-shake per shade', () => {
		expect(staticThemeBody()).not.toMatch(/--color-gray-\d+\s*:/);
	});
});
