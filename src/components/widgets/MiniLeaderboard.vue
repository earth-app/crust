<template>
	<UCard
		variant="soft"
		class="relative min-w-72 max-w-md p-4 shadow-md rounded-xl bg-linear-to-br from-warning/10 via-primary/5 to-transparent overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
		@click="$router.push(`/leaderboard?tab=${metric}&scope=${scope}`)"
	>
		<div class="flex items-center gap-2 mb-3">
			<UIcon
				name="mdi:trophy-variant"
				class="size-5 text-warning"
			/>
			<h3 class="text-sm font-semibold uppercase tracking-wide text-muted">
				{{ heading }}
			</h3>
		</div>
		<div
			v-if="loading"
			class="text-xs text-muted py-4 text-center"
		>
			Loading leaderboard...
		</div>
		<div
			v-else-if="rows.length === 0"
			class="text-xs text-muted py-6 text-center flex flex-col items-center gap-2"
		>
			<UIcon
				name="mdi:medal-outline"
				class="size-8 text-muted/60"
			/>
			<p>{{ emptyText }}</p>
			<p class="text-[10px]">Be the first on the board.</p>
		</div>
		<ul
			v-else
			class="flex flex-col gap-2"
		>
			<li
				v-for="row in rows"
				:key="row.id"
				class="flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer hover:bg-primary/5"
				:class="row.isSelf ? 'bg-primary/10 ring-1 ring-primary/40' : ''"
				@click="navigate(row.id)"
			>
				<span
					class="font-mono font-bold text-sm w-6 text-center"
					:class="rankColor(row.rank)"
				>
					#{{ row.rank }}
				</span>
				<UAvatar
					:src="row.avatarSrc"
					:alt="row.username"
					size="sm"
				/>
				<div class="flex-1 min-w-0">
					<p class="text-sm font-semibold truncate">
						{{ row.fullName }}
					</p>
					<p class="text-xs text-muted truncate">@{{ row.username }}</p>
				</div>
				<UBadge
					color="warning"
					variant="soft"
					size="sm"
					:icon="metric === 'points' ? 'mdi:star-four-points' : 'mdi:fire'"
				>
					{{ metric === 'points' ? withSuffix(row.value) : row.value }}
				</UBadge>
			</li>
		</ul>
	</UCard>
</template>

<script setup lang="ts">
import type { LeaderboardMetric, LeaderboardScope } from 'types/user';

const props = withDefaults(
	defineProps<{
		scope?: LeaderboardScope;
		metric?: LeaderboardMetric;
	}>(),
	{ metric: 'points', scope: 'global' }
);

const metric = computed<LeaderboardMetric>(() => props.metric);

const router = useRouter();
const { leaderboard, fetchLeaderboard } = useLeaderboard(metric.value, props.scope);
const { user: currentUser } = useAuth();
const avatarStore = useAvatarStore();

const loading = ref(true);
onMounted(async () => {
	try {
		await fetchLeaderboard(10);
	} finally {
		loading.value = false;
	}
});

const metricLabel = computed(() =>
	metric.value === 'points'
		? 'Impact Points'
		: metric.value.charAt(0).toUpperCase() + metric.value.slice(1) + ' Streaks'
);

const scopeLabel = computed(() => {
	if (props.scope === 'friends') return 'Friends';
	if (props.scope === 'circle') return 'Circle';
	return 'Top';
});

const heading = computed(() => `${scopeLabel.value} ${metricLabel.value}`);

const emptyText = computed(() =>
	metric.value === 'points'
		? 'No impact points on the board yet.'
		: `No active ${metric.value} streaks yet.`
);

const rows = computed(() =>
	leaderboard.value.slice(0, 3).map((entry, i) => {
		const url = entry.user.account?.avatar_url;
		const avatarSrc = avatarStore.safeUrl(url, 'avatar128');
		return {
			id: entry.id,
			rank: entry.rank ?? i + 1,
			username: entry.user.username ?? '',
			fullName: entry.user.full_name ?? entry.user.username ?? '',
			value: entry.value,
			avatarSrc,
			isSelf: currentUser.value?.id === entry.id
		};
	})
);

// prefetch avatar blobs for top 3
watch(
	rows,
	(list) => {
		for (const row of list) {
			const url = leaderboard.value.find((e) => e.id === row.id)?.user.account?.avatar_url;
			if (url) void avatarStore.fetchAvatarBlobs(url);
		}
	},
	{ immediate: true }
);

function rankColor(rank: number): string {
	if (rank === 1) return 'text-warning';
	if (rank === 2) return 'text-muted';
	if (rank === 3) return 'text-secondary';
	return 'text-muted';
}

function navigate(id: string) {
	void router.push(`/profile/${id}`);
}
</script>
