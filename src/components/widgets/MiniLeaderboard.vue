<template>
	<UCard
		variant="soft"
		class="relative min-w-72 max-w-md p-4 shadow-md rounded-xl bg-linear-to-br from-warning/10 via-primary/5 to-transparent overflow-hidden"
	>
		<div class="flex items-center gap-2 mb-3">
			<UIcon
				name="mdi:trophy-variant"
				class="size-5 text-warning"
			/>
			<h3 class="text-sm font-semibold uppercase tracking-wide text-muted">
				Top {{ typeLabel }} Streaks
			</h3>
		</div>
		<div
			v-if="loading"
			class="text-xs text-muted py-4 text-center"
		>
			Loading top streaks...
		</div>
		<div
			v-else-if="rows.length === 0"
			class="text-xs text-muted py-6 text-center flex flex-col items-center gap-2"
		>
			<UIcon
				name="mdi:medal-outline"
				class="size-8 text-muted/60"
			/>
			<p>No active {{ typeLabel.toLowerCase() }} streaks yet.</p>
			<p class="text-[10px]">Be the first to start one.</p>
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
					icon="mdi:fire"
				>
					{{ row.streak }}
				</UBadge>
			</li>
		</ul>
	</UCard>
</template>

<script setup lang="ts">
const props = defineProps<{
	type: 'article' | 'prompt' | 'event';
}>();

const router = useRouter();
const { leaderboard, fetchLeaderboard } = useJourneyLeaderboard(props.type);
const { user: currentUser } = useAuth();
const avatarStore = useAvatarStore();

// initial-fetch loading flag. leaderboard.value can be empty either because we haven't
// fetched yet or because there are genuinely no streaks - distinguish so the empty UI
// only shows after we've actually heard back from the backend.
const loading = ref(leaderboard.value.length === 0);
onMounted(async () => {
	if (leaderboard.value.length > 0) {
		loading.value = false;
		return;
	}
	try {
		await fetchLeaderboard(10);
	} finally {
		loading.value = false;
	}
});

const typeLabel = computed(() => {
	const t = props.type;
	return t.charAt(0).toUpperCase() + t.slice(1);
});

const rows = computed(() =>
	leaderboard.value.slice(0, 3).map((entry, i) => {
		const url = entry.user.account?.avatar_url;
		const cached = url ? avatarStore.get(url)?.avatar128 : undefined;
		const avatarSrc =
			cached || (url ? `${url}${url.includes('?') ? '&' : '?'}size=128` : undefined);
		return {
			id: entry.id,
			rank: i + 1,
			username: entry.user.username ?? '',
			fullName: entry.user.full_name ?? entry.user.username ?? '',
			streak: entry.streak,
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
