import { classifyItemFetch, isHttpResponseEnvelope, normalizeResponseBody } from 'utils';
import { describe, expect, it } from 'vitest';

describe('normalizeResponseBody', () => {
	it('passes a plain object through unchanged (browser path)', () => {
		const obj = { id: 'a1', title: 'Hi' };
		expect(normalizeResponseBody(obj)).toBe(obj);
	});

	it('passes a plain array through unchanged', () => {
		const arr = [{ id: '1' }, { id: '2' }];
		expect(normalizeResponseBody(arr)).toBe(arr);
	});

	it('parses a json string body (native string case)', () => {
		expect(normalizeResponseBody('{"id":"a1","title":"Hi"}')).toEqual({ id: 'a1', title: 'Hi' });
	});

	it('parses a json array string body', () => {
		expect(normalizeResponseBody('[1,2,3]')).toEqual([1, 2, 3]);
	});

	it('leaves a non-json string untouched', () => {
		expect(normalizeResponseBody('Woosh!')).toBe('Woosh!');
	});

	it('leaves an unparseable json-looking string untouched', () => {
		expect(normalizeResponseBody('{not valid json')).toBe('{not valid json');
	});

	it('unwraps the { data } transport envelope', () => {
		const inner = { id: 'e1', host: { id: 'h1' } };
		expect(normalizeResponseBody({ data: inner, status: 200, url: 'x' })).toEqual(inner);
	});

	it('unwraps an envelope whose inner data is itself a json string', () => {
		expect(normalizeResponseBody({ data: '{"id":"p1"}', status: 200 })).toEqual({ id: 'p1' });
	});

	it('parses a stringified envelope then unwraps it', () => {
		expect(normalizeResponseBody('{"data":{"id":"a1"},"status":200}')).toEqual({ id: 'a1' });
	});

	it('does NOT unwrap a real payload that merely has a data field', () => {
		// { data, total } is a legitimate list shape, not the transport envelope
		const payload = { data: [{ id: '1' }], total: 1 };
		expect(normalizeResponseBody(payload)).toBe(payload);
	});

	it('does NOT unwrap when data has no transport sibling', () => {
		const payload = { data: { id: '1' } };
		expect(normalizeResponseBody(payload)).toBe(payload);
	});

	it('handles null / undefined without throwing', () => {
		expect(normalizeResponseBody(null)).toBeNull();
		expect(normalizeResponseBody(undefined)).toBeUndefined();
	});
});

describe('isHttpResponseEnvelope', () => {
	it('matches the strict transport envelope shape', () => {
		expect(isHttpResponseEnvelope({ data: {}, status: 200 })).toBe(true);
		expect(isHttpResponseEnvelope({ data: {}, status: 200, headers: {}, url: 'x' })).toBe(true);
	});

	it('rejects payloads with foreign sibling keys', () => {
		expect(isHttpResponseEnvelope({ data: [], total: 1 })).toBe(false);
		expect(isHttpResponseEnvelope({ data: {}, message: 'hi' })).toBe(false);
	});

	it('rejects a bare { data } (no transport sibling)', () => {
		expect(isHttpResponseEnvelope({ data: {} })).toBe(false);
	});

	it('rejects non-objects / arrays', () => {
		expect(isHttpResponseEnvelope(null)).toBe(false);
		expect(isHttpResponseEnvelope('str')).toBe(false);
		expect(isHttpResponseEnvelope([1, 2])).toBe(false);
	});
});

describe('classifyItemFetch', () => {
	const isThing = (v: unknown): v is { id: string } =>
		!!v && typeof v === 'object' && typeof (v as any).id === 'string';

	it('returns valid for a well-shaped success', () => {
		const res = { success: true as const, data: { id: 'x1' } };
		expect(classifyItemFetch(res, isThing)).toEqual({ kind: 'valid', value: { id: 'x1' } });
	});

	it('returns not_found for an explicit 404', () => {
		expect(classifyItemFetch({ success: false, status: 404 }, isThing)).toEqual({
			kind: 'not_found'
		});
	});

	it('returns not_found for a 200 with a malformed shape', () => {
		// valid envelope (data present) but shape predicate fails -> definitive miss
		const res = { success: true as const, data: { nope: true } };
		expect(classifyItemFetch(res, isThing)).toEqual({ kind: 'not_found' });
	});

	it('returns transient for a 5xx (no data, not 404)', () => {
		expect(classifyItemFetch({ success: false, message: 'boom', status: 500 }, isThing)).toEqual({
			kind: 'transient'
		});
	});

	it('returns transient for a network failure with no status', () => {
		expect(classifyItemFetch({ success: false, message: 'network' }, isThing)).toEqual({
			kind: 'transient'
		});
	});

	it('returns transient for undefined (thrown / no response)', () => {
		expect(classifyItemFetch(undefined, isThing)).toEqual({ kind: 'transient' });
	});

	it('treats a { data } envelope body as valid once normalized upstream', () => {
		// the request layer normalizes before classify sees it, so classify only ever gets the
		// unwrapped shape; assert that unwrapped shape classifies as valid
		const res = {
			success: true as const,
			data: normalizeResponseBody({ data: { id: 'z' }, status: 200 })
		};
		expect(classifyItemFetch(res, isThing)).toEqual({ kind: 'valid', value: { id: 'z' } });
	});
});
