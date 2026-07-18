import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	DEFAULT_EXIT_THRESHOLD,
	DEFAULT_SESSION_CAP,
	sessionDayKey,
	useSessionCap,
	useSessionIntention
} from '~/composables/useSession';

// finite-session cap + once-per-day intention nudge + engagement-gated exit cue.
// all localStorage-backed and day-gated; no e2e drives the storage/day edges.

function resetState(feed = 'activities') {
	useState<number>(`session-cap-${feed}`, () => 0).value = 0;
	useState<boolean>(`session-cap-hydrated-${feed}`, () => false).value = false;
	useState<boolean>(`session-cap-kept-${feed}`, () => false).value = false;
	useState('session-intention', () => null).value = null;
	useState('session-intention-dismissed', () => false).value = false;
	useState('session-intention-hydrated', () => false).value = false;
	useState('session-engagement', () => 0).value = 0;
	useState('session-breather-dismissed', () => false).value = false;
}

beforeEach(() => {
	window.localStorage.clear();
	resetState();
});

describe('sessionDayKey', () => {
	it('returns a stable UTC YYYY-MM-DD bucket', () => {
		expect(sessionDayKey(new Date('2026-07-18T23:59:00Z'))).toBe('2026-07-18');
		expect(sessionDayKey(new Date('2026-07-19T00:01:00Z'))).toBe('2026-07-19');
	});
});

describe('useSessionCap', () => {
	it('exposes a tunable cap and defaults to DEFAULT_SESSION_CAP', () => {
		expect(useSessionCap('activities').cap).toBe(DEFAULT_SESSION_CAP);
		expect(useSessionCap('activities', { cap: 5 }).cap).toBe(5);
	});

	it('counts items and flips reached / showCaughtUp at the cap', () => {
		const cap = useSessionCap('activities', { cap: 3 });
		expect(cap.reached.value).toBe(false);
		cap.increment(2);
		expect(cap.count.value).toBe(2);
		expect(cap.reached.value).toBe(false);
		cap.increment(1);
		expect(cap.count.value).toBe(3);
		expect(cap.reached.value).toBe(true);
		expect(cap.showCaughtUp.value).toBe(true);
	});

	it('ignores non-positive increments', () => {
		const cap = useSessionCap('activities', { cap: 5 });
		cap.increment(0);
		cap.increment(-3);
		expect(cap.count.value).toBe(0);
	});

	it('continueBrowsing hides the cue without resetting the count', () => {
		const cap = useSessionCap('activities', { cap: 2 });
		cap.increment(2);
		expect(cap.showCaughtUp.value).toBe(true);
		cap.continueBrowsing();
		expect(cap.showCaughtUp.value).toBe(false);
		expect(cap.reached.value).toBe(true); // still capped, just opted back in
		expect(cap.count.value).toBe(2);
	});

	it('reset zeroes the count and clears the opt-in', () => {
		const cap = useSessionCap('activities', { cap: 2 });
		cap.increment(2);
		cap.continueBrowsing();
		cap.reset();
		expect(cap.count.value).toBe(0);
		expect(cap.kept.value).toBe(false);
		expect(cap.showCaughtUp.value).toBe(false);
	});

	it('persists the day count and rehydrates a fresh session', () => {
		useSessionCap('activities', { cap: 100 }).increment(7);
		const key = `session_cap:activities:${sessionDayKey()}`;
		expect(Number(window.localStorage.getItem(key))).toBe(7);

		// simulate a reload: drop the in-memory state, re-read from storage
		resetState();
		expect(useSessionCap('activities', { cap: 100 }).count.value).toBe(7);
	});

	it('buckets the count per UTC day', () => {
		vi.useFakeTimers();
		try {
			vi.setSystemTime(new Date('2026-07-18T10:00:00Z'));
			useSessionCap('activities').increment(4);
			expect(window.localStorage.getItem('session_cap:activities:2026-07-18')).toBe('4');

			vi.setSystemTime(new Date('2026-07-19T10:00:00Z'));
			resetState();
			const next = useSessionCap('activities');
			expect(next.count.value).toBe(0); // new day, empty bucket
		} finally {
			vi.useRealTimers();
		}
	});

	it('treats corrupt stored counts as zero', () => {
		window.localStorage.setItem(`session_cap:activities:${sessionDayKey()}`, 'not-a-number');
		expect(useSessionCap('activities').count.value).toBe(0);
	});
});

describe('useSessionIntention', () => {
	it('shows the entry nudge once, then hides after a choice', () => {
		const s = useSessionIntention();
		expect(s.shouldShowIntention.value).toBe(true);
		s.setIntention('outside');
		expect(s.intention.value).toBe('outside');
		expect(s.shouldShowIntention.value).toBe(false);
		expect(window.localStorage.getItem(`session_intention:${s.dateKey.value}`)).toBe('outside');
	});

	it('hides the nudge after dismissal and persists it for the day', () => {
		const s = useSessionIntention();
		s.dismissIntention();
		expect(s.shouldShowIntention.value).toBe(false);
		expect(window.localStorage.getItem(`session_intention_dismissed:${s.dateKey.value}`)).toBe('1');
	});

	it('ignores an invalid intention value', () => {
		const s = useSessionIntention();
		s.setIntention('garbage' as any);
		expect(s.intention.value).toBe(null);
		expect(s.shouldShowIntention.value).toBe(true);
	});

	it('rehydrates a dismissed nudge from storage', () => {
		const first = useSessionIntention();
		first.dismissIntention();
		resetState();
		expect(useSessionIntention().shouldShowIntention.value).toBe(false);
	});

	it('gates the exit cue on engagement and defaults the threshold', () => {
		const s = useSessionIntention();
		expect(s.exitThreshold).toBe(DEFAULT_EXIT_THRESHOLD);
		expect(s.shouldShowExitCue.value).toBe(false);
		s.recordEngagement(DEFAULT_EXIT_THRESHOLD - 1);
		expect(s.shouldShowExitCue.value).toBe(false);
		s.recordEngagement(1);
		expect(s.shouldShowExitCue.value).toBe(true);
	});

	it('respects a custom exit threshold and non-positive engagement', () => {
		const s = useSessionIntention({ exitThreshold: 3 });
		s.recordEngagement(0);
		s.recordEngagement(-5);
		expect(s.shouldShowExitCue.value).toBe(false);
		s.recordEngagement(3);
		expect(s.shouldShowExitCue.value).toBe(true);
	});

	it('dismisses the exit cue for the day', () => {
		const s = useSessionIntention({ exitThreshold: 1 });
		s.recordEngagement(1);
		expect(s.shouldShowExitCue.value).toBe(true);
		s.dismissExitCue();
		expect(s.shouldShowExitCue.value).toBe(false);
		expect(window.localStorage.getItem(`session_breather_dismissed:${s.dateKey.value}`)).toBe('1');
	});
});

afterEach(() => {
	vi.useRealTimers();
});
