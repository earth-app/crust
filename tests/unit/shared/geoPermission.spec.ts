import { describe, expect, it } from 'vitest';
import {
	type GeoPermissionState,
	geoPermissionView,
	normalizeGeoPermission
} from '~/shared/utils/geoPermission';

describe('normalizeGeoPermission', () => {
	it('passes through the three real Permissions API states', () => {
		expect(normalizeGeoPermission('granted')).toBe('granted');
		expect(normalizeGeoPermission('denied')).toBe('denied');
		expect(normalizeGeoPermission('prompt')).toBe('prompt');
	});

	it('maps anything unexpected to unknown', () => {
		expect(normalizeGeoPermission(undefined)).toBe('unknown');
		expect(normalizeGeoPermission(null)).toBe('unknown');
		expect(normalizeGeoPermission('')).toBe('unknown');
		expect(normalizeGeoPermission('weird')).toBe('unknown');
	});
});

describe('geoPermissionView', () => {
	const states: GeoPermissionState[] = ['granted', 'denied', 'prompt', 'unsupported', 'unknown'];

	it('returns a well-formed view for every state', () => {
		for (const s of states) {
			const v = geoPermissionView(s);
			expect(v.state).toBe(s);
			expect(v.label.length).toBeGreaterThan(0);
			expect(v.description.length).toBeGreaterThan(0);
			expect(v.icon).toMatch(/^mdi:/);
		}
	});

	it('keeps every label in Title Case', () => {
		for (const s of states) {
			const label = geoPermissionView(s).label;
			expect(label[0]).toBe(label[0]?.toUpperCase());
		}
	});

	it('marks only granted as ready', () => {
		expect(geoPermissionView('granted').ready).toBe(true);
		for (const s of ['denied', 'prompt', 'unsupported', 'unknown'] as GeoPermissionState[]) {
			expect(geoPermissionView(s).ready).toBe(false);
		}
	});

	it('marks only denied as blocked', () => {
		expect(geoPermissionView('denied').blocked).toBe(true);
		for (const s of ['granted', 'prompt', 'unsupported', 'unknown'] as GeoPermissionState[]) {
			expect(geoPermissionView(s).blocked).toBe(false);
		}
	});

	it('offers a retry for the recoverable states, not for granted/unsupported', () => {
		expect(geoPermissionView('denied').canRetry).toBe(true);
		expect(geoPermissionView('prompt').canRetry).toBe(true);
		expect(geoPermissionView('unknown').canRetry).toBe(true);
		expect(geoPermissionView('granted').canRetry).toBe(false);
		expect(geoPermissionView('unsupported').canRetry).toBe(false);
	});

	it('uses success for granted and warning for denied', () => {
		expect(geoPermissionView('granted').color).toBe('success');
		expect(geoPermissionView('denied').color).toBe('warning');
	});
});
