export interface PersonalBestFraming {
	// current has met or exceeded the stored best (a fresh high)
	isNewBest: boolean;
	// current is above zero but below the best
	chasing: boolean;
	// short headline label, Title Case
	label: string;
	// how far under the best (0 when at/above best)
	delta: number;
	// optional "N min to Beat Your Best" style nudge, present only while chasing
	toBeatLabel?: string;
}

export function personalBestFraming(
	current: number,
	best: number,
	opts: { unit?: string } = {}
): PersonalBestFraming {
	const cur = Math.max(0, Math.round(current || 0));
	const bst = Math.max(0, Math.round(best || 0));
	const unit = opts.unit ? ` ${opts.unit}` : '';

	if (cur <= 0) {
		return { isNewBest: false, chasing: false, label: 'Just Getting Started', delta: 0 };
	}

	// at or above the previous best -> a personal record
	if (bst > 0 && cur >= bst) {
		return { isNewBest: true, chasing: false, label: 'Your Longest Yet', delta: 0 };
	}

	// no prior best on record yet -> this is the new baseline
	if (bst <= 0) {
		return { isNewBest: true, chasing: false, label: 'Your Longest Yet', delta: 0 };
	}

	const delta = bst - cur;
	return {
		isNewBest: false,
		chasing: true,
		label: `Personal Best: ${bst}${unit}`,
		delta,
		toBeatLabel: `${delta}${unit} to Beat Your Best`
	};
}

function bestKey(key: string): string {
	return `personal_best:${key}`;
}

function readBest(key: string): number {
	if (typeof window === 'undefined') return 0;
	try {
		const raw = window.localStorage.getItem(bestKey(key));
		if (!raw) return 0;
		const n = Number(raw);
		return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
	} catch {
		return 0;
	}
}

function writeBest(key: string, value: number): void {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(bestKey(key), String(Math.max(0, Math.floor(value))));
	} catch {
		// no-op
	}
}

export function usePersonalBest(key: string) {
	const best = useState<number>(`personal-best-${key}`, () => 0);
	const hydrated = useState<boolean>(`personal-best-hydrated-${key}`, () => false);

	function hydrate() {
		if (hydrated.value) return;
		best.value = readBest(key);
		hydrated.value = true;
	}

	// returns true when `value` set a new personal best
	function record(value: number): boolean {
		if (!hydrated.value) hydrate();
		const v = Math.max(0, Math.round(value || 0));
		if (v > best.value) {
			best.value = v;
			writeBest(key, v);
			return true;
		}
		return false;
	}

	function framing(current: number, opts: { unit?: string } = {}) {
		if (!hydrated.value) hydrate();
		return personalBestFraming(current, best.value, opts);
	}

	function reset() {
		best.value = 0;
		writeBest(key, 0);
	}

	if (import.meta.client && !hydrated.value) hydrate();

	return { best: readonly(best), hydrate, record, framing, reset };
}

export interface InformationalRewardInput {
	// tangible point count (kept for math elsewhere; framed, not dangled)
	points?: number;
	// what the user can now DO/access (badge, feature, cosmetic, area)
	unlocks?: string;
}

export function informationalReward(input: InformationalRewardInput): string {
	if (input.unlocks && input.unlocks.trim()) {
		return `You Can Now ${input.unlocks.trim()}`;
	}
	if (input.points && input.points > 0) {
		// still informational: names what the impact does, not "earn N"
		return 'Your Impact Grows';
	}
	return 'A New Milestone';
}
