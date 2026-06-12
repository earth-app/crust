import { extractErrorPayload, extractServerMessage, looksLikeRawHttpError } from 'errors';
import { describe, expect, it } from 'vitest';

describe('looksLikeRawHttpError', () => {
	it('returns false for empty string', () => {
		expect(looksLikeRawHttpError('')).toBe(false);
	});

	it('flags the raw "[400] FetchError" template', () => {
		expect(looksLikeRawHttpError('[400] FetchError: boom')).toBe(true);
		expect(looksLikeRawHttpError('[500] fetcherror lowercase')).toBe(true);
	});

	it('flags the "did not fail" leak', () => {
		expect(looksLikeRawHttpError('/v2/foo did not fail')).toBe(true);
		expect(looksLikeRawHttpError('this Did Not Fail at all')).toBe(true);
	});

	it('does not flag a clean backend message', () => {
		expect(looksLikeRawHttpError('Email verification required')).toBe(false);
	});

	it('only matches the http prefix at the start', () => {
		// "[400]" not at the start should not match the prefix rule
		expect(looksLikeRawHttpError('error: [400] FetchError later')).toBe(false);
	});
});

describe('extractServerMessage', () => {
	it('uses the safe fallback for null/undefined', () => {
		expect(extractServerMessage(null)).toBe('Something went wrong. Please try again.');
		expect(extractServerMessage(undefined)).toBe('Something went wrong. Please try again.');
	});

	it('honors a provided fallback', () => {
		expect(extractServerMessage(null, 'custom fallback')).toBe('custom fallback');
		expect(extractServerMessage({}, 'custom fallback')).toBe('custom fallback');
	});

	it('returns a trimmed plain string error', () => {
		expect(extractServerMessage('  real reason  ')).toBe('real reason');
	});

	it('replaces a raw http string error with the fallback', () => {
		expect(extractServerMessage('[400] FetchError: garbage', 'fb')).toBe('fb');
	});

	it('returns whitespace-only string as fallback (isString rejects blank)', () => {
		expect(extractServerMessage('   ', 'fb')).toBe('fb');
	});

	it('prefers a string data field', () => {
		expect(extractServerMessage({ data: '  data string  ' })).toBe('data string');
	});

	it('skips a raw-http string data and falls through', () => {
		expect(extractServerMessage({ data: '[400] FetchError: bad', message: 'good message' })).toBe(
			'good message'
		);
	});

	it('prefers data.message over statusMessage and message', () => {
		expect(
			extractServerMessage({
				data: { message: 'data.message wins' },
				statusMessage: 'status',
				message: 'msg'
			})
		).toBe('data.message wins');
	});

	it('falls to data.error.message when data.message missing', () => {
		expect(extractServerMessage({ data: { error: { message: 'nested error message' } } })).toBe(
			'nested error message'
		);
	});

	it('falls to data.error string when no nested message', () => {
		expect(extractServerMessage({ data: { error: 'string error' } })).toBe('string error');
	});

	it('falls to statusMessage when data has nothing usable', () => {
		expect(extractServerMessage({ statusMessage: 'status reason' })).toBe('status reason');
	});

	it('falls to top-level message last', () => {
		expect(extractServerMessage({ message: 'top message' })).toBe('top message');
	});

	it('skips raw-http top-level message and uses fallback', () => {
		expect(extractServerMessage({ message: '[404] FetchError: x' }, 'fb')).toBe('fb');
	});

	it('respects the documented precedence: data.message before data.error.message', () => {
		expect(
			extractServerMessage({
				data: { message: 'primary', error: { message: 'secondary' } }
			})
		).toBe('primary');
	});

	it('trims nested values', () => {
		expect(extractServerMessage({ data: { message: '  spaced  ' } })).toBe('spaced');
	});

	it('returns fallback for a number primitive', () => {
		expect(extractServerMessage(42, 'fb')).toBe('fb');
	});
});

describe('extractErrorPayload', () => {
	it('returns just message + undefined code/reason for a bare string', () => {
		expect(extractErrorPayload('plain reason')).toEqual({
			code: undefined,
			message: 'plain reason',
			reason: undefined
		});
	});

	it('pulls code and reason out of data', () => {
		expect(
			extractErrorPayload({
				data: { code: 403, reason: 'REAUTH_REQUIRED', message: 'reauth needed' }
			})
		).toEqual({
			code: 403,
			message: 'reauth needed',
			reason: 'REAUTH_REQUIRED'
		});
	});

	it('drops a non-finite code', () => {
		const out = extractErrorPayload({ data: { code: NaN, message: 'm' } });
		expect(out.code).toBeUndefined();
		expect(out.message).toBe('m');
	});

	it('drops a non-number code', () => {
		const out = extractErrorPayload({ data: { code: '403', message: 'm' } });
		expect(out.code).toBeUndefined();
	});

	it('drops a blank reason', () => {
		const out = extractErrorPayload({ data: { reason: '   ', message: 'm' } });
		expect(out.reason).toBeUndefined();
	});

	it('uses fallback message when nothing usable', () => {
		expect(extractErrorPayload(null, 'fb').message).toBe('fb');
	});
});
