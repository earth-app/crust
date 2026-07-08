<template>
	<div class="flex flex-col items-center min-w-120 w-full min-h-50 px-2">
		<h1 class="font-semibold text-lg mb-2">{{ metricLabel }} Leaderboard (Showing {{ size }})</h1>

		<UTabs
			v-model="scope"
			:items="scopeItems"
			class="w-full max-w-md mb-3"
			size="sm"
		/>

		<div class="flex items-center gap-2 mb-3 flex-wrap justify-center">
			<UButton
				v-for="m in metricItems"
				:key="m.value"
				:color="metric === m.value ? 'primary' : 'neutral'"
				:variant="metric === m.value ? 'solid' : 'soft'"
				:icon="m.icon"
				size="sm"
				@click="metric = m.value"
			>
				{{ m.label }}
			</UButton>
		</div>

		<UInputNumber
			v-model="size"
			:min="5"
			:step="15"
			:max="100"
			placeholder="Change how big the table should be"
			variant="subtle"
		/>

		<p
			v-if="scope !== 'global' && !isAuthenticated"
			class="text-sm text-muted my-4 text-center"
		>
			Sign in to see how you stack up against your {{ scope }}.
		</p>
		<UTable
			v-else
			:columns="columns"
			:data="visibleRows"
			:loading="loading"
			class="w-full"
		/>
	</div>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';
import type { LeaderboardMetric, LeaderboardScope } from 'types/user';
import type { EffectScope } from 'vue';

const props = withDefaults(
	defineProps<{
		initialTab?: LeaderboardMetric;
		initialScope?: LeaderboardScope;
		questId?: string;
	}>(),
	{ initialTab: 'points', initialScope: 'global' }
);

const authStore = useAuthStore();
const isAuthenticated = computed(() => authStore.isAuthenticated);

const metric = ref<LeaderboardMetric>(props.initialTab || 'points');
const scope = ref<LeaderboardScope>(props.initialScope);
const size = ref<number>(10);

const scopeItems = [
	{ label: 'Global', value: 'global' as const },
	{ label: 'Friends', value: 'friends' as const },
	{ label: 'Circle', value: 'circle' as const }
];

const metricItems = [
	{ label: 'Points', value: 'points' as const, icon: 'mdi:star-four-points' },
	{ label: 'Articles', value: 'article' as const, icon: 'mdi:newspaper' },
	{ label: 'Prompts', value: 'prompt' as const, icon: 'mdi:lightbulb-on-outline' },
	{ label: 'Events', value: 'event' as const, icon: 'mdi:calendar-star' }
];

const metricLabel = computed(
	() => metricItems.find((m) => m.value === metric.value)?.label ?? 'Leaderboard'
);

const UserCard = resolveComponent('UserCard');
const ChallengeButton = resolveComponent('UserChallengeFriendButton');

type Row = {
	rank: number;
	id: string;
	user: User;
	value: number;
};

const data = ref<Row[]>([]);
const loading = ref(true);

// hide 0-streak entries in friends/circle streak boards; points + global stay unfiltered
const visibleRows = computed(() =>
	scope.value !== 'global' && metric.value !== 'points'
		? data.value.filter((row) => row.value > 0)
		: data.value
);

let bindingScope: EffectScope | null = null;
let fetchCurrent: ((limit: number) => Promise<void>) | null = null;

function bind() {
	bindingScope?.stop();
	bindingScope = effectScope();
	bindingScope.run(() => {
		const { leaderboard, fetchLeaderboard } = useLeaderboard(metric.value, scope.value);
		fetchCurrent = fetchLeaderboard;
		watch(
			leaderboard,
			(next) => {
				data.value = next.map((entry, index) => ({
					rank: entry.rank ?? index + 1,
					id: entry.id,
					user: entry.user,
					value: entry.value
				}));
			},
			{ immediate: true }
		);
	});
}

// rebind to the metric+scope state (its immediate watcher paints any cached rows), then
// only hit the network when that keyed state has nothing cached yet — switching back to
// an already-loaded tab is instant with no refetch. size changes force a refresh.
async function load(force = false) {
	bind();
	if (!force && data.value.length > 0) {
		loading.value = false;
		return;
	}
	loading.value = true;
	try {
		await fetchCurrent?.(size.value);
	} finally {
		loading.value = false;
	}
}

onMounted(() => load());
watch([metric, scope], () => load());
watch(size, () => load(true));
onScopeDispose(() => bindingScope?.stop());

const valueHeader = computed(() => {
	if (metric.value === 'points') return 'Impact Points';
	return 'Current Streak';
});

const columns = computed<TableColumn<Row>[]>(() => {
	const cols: TableColumn<Row>[] = [
		{
			accessorKey: 'rank',
			header: 'Rank',
			cell: ({ row }) => `#${row.original.rank}`
		},
		{
			accessorKey: 'user',
			header: 'User',
			cell: ({ row }) => h(UserCard, { user: row.original.user })
		},
		{
			accessorKey: 'value',
			header: valueHeader.value,
			cell: ({ row }) => {
				const v = row.original.value;
				if (metric.value === 'points') return comma(v);
				return `${v} day${v !== 1 ? 's' : ''}`;
			}
		}
	];

	// challenge column only for non-global friend rows that aren't yourself
	if (scope.value !== 'global') {
		cols.push({
			accessorKey: 'challenge',
			header: '',
			cell: ({ row }) => {
				const isSelf = authStore.currentUser?.id === row.original.id;
				if (isSelf) return null;
				return h(ChallengeButton, {
					size: 'md',
					friendId: row.original.id,
					friendName: getUserDisplayName(row.original.user, { at: true })
				});
			}
		});
	}

	return cols;
});
</script>
