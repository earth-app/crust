// @vitest-environment node

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const PROJECT_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

// regression: a SiteTour that auto-plays on mount renders a fixed-position dim
// layer + tooltip card that swallows clicks, so any e2e spec on that page fails
// with "subtree intercepts pointer events" (this is what broke the trails specs).
// the playwright fixture pre-marks those tours complete; this keeps that list in
// sync with the actual startTourIfNew call sites instead of trusting memory.
const SRC = join(PROJECT_ROOT, 'src');
const FIXTURES = join(PROJECT_ROOT, 'tests/e2e/utils/fixtures.ts');

function sourceFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...sourceFiles(full));
		else if (/\.(vue|ts)$/.test(entry.name)) out.push(full);
	}
	return out;
}

function autoStartedTourIds(): string[] {
	const ids = new Set<string>();
	for (const file of sourceFiles(SRC)) {
		const src = readFileSync(file, 'utf-8');
		for (const m of src.matchAll(/startTourIfNew\(\s*['"]([^'"]+)['"]/g)) ids.add(m[1]!);
	}
	return [...ids].sort();
}

// read the fixture as text: importing it would pull @playwright/test into vitest
function suppressedTourIds(): string[] {
	const src = readFileSync(FIXTURES, 'utf-8');
	const block = /export const AUTO_START_TOUR_IDS = \[([^\]]*)\]/.exec(src);
	expect(block, 'AUTO_START_TOUR_IDS must exist in tests/e2e/utils/fixtures.ts').toBeTruthy();
	return [...block![1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!).sort();
}

describe('e2e tour suppression', () => {
	it('finds at least one auto-started tour to guard', () => {
		expect(autoStartedTourIds().length).toBeGreaterThan(0);
	});

	it('suppresses every tour that auto-plays on mount', () => {
		expect(suppressedTourIds()).toEqual(autoStartedTourIds());
	});
});
