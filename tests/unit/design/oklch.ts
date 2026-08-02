export type Oklch = { l: number; c: number; h: number };

// lightness accepts both the css percent form and the bare unit interval
const OKLCH_PATTERN = /^oklch\(\s*(\d*\.?\d+)(%?)\s+(\d*\.?\d+)\s+(-?\d*\.?\d+)(?:deg)?\s*\)$/i;

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

// linear srgb -> lms (cube roots taken between M1 and M2)
const M1 = [
	[0.4122214708, 0.5363325363, 0.0514459929],
	[0.2119034982, 0.6806995451, 0.1073969566],
	[0.0883024619, 0.2817188376, 0.6299787005]
];

// lms' -> oklab
const M2 = [
	[0.2104542553, 0.793617785, -0.0040720468],
	[1.9779984951, -2.428592205, 0.4505937099],
	[0.0259040371, 0.7827717662, -0.808675766]
];

const DEG = 180 / Math.PI;

function srgbToLinear(c: number): number {
	return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// negative inputs stay on the linear branch, so no NaN from a fractional power
function linearToSrgb(c: number): number {
	return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function apply(matrix: number[][], v: [number, number, number]): [number, number, number] {
	return [
		matrix[0]![0]! * v[0] + matrix[0]![1]! * v[1] + matrix[0]![2]! * v[2],
		matrix[1]![0]! * v[0] + matrix[1]![1]! * v[1] + matrix[1]![2]! * v[2],
		matrix[2]![0]! * v[0] + matrix[2]![1]! * v[1] + matrix[2]![2]! * v[2]
	];
}

export function parseOklch(value: string): Oklch | null {
	const match = OKLCH_PATTERN.exec(value.trim());
	if (!match) return null;

	const l = match[2] ? Number(match[1]) / 100 : Number(match[1]);
	return { l, c: Number(match[3]), h: Number(match[4]) };
}

export function linearRgbToOklch(r: number, g: number, b: number): Oklch {
	const lms = apply(M1, [r, g, b]);
	const [okL, okA, okB] = apply(M2, [Math.cbrt(lms[0]), Math.cbrt(lms[1]), Math.cbrt(lms[2])]);

	const c = Math.hypot(okA, okB);
	const h = (((Math.atan2(okB, okA) * DEG) % 360) + 360) % 360;
	return { l: okL, c, h };
}

export function oklchToSrgb(o: Oklch): [number, number, number] {
	const hRad = o.h / DEG;
	const a = o.c * Math.cos(hRad);
	const b = o.c * Math.sin(hRad);

	const lp = o.l + 0.3963377774 * a + 0.2158037573 * b;
	const mp = o.l - 0.1055613458 * a - 0.0638541728 * b;
	const sp = o.l - 0.0894841775 * a - 1.291485548 * b;

	const l = lp * lp * lp;
	const m = mp * mp * mp;
	const s = sp * sp * sp;

	const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
	const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
	const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

	return [linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb)];
}

export function hexToOklch(hex: string): Oklch {
	const match = HEX_PATTERN.exec(hex.trim());
	if (!match) throw new Error(`not a hex color: ${hex}`);

	const digits =
		match[1]!.length === 3
			? match[1]!
					.split('')
					.map((d) => d + d)
					.join('')
			: match[1]!;

	const r = parseInt(digits.slice(0, 2), 16) / 255;
	const g = parseInt(digits.slice(2, 4), 16) / 255;
	const b = parseInt(digits.slice(4, 6), 16) / 255;

	return linearRgbToOklch(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
}

export function srgbToHex(rgb: [number, number, number]): string {
	const channel = (c: number) =>
		Math.round(Math.min(1, Math.max(0, c)) * 255)
			.toString(16)
			.padStart(2, '0');
	return `#${channel(rgb[0])}${channel(rgb[1])}${channel(rgb[2])}`;
}

export function relativeLuminance(o: Oklch): number {
	const [r, g, b] = oklchToSrgb(o).map((c) => srgbToLinear(Math.min(1, Math.max(0, c))));
	return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrastRatio(a: Oklch, b: Oklch): number {
	const la = relativeLuminance(a);
	const lb = relativeLuminance(b);
	const lighter = Math.max(la, lb);
	const darker = Math.min(la, lb);
	return (lighter + 0.05) / (darker + 0.05);
}

export function inGamut(o: Oklch, tolerance = 0.001): boolean {
	return oklchToSrgb(o).every((c) => c >= -tolerance && c <= 1 + tolerance);
}
