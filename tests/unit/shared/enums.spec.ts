// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	ACCOUNT_TYPE,
	ACTIVITY_TYPE,
	COUNTRIES,
	COUNTRY,
	isActivityType,
	isVisibility,
	PRIVACY,
	toAccountType,
	toActivityType,
	toCountry,
	toPrivacy,
	toVisibility,
	VISIBILITY
} from 'types/enums';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('wire contract', () => {
	it('pins the visibility members', () => {
		expect([...VISIBILITY]).toEqual(['PRIVATE', 'UNLISTED', 'PUBLIC']);
	});

	it('pins the account type members', () => {
		expect([...ACCOUNT_TYPE]).toEqual(['FREE', 'PRO', 'WRITER', 'ORGANIZER', 'ADMINISTRATOR']);
	});

	it('pins the privacy members', () => {
		expect([...PRIVACY]).toEqual(['PRIVATE', 'CIRCLE', 'MUTUAL', 'PUBLIC']);
	});

	it('pins the activity type members', () => {
		expect(ACTIVITY_TYPE).toHaveLength(25);
		expect(ACTIVITY_TYPE[0]).toBe('HOBBY');
		expect(ACTIVITY_TYPE.at(-1)).toBe('OTHER');
	});

	it('keeps all 195 countries', () => {
		expect(COUNTRY).toHaveLength(195);
		expect(COUNTRIES).toHaveLength(195);
	});

	// ordinal is an index now, and three call sites index icon/description arrays by it
	it('keeps COUNTRIES in the same order as COUNTRY', () => {
		expect(COUNTRIES.map((c) => c.name)).toEqual([...COUNTRY]);
	});
});

describe('country data', () => {
	it('carries the fields the profile editor renders', () => {
		const us = COUNTRIES.find((c) => c.name === 'UNITED_STATES');
		expect(us).toMatchObject({
			countryName: 'United States',
			code: 'US',
			flagEmoji: '🇺🇸',
			phonePrefix: '+1'
		});
	});

	// the editor disables the option on `!code`, so this blank is load-bearing
	it('leaves INTERNATIONAL without a country code', () => {
		const intl = COUNTRIES.find((c) => c.name === 'INTERNATIONAL');
		expect(intl?.code).toBe('');
		expect(intl?.flagEmoji).toBe('🌐');
	});

	it('gives every other country a code and a flag', () => {
		const missing = COUNTRIES.filter((c) => c.name !== 'INTERNATIONAL').filter(
			(c) => !c.code || !c.flagEmoji
		);
		expect(missing.map((c) => c.name)).toEqual([]);
	});
});

describe('coercion', () => {
	it('passes through a known member', () => {
		expect(toVisibility('UNLISTED')).toBe('UNLISTED');
		expect(toActivityType('SPORT')).toBe('SPORT');
	});

	/* ocean's valueOf THREW on an unknown name. the backend can add a member before the frontend
	   ships, and taking the page down over a value we simply have not heard of yet is worse than
	   rendering the fallback */
	it('falls back instead of throwing on an unknown member', () => {
		expect(() => toVisibility('SOMETHING_NEW')).not.toThrow();
		expect(toVisibility('SOMETHING_NEW')).toBe('PUBLIC');
		expect(toAccountType('SOMETHING_NEW')).toBe('FREE');
		expect(toPrivacy('SOMETHING_NEW')).toBe('PRIVATE');
		expect(toActivityType('SOMETHING_NEW')).toBe('OTHER');
		expect(toCountry('SOMETHING_NEW')).toBe('INTERNATIONAL');
	});

	it('falls back on non-strings', () => {
		expect(toVisibility(null)).toBe('PUBLIC');
		expect(toVisibility(undefined)).toBe('PUBLIC');
		expect(toVisibility(7)).toBe('PUBLIC');
		expect(toVisibility({})).toBe('PUBLIC');
	});

	it('honours an explicit fallback', () => {
		expect(toVisibility('nope', 'PRIVATE')).toBe('PRIVATE');
	});

	it('guards narrow correctly', () => {
		expect(isVisibility('PUBLIC')).toBe(true);
		expect(isVisibility('public')).toBe(false); // case-sensitive, like the backend
		expect(isActivityType('OTHER')).toBe(true);
		expect(isActivityType('')).toBe(false);
	});
});

/*
 * The whole point of the migration: ocean shipped a kotlin-js runtime that cost 2.73 MB server-side
 * and 1.33 MB client-side to provide five string lists and one country table.
 */
describe('the dependency stays gone', () => {
	function sourceFiles(dir: string): string[] {
		const out: string[] = [];
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) out.push(...sourceFiles(full));
			else if (['.ts', '.vue'].includes(extname(entry.name))) out.push(full);
		}
		return out;
	}

	it('is not imported anywhere in src', () => {
		const offenders: string[] = [];
		for (const file of sourceFiles(join(ROOT, 'src'))) {
			const text = readFileSync(file, 'utf-8');
			if (/from '@earth-app\/ocean'|require\('@earth-app\/ocean'\)/.test(text)) {
				offenders.push(relative(ROOT, file));
			}
		}
		expect(offenders).toEqual([]);
	});

	it('is not declared as a dependency', () => {
		const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
		expect(pkg.dependencies?.['@earth-app/ocean']).toBeUndefined();
		expect(pkg.devDependencies?.['@earth-app/ocean']).toBeUndefined();
	});

	it('is not referenced by the build config', () => {
		for (const config of ['nuxt.config.ts', 'nuxt.config.library.ts']) {
			expect(readFileSync(join(ROOT, config), 'utf-8')).not.toContain('@earth-app/ocean');
		}
	});

	it('imports the replacement inside the script block, not above it', () => {
		const offenders: string[] = [];
		for (const file of sourceFiles(join(ROOT, 'src'))) {
			if (extname(file) !== '.vue') continue;

			const lines = readFileSync(file, 'utf-8').split('\n');
			const script = lines.findIndex((line) => line.startsWith('<script'));
			const imported = lines.findIndex((line) => /^import .* from 'types\/enums';/.test(line));
			if (imported !== -1 && (script === -1 || imported < script)) {
				offenders.push(`${relative(ROOT, file)}:${imported + 1}`);
			}
		}
		expect(offenders).toEqual([]);
	});
});
