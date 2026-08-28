// @vitest-environment node

/**
 * Guards user-facing copy against claims the behaviour-design evidence does not support.
 *
 * Each pattern here has a specific reason it cannot be written down, recorded next to it. Comments
 * are stripped before matching, so source notes may still name a rejected figure in order to
 * explain why it was rejected.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = join(ROOT, 'src');

const BANNED: { pattern: RegExp; why: string }[] = [
	{
		pattern: /\baddict(ion|ive|ed|s)\b/i,
		why: 'behavioural addiction is a contested construct, not a DSM-5/ICD-11 diagnosis'
	},
	{
		pattern:
			/within\s+300\s*m(eters?|etres?)?\b|300\s*m(eters?|etres?)?\s+of\s+(green|a park|nature)/i,
		why: 'the 300 m green-space threshold is a planning convention with no behavioural derivation; WHO disclaims it'
	},
	{
		pattern: /120\s*min(ute)?s?\s*(a|per|\/)\s*week|two hours a week (outside|outdoors|in nature)/i,
		why: 'White 2019 is cross-sectional and its authors declined to turn 120 min/week into guidance'
	},
	{
		pattern: /the amount linked to|the dose linked to/i,
		why: 'reads as a prescribed dose; there is no established one'
	},
	{
		pattern: /(reduces|cures|prevents|treats)\s+(stress|anxiety|loneliness|depression)/i,
		why: 'no causal claim is available; more contact does not even reduce loneliness (Masi 2011, -0.198)'
	},
	{
		pattern: /(scientifically|clinically)\s+proven|proven\s+to\s+(reduce|improve|boost)/i,
		why: 'nothing in this evidence base is at proof strength'
	},
	{
		pattern: /verif(y|ies|ied)\s+(you|your|that you)\s+(were|are|went|went outside)/i,
		why: 'nature minutes are self-reported time outside, never verified presence'
	}
];

function sourceFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...sourceFiles(full));
		else if (['.ts', '.vue'].includes(extname(entry.name))) out.push(full);
	}
	return out;
}

// a rejected figure has to be nameable in a comment explaining the rejection, so comments do not
// count as copy
function stripComments(text: string): string {
	return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('quest timeline step copy is reachable without hover', () => {
	const timeline = readFileSync(join(ROOT, 'src/components/user/quest/Timeline.vue'), 'utf-8');

	// this is the pattern that shipped blank boxes on the marketing site: a lazily hydrated badge
	// inside a container the observer never fires for
	it('does not lazily hydrate its tiles', () => {
		expect(timeline).not.toMatch(/hydrate-on-visible/);
		expect(timeline).not.toMatch(/<Lazy(UBadge|UProgress)/);
	});

	// a future or delayed tile swallows its click, so hover was the only way to read the step
	it('puts the step copy on the tile, not only in the popover', () => {
		expect(timeline).toMatch(/stepTooltip\(altStep\)/);
		expect(timeline).toMatch(/stepTooltip\(item\)/);
		expect(timeline).toMatch(/:aria-label="stepTooltip/);
	});
});

describe('the nature ring never states a weekly target', () => {
	const ring = readFileSync(join(ROOT, 'src/components/trail/NatureRing.vue'), 'utf-8');

	// the api still returns `target` (120); a component the user looks at must not take it, or the
	// figure walks back into the ui the way it already did once
	it('does not accept a target prop', () => {
		expect(ring).not.toMatch(/\btarget\??:/);
		expect(ring).not.toMatch(/props\.target/);
	});

	it('shows no denominator in its label or its aria-label', () => {
		expect(ring).not.toMatch(/of \{\{ target \}\}/);
		expect(ring).not.toMatch(/of \$\{target\}/);
	});

	it('scales on a local constant when there is no personal best', () => {
		expect(ring).toMatch(/FIRST_WEEK_SCALE/);
	});
});

describe('user-facing copy guards', () => {
	for (const { pattern, why } of BANNED) {
		it(`never says ${pattern.source.slice(0, 42)} (${why})`, () => {
			const offenders: string[] = [];

			for (const file of sourceFiles(SRC)) {
				const text = stripComments(readFileSync(file, 'utf-8'));
				const match = text.match(pattern);
				if (match) offenders.push(`${relative(ROOT, file)}: ${match[0]}`);
			}

			expect(offenders).toEqual([]);
		});
	}

	it('strips comments before matching, so a rejection note is allowed to name the figure', () => {
		const stripped = stripComments('// 120 minutes a week is not a target\nconst a = 1;');
		expect(stripped).not.toMatch(/120\s*min(ute)?s?\s*a\s*week/i);
		expect(stripped).toContain('const a = 1;');
	});

	it('still catches the claim outside a comment', () => {
		const stripped = stripComments(`const copy = 'aim for 120 minutes a week';`);
		expect(stripped).toMatch(/120\s*min(ute)?s?\s*a\s*week/i);
	});

	it('does not treat a url as a comment', () => {
		expect(stripComments('const u = "https://earth-app.com";')).toContain('earth-app.com');
	});
});
