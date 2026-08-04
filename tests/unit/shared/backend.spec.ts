// @vitest-environment node
import {
	blocksApp,
	classifyCloud,
	classifyMantle,
	classifyTransportFailure,
	isServerFault,
	reportRequestOutcome,
	setRequestOutcomeListener,
	STATUS_PAGE_URL,
	SUPPORT_PAGE_URL
} from 'backend';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => setRequestOutcomeListener(null));

describe('classifyMantle', () => {
	it('reads an explicit active status', () => {
		expect(classifyMantle(200, { status: 'active' })).toBe('active');
	});

	it('reads an explicit maintenance status', () => {
		expect(classifyMantle(200, { status: 'maintenance' })).toBe('maintenance');
	});

	it('ignores casing and surrounding whitespace', () => {
		expect(classifyMantle(200, { status: '  MAINTENANCE ' })).toBe('maintenance');
		expect(classifyMantle(200, { status: 'Active' })).toBe('active');
	});

	it('treats every 5xx as an outage', () => {
		for (const status of [500, 502, 503, 504, 599]) {
			expect(classifyMantle(status, null)).toBe('outage');
		}
	});

	// the whole point of the fail-open policy: an ambiguous answer must not blank the app
	it('does not block on an unrecognised status string', () => {
		expect(classifyMantle(200, { status: 'degraded' })).toBe('unknown');
	});

	it('does not block on a body with no status at all', () => {
		expect(classifyMantle(200, {})).toBe('unknown');
		expect(classifyMantle(200, null)).toBe('unknown');
		expect(classifyMantle(200, 'Woosh!')).toBe('unknown');
	});

	it('does not block on 3xx or 4xx, which describe the request not the backend', () => {
		for (const status of [301, 400, 401, 403, 404, 429]) {
			expect(classifyMantle(status, null)).toBe('unknown');
		}
	});
});

describe('classifyCloud', () => {
	it('accepts any 2xx as up', () => {
		expect(classifyCloud(200)).toBe('up');
		expect(classifyCloud(204)).toBe('up');
	});

	it('treats 5xx as down', () => {
		expect(classifyCloud(500)).toBe('down');
		expect(classifyCloud(503)).toBe('down');
	});

	it('does not call a 4xx a cloud outage', () => {
		expect(classifyCloud(404)).toBe('unknown');
	});
});

describe('classifyTransportFailure', () => {
	it('is an outage when the device has a network', () => {
		expect(classifyTransportFailure(true)).toBe('outage');
	});

	// otherwise the offline banner and the outage gate both fire and contradict each other
	it('is unknown when the device is offline, so offline owns that message', () => {
		expect(classifyTransportFailure(false)).toBe('unknown');
	});
});

describe('blocksApp', () => {
	it('blocks only on maintenance and outage', () => {
		expect(blocksApp('maintenance')).toBe(true);
		expect(blocksApp('outage')).toBe(true);
		expect(blocksApp('active')).toBe(false);
		expect(blocksApp('unknown')).toBe(false);
	});
});

describe('isServerFault', () => {
	it('accepts 5xx only', () => {
		expect(isServerFault(500)).toBe(true);
		expect(isServerFault(503)).toBe(true);
		expect(isServerFault(499)).toBe(false);
		expect(isServerFault(404)).toBe(false);
		expect(isServerFault(200)).toBe(false);
	});

	it('rejects a missing status rather than guessing', () => {
		expect(isServerFault(null)).toBe(false);
		expect(isServerFault(undefined)).toBe(false);
	});
});

describe('outcome bridge', () => {
	it('forwards a reported status to the listener', () => {
		const seen = vi.fn();
		setRequestOutcomeListener(seen);
		reportRequestOutcome(503);
		expect(seen).toHaveBeenCalledWith(503);
	});

	// makeRequest reports 0 when it never got a response; that is not a status
	it('drops a zero or non-finite status', () => {
		const seen = vi.fn();
		setRequestOutcomeListener(seen);
		reportRequestOutcome(0);
		reportRequestOutcome(Number.NaN);
		expect(seen).not.toHaveBeenCalled();
	});

	it('is silent with no listener registered', () => {
		expect(() => reportRequestOutcome(500)).not.toThrow();
	});
});

describe('escape hatches', () => {
	it('points at the real status and support hosts', () => {
		expect(STATUS_PAGE_URL).toBe('https://status.earth-app.com');
		expect(SUPPORT_PAGE_URL).toBe('https://support.earth-app.com');
	});
});
