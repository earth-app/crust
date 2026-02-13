<template>
	<div class="flex flex-col items-center min-w-120 w-full min-h-50 px-2">
		<h1 class="font-semibold text-lg mb-2">
			{{ capitalizeFully(props.type) }} Leaderboard (Showing {{ size }})
		</h1>
		<UInputNumber
			v-model="size"
			:min="5"
			:step="15"
			:max="100"
			placeholder="Change how big the table should be"
			variant="subtle"
		/>
		<UTable
			:columns="columns"
			:data="data"
			:loading="data.length === 0"
		/>
	</div>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';
import type { User } from '~/shared/types/user';
import { capitalizeFully } from '~/shared/util';

const props = defineProps<{
	type: 'event' | 'prompt' | 'article';
}>();

const { leaderboard, fetchLeaderboard } = useJourneyLeaderboard(props.type);

const UserCard = resolveComponent('UserCard');

type LeaderboardEntry = {
	rank: number;
	user: User;
	streak: number;
};

const size = ref<number>(10);
const data = ref<LeaderboardEntry[]>([]);

watch(
	leaderboard,
	(newLeaderboard) => {
		data.value = newLeaderboard.map((entry, index) => ({
			rank: index + 1,
			user: entry.user,
			streak: entry.streak
		}));
	},
	{ immediate: true }
);

watch(size, (newSize) => {
	fetchLeaderboard(newSize);
});

const columns: TableColumn<LeaderboardEntry>[] = [
	{
		accessorKey: 'rank',
		header: 'Rank',
		cell: ({ row }) => `#${row.original.rank}`
	},
	{
		accessorKey: 'user',
		header: 'User',
		cell: ({ row }) => {
			const user = row.original.user;
			return h(UserCard, { user });
		}
	},
	{
		accessorKey: 'streak',
		header: 'Current Streak',
		cell: ({ row }) => `${row.original.streak} day${row.original.streak !== 1 ? 's' : ''}`
	}
];
</script>
