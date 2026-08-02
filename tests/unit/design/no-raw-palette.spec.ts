// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * A RATCHET, not a big-bang gate.
 *
 * Raw tailwind palette classes and the ui.colors semantic tokens are two parallel colour systems.
 * The migration off the raw one runs directory by directory, and `src/components/**` is published
 * to sky through package.json.files, so it moves last and deliberately. This spec locks whatever
 * has already been migrated so it cannot slide back, and MIGRATED grows as each batch lands.
 *
 * To widen it: migrate a directory, then add its glob prefix here. If that makes this fail, the
 * directory was not actually finished.
 */

const PROJECT_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');

// prefixes already migrated to semantic tokens
const MIGRATED = [
	'src/pages',
	'src/layouts',
	'src/components/legal',
	'src/components/onboarding',
	'src/components/report',
	'src/components/content',
	'src/components/activity',
	'src/components/prompt',
	'src/components/trailmark',
	'src/components/trail',
	'src/components/session',
	'src/components/feed',
	'src/components/article',
	'src/components/event'
];

// these paint to a <canvas>, drive a deliberately fixed-contrast harness, or need a genuinely
// neutral scrim -- a literal colour is the correct thing and a token would be indirection
const EXEMPT = new Set([
	'src/pages/__test__/drag-harness.vue',
	'src/pages/__test__/quest-harness.vue',
	'src/pages/__test__/widget-harness.vue',
	// a scrim behind text over a photo has to be black in both themes to stay readable
	'src/components/event/submission/Preview.vue'
]);

const FAMILIES =
	'gray|slate|zinc|stone|blue|green|red|amber|yellow|emerald|lime|purple|teal|orange|cyan|sky|indigo|violet|fuchsia|pink|rose';
const SHADE = '(?:50|100|200|300|400|500|600|700|800|900|950)';

const RAW_PALETTE = new RegExp(`\\b[a-z-]+-(?:${FAMILIES})-${SHADE}\\b`, 'g');
const RAW_BW = /\b(?:text|bg|border|fill|stroke|divide)-(?:white|black)\b/g;
const RAW_HEX = /class="[^"]*#[0-9a-fA-F]{3,6}\b[^"]*"/g;

function vueFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...vueFiles(full));
		else if (extname(entry.name) === '.vue') out.push(full);
	}
	return out;
}

function offenders(): string[] {
	const found: string[] = [];

	for (const prefix of MIGRATED) {
		for (const file of vueFiles(join(PROJECT_ROOT, prefix))) {
			const rel = relative(PROJECT_ROOT, file);
			if (EXEMPT.has(rel)) continue;

			const text = readFileSync(file, 'utf8');
			for (const [label, pattern] of [
				['raw palette', RAW_PALETTE],
				['raw white/black', RAW_BW],
				['hex in class', RAW_HEX]
			] as const) {
				for (const match of text.match(pattern) ?? []) {
					found.push(`${rel}: ${label} "${match}"`);
				}
			}
		}
	}

	return found;
}

describe('migrated directories stay on semantic colour tokens', () => {
	it('has no raw palette, white/black or hex colour left', () => {
		expect(
			offenders(),
			'use the ui.colors semantic tokens (text-muted / bg-elevated / border-default) or an ' +
				'e-text-* utility for coloured text; -500 is a fill tone and fails AA as text'
		).toEqual([]);
	});

	// a ratchet that covers nothing is a no-op, so prove it is actually reading files
	it('scans a non-trivial number of files', () => {
		const scanned = MIGRATED.flatMap((p) => vueFiles(join(PROJECT_ROOT, p)));
		expect(scanned.length).toBeGreaterThan(20);
	});
});
