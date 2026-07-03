import { extractServerMessage } from 'errors';
import { DateTime } from 'luxon';
import {
	CONTENT_TTL_DAYS,
	CONTENT_TTL_HEADLINE,
	CONTENT_TTL_HOOK,
	CONTENT_TTL_ICON,
	CONTENT_TTL_LABEL,
	QUEST_DELAY_REDUCTION_BY_RANK,
	apiCache_TEST_ONLY_CLEAR,
	capitalizeFully,
	checkMessageInResponse,
	checkPropertyExists,
	comma,
	computeContentExpiry,
	decodeOAuthUserHandoff,
	describeRemainingTtl,
	getEffectiveQuestStepDelay,
	getQuestDelayReduction,
	getUserDisplayName,
	invalidateAPICache,
	parseLooseDate,
	realFullName,
	shuffle,
	toTitleCase,
	trimString,
	ttlDays,
	ttlHeadline,
	ttlHook,
	ttlLabel,
	valid,
	withSuffix
} from 'utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

describe('toTitleCase', () => {
	it('returns empty string for empty/undefined input', () => {
		expect(toTitleCase('')).toBe('');
		// @ts-expect-error testing undefined guard
		expect(toTitleCase(undefined)).toBe('');
	});

	// BUG: the trailing-strip regex contains the range `?-–` (U+003F..U+2013) which
	// swallows every ASCII letter as "trailing", so each word is emitted as
	// capitalizedCore + the original lowercased word. These assert the correct output.
	it('title-cases a simple sentence', () => {
		expect(toTitleCase('the quick brown fox')).toBe('The Quick Brown Fox');
	});

	it('keeps small words lowercase except first/last', () => {
		expect(toTitleCase('a tale of two cities')).toBe('A Tale of Two Cities');
	});

	it('always capitalizes the last word even if small', () => {
		expect(toTitleCase('war and peace')).toBe('War and Peace');
	});

	it('lowercases the rest of an all-caps word', () => {
		expect(toTitleCase('HELLO WORLD')).toBe('Hello World');
	});
});

describe('capitalizeFully', () => {
	it('returns empty for falsy input', () => {
		expect(capitalizeFully('')).toBe('');
		expect(capitalizeFully(undefined)).toBe('');
	});

	it('capitalizes the first letter of each space-separated part', () => {
		expect(capitalizeFully('hello world')).toBe('Hello World');
	});

	it('lowercases the remainder of each word', () => {
		expect(capitalizeFully('hELLO wORLD')).toBe('Hello World');
	});

	it('handles a single word', () => {
		expect(capitalizeFully('test')).toBe('Test');
	});
});

describe('trimString', () => {
	it('returns the string unchanged when no maxLength', () => {
		expect(trimString('hello')).toBe('hello');
		expect(trimString('hello', 0)).toBe('hello');
		expect(trimString('hello', -5)).toBe('hello');
	});

	it('returns empty for undefined string', () => {
		expect(trimString(undefined, 10)).toBe('');
	});

	it('returns the string untouched when within maxLength', () => {
		expect(trimString('hello', 5)).toBe('hello');
		expect(trimString('hello', 10)).toBe('hello');
	});

	it('truncates and appends ... when too long', () => {
		// slice(0, maxLength-3) + '...'
		expect(trimString('hello world', 8)).toBe('hello...');
		expect(trimString('hello world', 8).length).toBe(8);
	});
});

describe('withSuffix', () => {
	it('returns "0" for falsy / zero', () => {
		expect(withSuffix()).toBe('0');
		expect(withSuffix(0)).toBe('0');
	});

	it('returns plain number under 1000', () => {
		expect(withSuffix(999)).toBe('999');
	});

	it('formats thousands with K', () => {
		expect(withSuffix(1000)).toBe('1.00K');
		expect(withSuffix(1500)).toBe('1.50K');
	});

	it('formats millions with M', () => {
		expect(withSuffix(2_500_000)).toBe('2.50M');
	});

	it('formats billions with B', () => {
		expect(withSuffix(3_000_000_000)).toBe('3.00B');
	});

	it('passes negatives through as plain string (below thresholds)', () => {
		expect(withSuffix(-42)).toBe('-42');
	});
});

describe('comma', () => {
	it('returns "0" for falsy', () => {
		expect(comma()).toBe('0');
		expect(comma(0)).toBe('0');
	});

	it('inserts thousands separators', () => {
		expect(comma(1234)).toBe('1,234');
		expect(comma(1234567)).toBe('1,234,567');
	});

	it('leaves sub-thousand numbers alone', () => {
		expect(comma(999)).toBe('999');
	});

	it('handles negatives', () => {
		expect(comma(-1234)).toBe('-1,234');
	});
});

describe('parseLooseDate', () => {
	it('returns empty string for falsy input', () => {
		expect(parseLooseDate()).toBe('');
		expect(parseLooseDate('')).toBe('');
	});

	it('parses a bare year', () => {
		const dt = parseLooseDate('2025');
		expect(DateTime.isDateTime(dt)).toBe(true);
		expect((dt as DateTime).year).toBe(2025);
	});

	it('parses "LLL yyyy"', () => {
		const dt = parseLooseDate('Jun 2024') as DateTime;
		expect(dt.year).toBe(2024);
		expect(dt.month).toBe(6);
	});

	it('parses "LLLL yyyy"', () => {
		const dt = parseLooseDate('July 2025') as DateTime;
		expect(dt.month).toBe(7);
	});

	it('returns the raw input when unparseable', () => {
		expect(parseLooseDate('not a date')).toBe('not a date');
	});
});

describe('getUserDisplayName', () => {
	it('returns the anonymous default for null/undefined', () => {
		expect(getUserDisplayName(null)).toBe('anonymous');
		expect(getUserDisplayName(undefined)).toBe('anonymous');
	});

	it('honors a custom anonymous label', () => {
		expect(getUserDisplayName(null, { anonymous: 'Guest' })).toBe('Guest');
	});

	it('prefers a real full_name', () => {
		expect(getUserDisplayName({ full_name: 'Jane Smith', username: 'jane' })).toBe('Jane Smith');
	});

	it('ignores the placeholder full_name and falls back to username', () => {
		expect(getUserDisplayName({ full_name: 'John Doe', username: 'jdoe' })).toBe('jdoe');
	});

	it('prepends @ when requested', () => {
		expect(getUserDisplayName({ username: 'jdoe' }, { at: true })).toBe('@jdoe');
	});

	it('does not prepend @ to a real full name even with at:true', () => {
		expect(getUserDisplayName({ full_name: 'Jane Smith', username: 'j' }, { at: true })).toBe(
			'Jane Smith'
		);
	});

	it('falls back to anonymous when username missing', () => {
		expect(getUserDisplayName({}, { anonymous: 'nobody' })).toBe('nobody');
	});
});

describe('realFullName', () => {
	it('returns undefined for falsy', () => {
		expect(realFullName()).toBeUndefined();
		expect(realFullName('')).toBeUndefined();
	});

	it('returns undefined for the placeholder name', () => {
		expect(realFullName('John Doe')).toBeUndefined();
	});

	it('returns a real name unchanged', () => {
		expect(realFullName('Jane Q. Public')).toBe('Jane Q. Public');
	});
});

describe('checkPropertyExists', () => {
	it('returns false for null/undefined', () => {
		expect(checkPropertyExists(null, 'x')).toBe(false);
		expect(checkPropertyExists(undefined, 'x')).toBe(false);
	});

	it('returns false for non-objects', () => {
		expect(checkPropertyExists('str', 'length')).toBe(false);
		expect(checkPropertyExists(5, 'x')).toBe(false);
	});

	it('detects an existing key', () => {
		expect(checkPropertyExists({ a: 1 }, 'a')).toBe(true);
	});

	it('detects an own key set to undefined', () => {
		expect(checkPropertyExists({ a: undefined }, 'a')).toBe(true);
	});

	it('returns false for a missing key', () => {
		expect(checkPropertyExists({ a: 1 }, 'b')).toBe(false);
	});
});

describe('checkMessageInResponse', () => {
	it('is true only for object with string message', () => {
		expect(checkMessageInResponse({ message: 'hi' })).toBe(true);
	});

	it('is false when message is not a string', () => {
		expect(checkMessageInResponse({ message: 42 })).toBe(false);
	});

	it('is false when no message', () => {
		expect(checkMessageInResponse({})).toBe(false);
		expect(checkMessageInResponse(null)).toBe(false);
	});
});

describe('valid', () => {
	it('is false for undefined', () => {
		expect(valid(undefined)).toBe(false);
	});

	it('is true when success is true', () => {
		expect(valid({ success: true, data: { x: 1 } })).toBe(true);
	});

	it('is false when not success and a message is present (checkMessage default)', () => {
		expect(valid({ success: false, message: 'err' })).toBe(false);
	});

	it('is true when not success but data present and no message', () => {
		expect(valid({ success: false, data: { x: 1 } })).toBe(true);
	});

	it('is false when not success, no data, no message', () => {
		expect(valid({ success: false })).toBe(false);
	});

	it('ignores message when checkMessage is false and data present', () => {
		expect(valid({ success: false, message: 'err', data: { x: 1 } }, false)).toBe(true);
	});
});

describe('shuffle', () => {
	it('returns a new array (non-mutating)', () => {
		const src = [1, 2, 3, 4];
		const out = shuffle(src);
		expect(out).not.toBe(src);
		expect(src).toEqual([1, 2, 3, 4]);
	});

	it('preserves all elements (a permutation)', () => {
		const src = [1, 2, 3, 4, 5];
		const out = shuffle(src);
		expect([...out].sort((a, b) => a - b)).toEqual(src);
	});

	it('handles empty and single-element arrays', () => {
		expect(shuffle([])).toEqual([]);
		expect(shuffle([7])).toEqual([7]);
	});

	it('is deterministic when Math.random is stubbed', () => {
		const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
		// with random()=0, j is always 0, so each i swaps with index 0
		const out = shuffle([1, 2, 3]);
		expect([...out].sort()).toEqual([1, 2, 3]);
		spy.mockRestore();
	});
});

describe('quest delay reduction', () => {
	it('maps each known rank', () => {
		expect(QUEST_DELAY_REDUCTION_BY_RANK.FREE).toBe(0);
		expect(getQuestDelayReduction('PRO')).toBe(0.1);
		expect(getQuestDelayReduction('writer')).toBe(0.25);
		expect(getQuestDelayReduction('Organizer')).toBe(0.5);
		expect(getQuestDelayReduction('ADMINISTRATOR')).toBe(1);
	});

	it('returns 0 for unknown / nullish account type', () => {
		expect(getQuestDelayReduction(undefined)).toBe(0);
		expect(getQuestDelayReduction(null)).toBe(0);
		expect(getQuestDelayReduction('GUEST')).toBe(0);
	});
});

describe('getEffectiveQuestStepDelay', () => {
	it('returns 0 for non-positive delays', () => {
		expect(getEffectiveQuestStepDelay(0, 'FREE')).toBe(0);
		expect(getEffectiveQuestStepDelay(-10, 'FREE')).toBe(0);
	});

	it('applies no reduction for FREE', () => {
		expect(getEffectiveQuestStepDelay(100, 'FREE')).toBe(100);
	});

	it('applies the PRO 10% reduction (rounded)', () => {
		expect(getEffectiveQuestStepDelay(100, 'PRO')).toBe(90);
		expect(getEffectiveQuestStepDelay(95, 'PRO')).toBe(86); // 95*0.9 = 85.5 -> round 86
	});

	it('applies the WRITER 25% reduction', () => {
		expect(getEffectiveQuestStepDelay(100, 'WRITER')).toBe(75);
	});

	it('zeroes the delay for ADMINISTRATOR (reduction >= 1)', () => {
		expect(getEffectiveQuestStepDelay(100, 'ADMINISTRATOR')).toBe(0);
	});

	it('treats unknown account as no reduction', () => {
		expect(getEffectiveQuestStepDelay(100, 'whatever')).toBe(100);
	});
});

describe('content ttl maps + accessors', () => {
	it('days map matches accessors', () => {
		expect(CONTENT_TTL_DAYS.prompt).toBe(2);
		expect(CONTENT_TTL_DAYS.prompt_response).toBe(2);
		expect(CONTENT_TTL_DAYS.article).toBe(14);
		expect(CONTENT_TTL_DAYS.event).toBe(30);
		expect(ttlDays('article')).toBe(14);
		expect(ttlDays('event')).toBe(30);
	});

	it('label accessor mirrors the map', () => {
		expect(ttlLabel('prompt')).toBe(CONTENT_TTL_LABEL.prompt);
		expect(ttlLabel('event')).toBe('30 days after the end date');
	});

	it('headline accessor mirrors the map', () => {
		expect(ttlHeadline('article')).toBe(CONTENT_TTL_HEADLINE.article);
		expect(ttlHeadline('prompt')).toBe('Prompts vanish after 2 days');
	});

	it('hook accessor mirrors the map', () => {
		expect(ttlHook('event')).toBe(CONTENT_TTL_HOOK.event);
	});

	it('icon map has an entry per kind', () => {
		expect(CONTENT_TTL_ICON.prompt).toBe('mdi:timer-sand');
		expect(CONTENT_TTL_ICON.article).toBe('mdi:newspaper-variant-outline');
		expect(CONTENT_TTL_ICON.event).toBe('mdi:calendar-clock');
	});
});

describe('describeRemainingTtl', () => {
	it('returns null for already-expired content', () => {
		expect(describeRemainingTtl(0, 1000)).toBeNull();
		expect(describeRemainingTtl(1, 1000)).toBeNull(); // remainingMs === 0 -> null
	});

	it('labels 3+ days with "low" urgency', () => {
		const r = describeRemainingTtl(3 * 86400, 0)!;
		expect(r.label).toBe('3 days');
		expect(r.urgency).toBe('low');
	});

	it('labels exactly 2 days with "medium" urgency', () => {
		const r = describeRemainingTtl(2 * 86400, 0)!;
		expect(r.label).toBe('2 days');
		expect(r.urgency).toBe('medium');
	});

	it('labels one day plus hours', () => {
		const r = describeRemainingTtl(86400 + 3600, 0)!;
		expect(r.label).toBe('1 day, 1 hour');
		expect(r.urgency).toBe('medium');
	});

	it('labels hours-only with "high" urgency and pluralizes', () => {
		const r = describeRemainingTtl(5 * 3600, 0)!;
		expect(r.label).toBe('5 hours');
		expect(r.urgency).toBe('high');
	});

	it('singularizes one hour', () => {
		expect(describeRemainingTtl(3600, 0)!.label).toBe('1 hour');
	});

	it('labels minutes when under an hour', () => {
		expect(describeRemainingTtl(30 * 60, 0)!.label).toBe('30 minutes');
		expect(describeRemainingTtl(60, 0)!.label).toBe('1 minute');
	});

	// BUG: with <1 minute remaining, minutes floors to 0 so the plural branch fires while
	// the value is clamped to 1, producing "1 minutes". correct grammar is "1 minute".
	it('clamps sub-minute remaining to a grammatical "1 minute"', () => {
		expect(describeRemainingTtl(30, 0)!.label).toBe('1 minute');
	});

	it('uses Date.now() by default', () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		const r = describeRemainingTtl(2 * 86400)!;
		expect(r.label).toBe('2 days');
		vi.useRealTimers();
	});
});

describe('computeContentExpiry', () => {
	it('expires from creation for non-event kinds', () => {
		expect(computeContentExpiry('prompt', 1000)).toBe(1000 + 2 * 86400);
		expect(computeContentExpiry('article', 1000)).toBe(1000 + 14 * 86400);
	});

	it('expires 30 days after the event end when provided', () => {
		expect(computeContentExpiry('event', 1000, 5000)).toBe(5000 + 30 * 86400);
	});

	it('falls back to created time for events without an end', () => {
		expect(computeContentExpiry('event', 1000)).toBe(1000 + 30 * 86400);
	});
});

describe('api cache helpers', () => {
	afterEach(() => {
		apiCache_TEST_ONLY_CLEAR();
	});

	it('invalidateAPICache and TEST_ONLY_CLEAR run without throwing', () => {
		expect(() => invalidateAPICache('some-key')).not.toThrow();
		expect(() => apiCache_TEST_ONLY_CLEAR()).not.toThrow();
	});
});

// sanity: util re-exports errors' extractServerMessage indirectly via makeServerRequest; just
// confirm the dependency import resolves under the nuxt env
describe('errors dependency', () => {
	it('extractServerMessage is importable', () => {
		expect(extractServerMessage('x')).toBe('x');
	});
});

// the oauth callback encodes the user as base64(utf-8 json); the auth plugin decodes it to set
// currentUser without a /v2/users/current round-trip. test the decode against that exact format
describe('decodeOAuthUserHandoff', () => {
	const encode = (u: unknown) => Buffer.from(JSON.stringify(u), 'utf8').toString('base64');

	it('round-trips a user object encoded the way the callback encodes it', () => {
		const user = { id: 'u1', username: 'alice', account: { account_type: 'FREE' } };
		expect(decodeOAuthUserHandoff(encode(user))).toEqual(user);
	});

	it('preserves unicode in user fields', () => {
		const user = { id: 'u1', username: 'rené', full_name: 'José 🌍' };
		expect(decodeOAuthUserHandoff(encode(user))).toEqual(user);
	});

	it('returns null for empty / malformed / non-base64 input', () => {
		expect(decodeOAuthUserHandoff(null)).toBeNull();
		expect(decodeOAuthUserHandoff('')).toBeNull();
		expect(decodeOAuthUserHandoff('!!!not base64 json!!!')).toBeNull();
		// valid base64 of a non-json string
		expect(decodeOAuthUserHandoff(Buffer.from('hello', 'utf8').toString('base64'))).toBeNull();
	});
});
