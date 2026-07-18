import { useTrailsStore } from 'stores/trails';

export function isoWeekKey(date: Date = new Date()): string {
	const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
	const day = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - day);
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
	return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

interface WeeklyBucket {
	questsDone: number;
	curiosityTouched: number;
	updatedAt: number;
}

function bucketStorageKey(week: string): string {
	return `weekly_reflection:${week}`;
}

function readBucket(week: string): WeeklyBucket {
	const empty: WeeklyBucket = { questsDone: 0, curiosityTouched: 0, updatedAt: 0 };
	if (typeof window === 'undefined') return empty;
	try {
		const raw = window.localStorage.getItem(bucketStorageKey(week));
		if (!raw) return empty;
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object') return empty;
		const q = Number((parsed as WeeklyBucket).questsDone);
		const c = Number((parsed as WeeklyBucket).curiosityTouched);
		return {
			questsDone: Number.isFinite(q) && q >= 0 ? Math.floor(q) : 0,
			curiosityTouched: Number.isFinite(c) && c >= 0 ? Math.floor(c) : 0,
			updatedAt: Number((parsed as WeeklyBucket).updatedAt) || 0
		};
	} catch {
		return empty;
	}
}

function writeBucket(week: string, bucket: WeeklyBucket): void {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(bucketStorageKey(week), JSON.stringify(bucket));
	} catch {
		// no-op
	}
}

export function useWeeklyReflection() {
	const trailsStore = useTrailsStore();
	const weekKey = computed(() => isoWeekKey());

	const questsDone = useState<number>('weekly-reflection-quests', () => 0);
	const curiosityTouched = useState<number>('weekly-reflection-curiosity', () => 0);
	const hydratedWeek = useState<string | null>('weekly-reflection-week', () => null);

	function hydrate() {
		const wk = weekKey.value;
		if (hydratedWeek.value === wk) return;
		const bucket = readBucket(wk);
		questsDone.value = bucket.questsDone;
		curiosityTouched.value = bucket.curiosityTouched;
		hydratedWeek.value = wk;
	}

	function persist() {
		writeBucket(weekKey.value, {
			questsDone: questsDone.value,
			curiosityTouched: curiosityTouched.value,
			updatedAt: Date.now()
		});
	}

	function recordQuestDone(n = 1) {
		if (n <= 0) return;
		hydrate();
		questsDone.value += Math.floor(n);
		persist();
	}

	function recordCuriosity(n = 1) {
		if (n <= 0) return;
		hydrate();
		curiosityTouched.value += Math.floor(n);
		persist();
	}

	function refresh() {
		hydratedWeek.value = null;
		hydrate();
	}

	function reset() {
		questsDone.value = 0;
		curiosityTouched.value = 0;
		hydratedWeek.value = weekKey.value;
		persist();
	}

	// server-tracked, this week; nature-minutes store is never fetched at ssr setup
	const minutesOutside = computed(() => Math.max(0, trailsStore.natureMinutes?.minutes ?? 0));
	// trail-step reveals credited this week, a real derived floor for "moments of wonder"
	const revealsFromSources = computed(
		() => (trailsStore.natureMinutes?.sources ?? []).filter((s) => s.kind === 'trail_step').length
	);
	// take the higher of the client bucket and the server-derived floor
	const wonderCount = computed(() => Math.max(curiosityTouched.value, revealsFromSources.value));

	const hasActivity = computed(
		() => minutesOutside.value > 0 || questsDone.value > 0 || wonderCount.value > 0
	);

	// a warm, self-referential closing line; never a comparison or a nag
	const summaryLine = computed(() => {
		if (!hasActivity.value) {
			return 'A fresh week is open. One small step outside is a good place to begin.';
		}
		if (minutesOutside.value > 0) {
			return `You spent ${minutesOutside.value} minutes outside this week. That time was yours.`;
		}
		return 'You showed up for your curiosity this week. That counts.';
	});

	if (import.meta.client) hydrate();

	return {
		weekKey,
		minutesOutside,
		questsDone: readonly(questsDone),
		curiosityTouched: wonderCount,
		hasActivity,
		summaryLine,
		// marker: this surface is finite (a single card that ends)
		isFinite: true as const,
		hydrate,
		refresh,
		reset,
		recordQuestDone,
		recordCuriosity
	};
}
