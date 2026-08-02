// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hexToOklch, parseOklch, type Oklch } from './oklch';

const CSS = readFileSync(new URL('../../../src/assets/css/main.css', import.meta.url), 'utf8');

// comments quote css that would otherwise trip the selector/token scans
const SOURCE = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
const RAMPS = ['ink', 'brand', 'danger', 'warning', 'azure'] as const;

const BRAND_HEX = '#1ebb48';

function declaration(name: string): string | null {
	const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(SOURCE);
	return match ? match[1]!.trim() : null;
}

function ramp(family: string): Oklch[] {
	return SHADES.map((shade) => {
		const raw = declaration(`color-${family}-${shade}`);
		expect(raw, `--color-${family}-${shade} is declared`).toBeTruthy();

		const parsed = parseOklch(raw!);
		expect(parsed, `--color-${family}-${shade} parses as oklch(): ${raw}`).not.toBeNull();
		return parsed!;
	});
}

function layerBlocks(): { name: string; body: string }[] {
	const blocks: { name: string; body: string }[] = [];
	const opener = /@layer\s+([\w-]+)\s*\{/g;

	let match: RegExpExecArray | null;
	while ((match = opener.exec(SOURCE))) {
		let depth = 1;
		let i = match.index + match[0].length;
		const start = i;

		while (i < SOURCE.length && depth > 0) {
			if (SOURCE[i] === '{') depth++;
			else if (SOURCE[i] === '}') depth--;
			i++;
		}

		blocks.push({ name: match[1]!, body: SOURCE.slice(start, i - 1) });
		opener.lastIndex = i;
	}

	return blocks;
}

// crust inverts sky's two cascade rules. sky declares `@layer ionic, properties, ...;` and doubles
// every :root, both purely to out-specify @ionic/core's unlayered reset. crust has no such reset:
// `@import 'tailwindcss'` already establishes the order and tailwind force-inserts `properties`
// ahead of it, so an explicit statement here could only get the order WRONG, and a doubled
// :root:root would outrank the .light/.dark class rules and half-break theme switching
describe('cascade shape is the web one, not the ionic one', () => {
	it('declares no @layer order statement, leaving tailwind to establish it', () => {
		expect(/@layer\s+[^;{]+;/.test(SOURCE)).toBe(false);
	});

	it('starts with the tailwind import as the first at-rule', () => {
		const first = /@[a-z-]+[^;{]*[;{]/i.exec(SOURCE);
		expect(first).not.toBeNull();
		expect(first![0]!.startsWith("@import 'tailwindcss'")).toBe(true);
	});

	it('never doubles the root selector', () => {
		expect(SOURCE).not.toMatch(/:root:root/);
	});

	it('declares no --ion- property, which belongs to sky alone', () => {
		expect(SOURCE).not.toMatch(/--ion-[\w-]*\s*:/);
	});

	it('carries both theme variants at the same specificity', () => {
		expect(SOURCE).toMatch(/:root\.light\s*\{/);
		expect(SOURCE).toMatch(/:root\.dark\s*\{/);
	});
});

describe('ramp completeness', () => {
	for (const family of RAMPS) {
		it(`declares all 11 shades of --color-${family}-`, () => {
			for (const shade of SHADES) {
				expect(declaration(`color-${family}-${shade}`)).toBeTruthy();
			}
		});
	}

	it('aliases every --color-gray- shade onto the matching ink shade', () => {
		for (const shade of SHADES) {
			expect(declaration(`color-gray-${shade}`)).toBe(`var(--color-ink-${shade})`);
		}
	});

	// those 104 neutral-* usages resolve through --ui-color-neutral-*, which follows
	// ui.colors.neutral. aliasing the tailwind key too would sever them from that control
	it('does not alias --color-neutral-, which belongs to ui.colors.neutral', () => {
		for (const shade of SHADES) {
			expect(declaration(`color-neutral-${shade}`)).toBeNull();
		}
	});
});

describe('ink ramp', () => {
	it('holds one constant chroma across all 11 shades', () => {
		const chromas = ramp('ink').map((shade) => shade.c);
		expect(new Set(chromas).size).toBe(1);
	});

	it('decreases in lightness strictly from 50 to 950', () => {
		const lightness = ramp('ink').map((shade) => shade.l);

		for (let i = 1; i < lightness.length; i++) {
			expect(lightness[i]!).toBeLessThan(lightness[i - 1]!);
		}
	});
});

describe('brand anchor', () => {
	it('pins --color-brand-500 to the earth app brand hex', () => {
		const anchor = hexToOklch(BRAND_HEX);
		const brand500 = parseOklch(declaration('color-brand-500')!)!;

		expect(Math.abs(brand500.l - anchor.l)).toBeLessThan(0.002);
		expect(Math.abs(brand500.c - anchor.c)).toBeLessThan(0.002);
		expect(Math.abs(brand500.h - anchor.h)).toBeLessThan(0.5);
	});
});

describe('reduced-motion killswitch', () => {
	it('lives in @layer theme', () => {
		const theme = layerBlocks().filter((block) => block.name === 'theme');
		expect(theme.length).toBeGreaterThan(0);

		const body = theme.map((block) => block.body).join('\n');
		expect(body).toMatch(/html\.animations-disabled/);
		expect(body).toMatch(/prefers-reduced-motion:\s*reduce/);
		expect(body).toMatch(/animation-duration:\s*0\.001ms\s*!important/);
	});

	// `theme` is the earliest layer tailwind establishes that carries author declarations, and
	// !important REVERSES layer order, so the killswitch has to sit there to beat `!` utilities,
	// @nuxt/icon's @layer base injection and every unlayered component <style> block
	it('keeps the killswitch out of the later layers it has to beat', () => {
		for (const block of layerBlocks()) {
			if (block.name === 'theme') continue;
			expect(block.body).not.toMatch(/animations-disabled/);
		}
	});
});

describe('spacing token names cannot collide with component class names', () => {
	// a --spacing-X key makes `m-X`, `p-X`, `w-X` ... real utilities. in sky, `--spacing-card`
	// therefore turned the `.m-card` COMPONENT class into a margin utility, and utilities outrank
	// components, so every surface silently gained a 16px margin and overflowed its container.
	// crust declares no --spacing-* today; this stays armed for the first one that lands
	const SPACING_PREFIXES = [
		'm',
		'p',
		'mx',
		'my',
		'px',
		'py',
		'gap',
		'w',
		'h',
		'size',
		'inset',
		'top',
		'right',
		'bottom',
		'left'
	];

	it('declares no --spacing-* key that any component class resolves to', () => {
		const spacingKeys = [...SOURCE.matchAll(/--spacing-([\w-]+)\s*:/g)].map((m) => m[1]!);

		const componentClasses = new Set(
			[...SOURCE.matchAll(/^\s*\.([a-z][\w-]*)[\s,{]/gm)].map((m) => m[1]!)
		);

		const collisions: string[] = [];
		for (const key of spacingKeys) {
			for (const prefix of SPACING_PREFIXES) {
				const utility = `${prefix}-${key}`;
				if (componentClasses.has(utility)) {
					collisions.push(`--spacing-${key} makes .${utility} a utility that outranks it`);
				}
			}
		}

		expect(collisions).toEqual([]);
	});
});

describe('fluid type keeps a rem term', () => {
	// a pure-vw middle term in clamp() does not respond to browser text zoom, which is a
	// WCAG 1.4.4 failure at 200%. every fluid step must carry a rem component
	it('never ships a clamp() whose middle term is vw-only', () => {
		const clamps = [...SOURCE.matchAll(/--text-[\w-]+:\s*clamp\(([^)]+)\)/g)].map((m) => m[1]!);
		expect(clamps.length).toBeGreaterThan(0);

		for (const args of clamps) {
			const middle = args.split(',')[1]!;
			expect(middle, `middle term "${middle}" must contain a rem`).toMatch(/rem/);
		}
	});
});
