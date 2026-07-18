// #region shared

// utc day bucket; the same string all day so tap/dismiss state stays meaningful,
// and it rolls over at midnight utc for free
export function sessionDayKey(date: Date = new Date()): string {
	return date.toISOString().slice(0, 10);
}

function readNumber(key: string): number {
	if (typeof window === 'undefined') return 0;
	try {
		const raw = window.localStorage.getItem(key);
		if (!raw) return 0;
		const n = Number(raw);
		return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
	} catch {
		return 0;
	}
}

function writeNumber(key: string, value: number): void {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(key, String(Math.max(0, Math.floor(value))));
	} catch {
		// storage full / disabled -> nudges silently degrade, never throw
	}
}

function readFlag(key: string): boolean {
	if (typeof window === 'undefined') return false;
	try {
		return window.localStorage.getItem(key) === '1';
	} catch {
		return false;
	}
}

function writeFlag(key: string, value: boolean): void {
	if (typeof window === 'undefined') return;
	try {
		if (value) window.localStorage.setItem(key, '1');
		else window.localStorage.removeItem(key);
	} catch {
		// no-op
	}
}

// #endregion

// #region session cap (finite end-state)

// soft default; the feed keeps scrolling past it, the cap only decides when the
// calm "all caught up" cue appears. tunable per-call. kept above the feed's
// page size (100) so the gentler exit "breather" gets a window on page one before
// the firm end-state lands around page two.
export const DEFAULT_SESSION_CAP = 150;

/**
 * Tracks how many feed items a user has seen today (localStorage/day) and exposes
 * a `reached` flag that drives the "You're All Caught Up" end-state. The feed is
 * never hard-stopped; `continueBrowsing()` lets a user opt back into scrolling
 * for the rest of the session without resetting the day's count.
 */
export function useSessionCap(feed: string, opts: { cap?: number } = {}) {
	const cap = Math.max(1, opts.cap ?? DEFAULT_SESSION_CAP);
	const dateKey = computed(() => sessionDayKey());
	const storageKey = () => `session_cap:${feed}:${dateKey.value}`;

	const count = useState<number>(`session-cap-${feed}`, () => 0);
	const hydrated = useState<boolean>(`session-cap-hydrated-${feed}`, () => false);
	// session-only (not persisted) opt-out so "Keep Browsing" resumes the feed
	const kept = useState<boolean>(`session-cap-kept-${feed}`, () => false);

	function hydrate() {
		if (hydrated.value) return;
		count.value = readNumber(storageKey());
		hydrated.value = true;
	}

	function increment(n = 1) {
		if (!hydrated.value) hydrate();
		if (n <= 0) return count.value;
		count.value = count.value + Math.floor(n);
		writeNumber(storageKey(), count.value);
		return count.value;
	}

	function reset() {
		count.value = 0;
		kept.value = false;
		writeNumber(storageKey(), 0);
	}

	// user chose to keep going past the cap; the cue hides for this session
	function continueBrowsing() {
		kept.value = true;
	}

	const reached = computed(() => count.value >= cap);
	const remaining = computed(() => Math.max(0, cap - count.value));
	const showCaughtUp = computed(() => reached.value && !kept.value);

	if (import.meta.client && !hydrated.value) hydrate();

	return {
		count: readonly(count),
		cap,
		dateKey,
		reached,
		remaining,
		showCaughtUp,
		kept: readonly(kept),
		hydrate,
		increment,
		reset,
		continueBrowsing
	};
}

// #endregion

// #region session intention (entry nudge + push-to-offline exit)

export const SESSION_INTENTIONS = [
	{ value: 'outside', label: 'Get Outside', icon: 'mdi:pine-tree' },
	{ value: 'learn', label: 'Learn Something', icon: 'mdi:lightbulb-on-outline' },
	{ value: 'explore', label: 'Just Explore', icon: 'mdi:compass-outline' },
	{ value: 'people', label: 'Find My People', icon: 'mdi:account-multiple-outline' }
] as const;

export type SessionIntentionValue = (typeof SESSION_INTENTIONS)[number]['value'];

// engagement units before the gentle "take a breather / go outside" exit cue is
// offered; session-scoped so it reflects this visit, dismissible once per day
export const DEFAULT_EXIT_THRESHOLD = 12;

export function useSessionIntention(opts: { exitThreshold?: number } = {}) {
	const exitThreshold = Math.max(1, opts.exitThreshold ?? DEFAULT_EXIT_THRESHOLD);
	const dateKey = computed(() => sessionDayKey());

	const intentionKey = () => `session_intention:${dateKey.value}`;
	const intentionDismissKey = () => `session_intention_dismissed:${dateKey.value}`;
	const exitDismissKey = () => `session_breather_dismissed:${dateKey.value}`;

	const intention = useState<SessionIntentionValue | null>('session-intention', () => null);
	const dismissed = useState<boolean>('session-intention-dismissed', () => false);
	const hydrated = useState<boolean>('session-intention-hydrated', () => false);
	// session-only counter; resets on reload so each visit earns its own exit cue
	const engagement = useState<number>('session-engagement', () => 0);
	const exitDismissed = useState<boolean>('session-breather-dismissed', () => false);

	function hydrate() {
		if (hydrated.value) return;
		if (typeof window !== 'undefined') {
			const raw = (() => {
				try {
					return window.localStorage.getItem(intentionKey());
				} catch {
					return null;
				}
			})();
			intention.value = isIntention(raw) ? raw : null;
			dismissed.value = readFlag(intentionDismissKey());
			exitDismissed.value = readFlag(exitDismissKey());
		}
		hydrated.value = true;
	}

	function setIntention(value: SessionIntentionValue) {
		if (!isIntention(value)) return;
		if (!hydrated.value) hydrate();
		intention.value = value;
		if (typeof window !== 'undefined') {
			try {
				window.localStorage.setItem(intentionKey(), value);
			} catch {
				// no-op
			}
		}
	}

	function dismissIntention() {
		if (!hydrated.value) hydrate();
		dismissed.value = true;
		writeFlag(intentionDismissKey(), true);
	}

	function recordEngagement(n = 1) {
		if (n <= 0) return engagement.value;
		engagement.value = engagement.value + Math.floor(n);
		return engagement.value;
	}

	function dismissExitCue() {
		if (!hydrated.value) hydrate();
		exitDismissed.value = true;
		writeFlag(exitDismissKey(), true);
	}

	// show the entry nudge only once a day, and only until the user acts on it
	const shouldShowIntention = computed(
		() => hydrated.value && !dismissed.value && intention.value === null
	);

	// the exit cue waits for meaningful engagement, then offers once per day
	const shouldShowExitCue = computed(
		() => hydrated.value && !exitDismissed.value && engagement.value >= exitThreshold
	);

	if (import.meta.client && !hydrated.value) hydrate();

	return {
		dateKey,
		intention,
		intentions: SESSION_INTENTIONS,
		engagement: readonly(engagement),
		exitThreshold,
		shouldShowIntention,
		shouldShowExitCue,
		hydrate,
		setIntention,
		dismissIntention,
		recordEngagement,
		dismissExitCue
	};
}

function isIntention(v: unknown): v is SessionIntentionValue {
	return typeof v === 'string' && SESSION_INTENTIONS.some((i) => i.value === v);
}

// #endregion
