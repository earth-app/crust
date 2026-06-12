<template>
	<div
		class="relative w-full p-4 rounded-xl bg-linear-to-br from-amber-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 border-2 border-amber-200/60 dark:border-amber-900/40 shadow-md transition-transform duration-300"
		:class="hoverClass"
	>
		<div class="flex items-center justify-between mb-3">
			<div class="flex items-center gap-2">
				<UIcon
					name="mdi:fire"
					class="size-6 text-orange-500"
				/>
				<h2 class="text-base sm:text-lg font-semibold tracking-wide">Your Journey Streaks</h2>
			</div>
			<span class="text-xs opacity-60 hidden sm:block">Resets After 48h of Inactivity</span>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
			<div
				v-for="(row, idx) in rows"
				:key="row.type"
				class="relative flex flex-col items-center justify-between py-3 px-2 rounded-lg overflow-hidden transition-colors"
				:class="cellClass(row)"
			>
				<div class="flex items-center gap-2 mb-1">
					<UIcon
						:name="row.icon"
						class="size-5"
						:class="row.count > 0 ? 'text-primary-500' : 'text-gray-400'"
					/>
					<span class="text-xs sm:text-sm font-medium uppercase tracking-wider opacity-80">{{
						row.label
					}}</span>
				</div>

				<div class="flex items-baseline gap-2 my-1">
					<UiCountUp
						:value="row.count"
						:duration="700"
						class="text-3xl sm:text-4xl font-bold leading-none"
						:class="row.count > 0 ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'"
					/>
					<UBadge
						v-if="row.rank > 0"
						:label="`#${row.rank}`"
						variant="subtle"
						color="primary"
						size="sm"
					/>
				</div>

				<div
					class="mt-1 text-[11px] sm:text-xs font-medium tabular-nums"
					:class="row.expiringSoon ? 'text-red-600 dark:text-red-400' : 'opacity-70'"
				>
					<template v-if="row.count === 0">Start Today</template>
					<template v-else-if="row.expiringSoon"> Expires Soon · {{ row.countdown }} </template>
					<template v-else>{{ row.countdown }} Left</template>
				</div>

				<UiSparkleBurst
					:trigger="sparkleTriggers[idx] ?? 0"
					color="warning"
					:count="22"
				/>
			</div>
		</div>

		<NuxtLink
			v-if="showQuestCta"
			to="/profile/quests/"
			class="mt-4 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary-500/10 hover:bg-primary-500/20 text-primary-600 dark:text-primary-300 text-sm font-medium transition-colors"
		>
			<UIcon
				name="mdi:flag-checkered"
				class="size-4"
			/>
			<span>Try a Quest to Keep Your Streak Alive</span>
		</NuxtLink>
	</div>
</template>

<script setup lang="ts">
type JourneyType = 'article' | 'prompt' | 'event';

const { user: currentUser } = useAuth();

const props = defineProps<{
	user: User;
}>();

const { fetchCurrentJourney, fetchCurrentJourneyRank } = useAuth();
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

const ROWS: { type: JourneyType; label: string; icon: string }[] = [
	{ type: 'article', label: 'Articles', icon: 'mdi:newspaper' },
	{ type: 'prompt', label: 'Prompts', icon: 'mdi:pencil' },
	{ type: 'event', label: 'Events', icon: 'mdi:calendar-star' }
];

const STREAK_TTL_MS = 172800000;
const WARN_THRESHOLD_MS = 12 * 60 * 60 * 1000;

const counts = reactive<Record<JourneyType, number>>({ article: 0, prompt: 0, event: 0 });
const ranks = reactive<Record<JourneyType, number>>({ article: 0, prompt: 0, event: 0 });
const lastWrites = reactive<Record<JourneyType, number>>({ article: 0, prompt: 0, event: 0 });
const sparkleTriggers = reactive<Record<number, number>>({});

// ticks once per minute so countdowns refresh without thrashing raf
const now = ref(Date.now());
let tickHandle: ReturnType<typeof setInterval> | null = null;

function formatRemaining(ms: number): string {
	if (ms <= 0) return '0h 0m';
	const totalMinutes = Math.floor(ms / 60000);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return `${hours}h ${minutes}m`;
}

const rows = computed(() =>
	ROWS.map((r) => {
		const lw = lastWrites[r.type];
		const expiresAt = lw ? lw + STREAK_TTL_MS : 0;
		const remaining = expiresAt - now.value;
		const expiringSoon = counts[r.type] > 0 && remaining > 0 && remaining < WARN_THRESHOLD_MS;
		return {
			...r,
			count: counts[r.type],
			rank: ranks[r.type],
			countdown: formatRemaining(remaining),
			expiringSoon
		};
	})
);

// quest-funnel: nudge when any streak is about to die or user has nothing going yet
const showQuestCta = computed(() => {
	if (!currentUser || props.user.id !== currentUser.value?.id) return false;
	const anyExpiring = rows.value.some((r) => r.expiringSoon);
	const allZero = rows.value.every((r) => r.count === 0);
	return anyExpiring || allZero;
});

const hoverClass = computed(() =>
	prefersReducedMotion.value ? '' : 'hover:scale-[1.01] hover:shadow-lg'
);

function cellClass(row: ReturnType<typeof rows.value.at>) {
	if (!row) return '';
	if (row.expiringSoon) return 'bg-red-50/80 dark:bg-red-950/30 ring-1 ring-red-300/60';
	if (row.count > 0) return 'bg-white/70 dark:bg-gray-800/40';
	return 'bg-gray-100/60 dark:bg-gray-800/20 opacity-80';
}

async function loadOne(type: JourneyType, id: string) {
	const [countRes, rankRes] = await Promise.all([
		fetchCurrentJourney(type, id).catch(() => null),
		fetchCurrentJourneyRank(type, id).catch(() => null)
	]);

	if (countRes && valid(countRes)) {
		counts[type] = countRes.data.count ?? 0;
		lastWrites[type] = countRes.data.lastWrite ?? 0;
	}
	if (rankRes && valid(rankRes) && 'rank' in rankRes.data) {
		ranks[type] = rankRes.data.rank ?? 0;
	}
}

async function loadAll() {
	if (!props.user?.id) return;
	await Promise.all(ROWS.map((r) => loadOne(r.type, props.user.id)));
}

function onJourneyUpdated(ev: Event) {
	const detail = (ev as CustomEvent<{ type: JourneyType; count: number }>).detail;
	if (!detail) return;
	const idx = ROWS.findIndex((r) => r.type === detail.type);
	if (idx === -1) return;
	const prevCount = counts[detail.type];
	counts[detail.type] = detail.count;
	lastWrites[detail.type] = Date.now();
	// only burst on a real increment so re-fetches don't fire confetti
	if (detail.count > prevCount && !prefersReducedMotion.value) {
		sparkleTriggers[idx] = (sparkleTriggers[idx] ?? 0) + 1;
	}
	// refresh rank in the background since it may have moved
	if (props.user?.id)
		void fetchCurrentJourneyRank(detail.type, props.user.id).then((r) => {
			if (r && valid(r) && 'rank' in r.data) ranks[detail.type] = r.data.rank ?? 0;
		});
}

onMounted(() => {
	void loadAll();
	if (import.meta.client) {
		window.addEventListener('earth-app:journey-updated', onJourneyUpdated);
		tickHandle = setInterval(() => {
			now.value = Date.now();
		}, 60000);
	}
});

onBeforeUnmount(() => {
	if (import.meta.client) {
		window.removeEventListener('earth-app:journey-updated', onJourneyUpdated);
	}
	if (tickHandle) clearInterval(tickHandle);
});

watch(
	() => props.user?.id,
	(id) => {
		if (id) void loadAll();
	}
);
</script>
