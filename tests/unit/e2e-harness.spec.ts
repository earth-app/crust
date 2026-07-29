// @vitest-environment node

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const PROJECT_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

// regression: a hardcoded 127.0.0.1:3000 in fixtures.ts sent the per-test mock reset to
// whatever else owned 3000, so the origin may only be written next to its env fallback
const E2E = join(PROJECT_ROOT, 'tests/e2e');
// matches both the plain literal and the regex-escaped `127\.0\.0\.1:3000` form specs use
const ORIGIN = /(?:127\.0\.0\.1|localhost):(\d+)/;
const MOCK_PORTS = ['8787', '8788', '9898', '9899'];
const ENV_FALLBACK = 'process.env.PLAYWRIGHT_BASE_URL';

function specFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...specFiles(full));
		else if (entry.name.endsWith('.ts')) out.push(full);
	}
	return out;
}

// mock servers own their own ports; only the app origin has to follow the base URL
function isAppOrigin(line: string): boolean {
	const match = ORIGIN.exec(line.replace(/\\/g, ''));
	if (!match) return false;
	return !MOCK_PORTS.includes(match[1]!);
}

function hardcodedOrigins(): string[] {
	const offenders: string[] = [];
	for (const file of specFiles(E2E)) {
		const relative = file.slice(PROJECT_ROOT.length + 1);
		readFileSync(file, 'utf-8')
			.split('\n')
			.forEach((line, index) => {
				const trimmed = line.trim();
				if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
				if (line.includes(ENV_FALLBACK)) return;
				if (isAppOrigin(line)) offenders.push(`${relative}:${index + 1}`);
			});
	}
	return offenders;
}

describe('e2e harness base URL', () => {
	it('scans the e2e tree', () => {
		expect(specFiles(E2E).length).toBeGreaterThan(20);
	});

	it('never hardcodes the app origin outside its env fallback', () => {
		expect(hardcodedOrigins()).toEqual([]);
	});
});
