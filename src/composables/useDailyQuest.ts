// today's quest — deterministic random quest from the user's interests, refreshes daily
// keep this composable thin: it leans on useQuests() + useAuth() + a localStorage flag

export function useDailyQuest() {
	const { user } = useAuth();
	const { quests, fetchQuests } = useQuests();

	// UTC YYYY-MM-DD so the quest flips at the same instant globally
	const dateKey = computed(() => {
		const now = new Date();
		const y = now.getUTCFullYear();
		const m = String(now.getUTCMonth() + 1).padStart(2, '0');
		const d = String(now.getUTCDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	});

	// djb2-style hash; not cryptographic, just stable
	function hashString(input: string): number {
		let h = 5381;
		for (let i = 0; i < input.length; i++) {
			h = ((h << 5) + h + input.charCodeAt(i)) | 0;
		}
		return Math.abs(h);
	}

	const isLoading = computed(() => quests.value === null);

	// candidate pool — skip premium + mobile_only so taps from web actually open something playable
	const pool = computed<Quest[]>(() => {
		const all = quests.value ?? [];
		return all.filter((q) => !q.premium && !q.mobile_only);
	});

	// prefer quests that match the user's interests via the activity_quest_<id> convention
	const interestPool = computed<Quest[]>(() => {
		const interests = user.value?.activities ?? [];
		if (interests.length === 0) return [];
		const ids = new Set(interests.map((a) => `activity_quest_${a.id}`));
		return pool.value.filter((q) => ids.has(q.id));
	});

	const quest = computed<Quest | null>(() => {
		const seedPool = interestPool.value.length > 0 ? interestPool.value : pool.value;
		if (seedPool.length === 0) return null;
		const seed = `${dateKey.value}:${user.value?.id ?? 'anon'}`;
		const idx = hashString(seed) % seedPool.length;
		return seedPool[idx] ?? null;
	});

	// client-only tap flag — never read storage during SSR
	const tappedKey = computed(() => `daily_quest_tapped:${dateKey.value}`);
	const isTapped = ref(false);

	const refreshTapped = () => {
		if (!import.meta.client) return;
		try {
			isTapped.value = window.localStorage.getItem(tappedKey.value) === '1';
		} catch {
			isTapped.value = false;
		}
	};

	onMounted(() => {
		refreshTapped();
		// kick a fetch if the quests list hasn't been hydrated yet
		if (quests.value === null) void fetchQuests();
	});

	// re-check the flag when the date rolls over mid-session
	watch(tappedKey, () => refreshTapped());

	const markTapped = () => {
		if (!import.meta.client) return;
		isTapped.value = true;
		try {
			window.localStorage.setItem(tappedKey.value, '1');
		} catch {
			// quota / private mode — pulse will reappear, no real harm
		}
	};

	return {
		quest,
		isLoading,
		isTapped,
		markTapped,
		dateKey
	};
}
