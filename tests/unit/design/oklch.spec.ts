// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
	contrastRatio,
	hexToOklch,
	inGamut,
	oklchToSrgb,
	parseOklch,
	srgbToHex,
	type Oklch
} from './oklch';

const BRAND_HEX = '#1ebb48';

describe('parseOklch', () => {
	it('reads the percent lightness form', () => {
		expect(parseOklch('oklch(55.1% 0.008 150)')).toEqual({ l: 0.551, c: 0.008, h: 150 });
	});

	it('reads the unit-interval lightness form identically', () => {
		expect(parseOklch('oklch(0.551 0.008 150)')).toEqual({ l: 0.551, c: 0.008, h: 150 });
	});

	it('tolerates surrounding whitespace and a deg hue suffix', () => {
		expect(parseOklch('  oklch(69.3% 0.199 146.7deg)  ')).toEqual({
			l: 0.693,
			c: 0.199,
			h: 146.7
		});
	});

	it('returns null for malformed input', () => {
		expect(parseOklch('rgb(30, 187, 72)')).toBeNull();
		expect(parseOklch('oklch(55.1%)')).toBeNull();
		expect(parseOklch('oklch(55.1% 0.008)')).toBeNull();
		expect(parseOklch('var(--color-ink-500)')).toBeNull();
		expect(parseOklch('')).toBeNull();
	});
});

describe('hexToOklch', () => {
	it('converts the brand hex to its known oklch coordinates', () => {
		const brand = hexToOklch(BRAND_HEX);
		expect(Math.abs(brand.l - 0.693)).toBeLessThan(0.002);
		expect(Math.abs(brand.c - 0.1989)).toBeLessThan(0.002);
		expect(Math.abs(brand.h - 146.7)).toBeLessThan(0.5);
	});

	it('expands the 3-digit shorthand', () => {
		expect(hexToOklch('#fff')).toEqual(hexToOklch('#ffffff'));
	});

	it('throws on a non-hex string', () => {
		expect(() => hexToOklch('oklch(69.3% 0.199 146.7)')).toThrow(/not a hex color/);
	});
});

describe('round trip', () => {
	it('returns the same hex after hex -> oklch -> srgb -> hex', () => {
		expect(srgbToHex(oklchToSrgb(hexToOklch(BRAND_HEX)))).toBe(BRAND_HEX);
	});

	it('round-trips the achromatic endpoints', () => {
		expect(srgbToHex(oklchToSrgb(hexToOklch('#ffffff')))).toBe('#ffffff');
		expect(srgbToHex(oklchToSrgb(hexToOklch('#000000')))).toBe('#000000');
	});
});

describe('contrastRatio', () => {
	it('is exactly 21 for black on white', () => {
		const black: Oklch = { l: 0, c: 0, h: 0 };
		const white: Oklch = { l: 1, c: 0, h: 0 };
		expect(contrastRatio(black, white)).toBeCloseTo(21, 2);
	});

	it('is 1 for a colour against itself and symmetric in its arguments', () => {
		const brand = hexToOklch(BRAND_HEX);
		const white: Oklch = { l: 1, c: 0, h: 0 };
		expect(contrastRatio(brand, brand)).toBeCloseTo(1, 10);
		expect(contrastRatio(brand, white)).toBeCloseTo(contrastRatio(white, brand), 10);
	});
});

describe('inGamut', () => {
	it('accepts the brand chroma at the brand lightness', () => {
		expect(inGamut(parseOklch('oklch(69.3% 0.199 146.7)')!)).toBe(true);
	});

	it('rejects a chroma past the srgb ceiling for that hue', () => {
		expect(inGamut(parseOklch('oklch(69.3% 0.40 146.7)')!)).toBe(false);
	});

	it('treats pure white and black as in gamut', () => {
		expect(inGamut({ l: 1, c: 0, h: 0 })).toBe(true);
		expect(inGamut({ l: 0, c: 0, h: 0 })).toBe(true);
	});
});
