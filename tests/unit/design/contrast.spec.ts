// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, inGamut, parseOklch, type Oklch } from './oklch';

const CSS = readFileSync(new URL('../../../src/assets/css/main.css', import.meta.url), 'utf8');
const SOURCE = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
const CHROMATIC = ['brand', 'danger', 'warning', 'azure'] as const;

const WHITE: Oklch = { l: 1, c: 0, h: 0 };

// tailwind gray's own L ladder; the blind --color-gray-* remap is only contrast-safe while ink holds it
const TAILWIND_GRAY_L = [
	0.985, 0.967, 0.928, 0.872, 0.707, 0.551, 0.446, 0.373, 0.278, 0.21, 0.13
] as const;

function token(family: string, shade: number): Oklch {
	const match = new RegExp(`--color-${family}-${shade}:\\s*([^;]+);`).exec(SOURCE);
	expect(match, `--color-${family}-${shade} is declared`).not.toBeNull();

	const parsed = parseOklch(match![1]!.trim());
	expect(parsed, `--color-${family}-${shade} parses as oklch(): ${match![1]}`).not.toBeNull();
	return parsed!;
}

const INK_50 = token('ink', 50);

describe('srgb gamut', () => {
	for (const family of [...CHROMATIC, 'ink'] as const) {
		it(`keeps every ${family} shade inside srgb`, () => {
			for (const shade of SHADES) {
				expect(inGamut(token(family, shade)), `--color-${family}-${shade} is in gamut`).toBe(true);
			}
		});
	}
});

describe('ink lightness ladder', () => {
	it('matches tailwind gray shade for shade', () => {
		SHADES.forEach((shade, i) => {
			expect(Math.abs(token('ink', shade).l - TAILWIND_GRAY_L[i]!)).toBeLessThan(0.0005);
		});
	});
});

describe('shared chromatic ladder', () => {
	it('gives every chromatic family identical lightness at every shade', () => {
		for (const shade of SHADES) {
			const brand = token('brand', shade).l;
			for (const family of CHROMATIC) {
				expect(
					Math.abs(token(family, shade).l - brand),
					`${family}-${shade} shares the brand lightness step`
				).toBeLessThan(0.0005);
			}
		}
	});
});

describe('coloured text tokens', () => {
	for (const family of CHROMATIC) {
		it(`${family}-700 clears AA body text on white and on ink-50`, () => {
			const text = token(family, 700);
			expect(contrastRatio(text, WHITE)).toBeGreaterThanOrEqual(4.5);
			expect(contrastRatio(text, INK_50)).toBeGreaterThanOrEqual(4.5);
		});

		// documented expectation, not an oversight: -500 is the fill/accent tone, so coloured TEXT
		// must use -700. this is the assertion that makes --e-text-* meaningful
		it(`${family}-500 fails AA body text on white, which is why text uses -700`, () => {
			expect(contrastRatio(token(family, 500), WHITE)).toBeLessThan(4.5);
		});
	}
});

describe('cross-family contrast parity', () => {
	for (const shade of SHADES) {
		it(`holds the ${shade} shade within 0.8 ratio across families`, () => {
			const ratios = CHROMATIC.map((family) =>
				contrastRatio(token(family, shade), token(family, 100))
			);
			expect(Math.max(...ratios) - Math.min(...ratios)).toBeLessThanOrEqual(0.8);
		});
	}
});

describe('ink body text', () => {
	it('clears AAA for 950 and 900 on ink-50', () => {
		expect(contrastRatio(token('ink', 950), INK_50)).toBeGreaterThan(7);
		expect(contrastRatio(token('ink', 900), INK_50)).toBeGreaterThan(7);
	});
});

describe('semantic text tokens resolve to the -700 step', () => {
	// --e-text-* in light mode is the whole reason coloured text is readable; a regression here
	// (say someone "simplifies" it to -500) is a WCAG 1.4.3 failure across every consuming site
	const LIGHT = /:root\.light\s*\{([\s\S]*?)\n\}/.exec(SOURCE)?.[1] ?? '';
	const DARK = /:root\.dark\s*\{([\s\S]*?)\n\}/g;

	for (const family of CHROMATIC) {
		it(`--e-text-${family} uses -700 in light mode`, () => {
			expect(LIGHT).toMatch(new RegExp(`--e-text-${family}:\\s*var\\(--color-${family}-700\\)`));
		});
	}

	it('uses the -300 step in dark mode, where the surface is dark', () => {
		const blocks = [...SOURCE.matchAll(DARK)].map((m) => m[1]!).join('\n');
		for (const family of CHROMATIC) {
			expect(blocks).toMatch(new RegExp(`--e-text-${family}:\\s*var\\(--color-${family}-300\\)`));
		}
	});
});
