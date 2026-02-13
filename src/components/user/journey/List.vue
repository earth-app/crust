<template>
	<div
		class="p-4 bg-white dark:bg-gray-900 rounded-lg shadow border-2 border-gray-200 dark:border-gray-700"
	>
		<h2 class="text-lg font-semibold mb-4">@{{ user.username }}'s Journeys</h2>
		<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
			<UserJourneyProgress
				v-if="!loading"
				icon="mdi:leaf"
				title="Activities"
				:count="state.activity.count"
				:total="totalActivities"
				help="Visit and read about activities to increase this number."
			/>
			<UserJourneyProgressSkeleton v-else />
			<UserJourneyProgress
				v-if="!loading"
				icon="mdi:pencil"
				title="Prompts"
				:count="state.prompt.count"
				:rank="state.prompt.rank"
				help="Respond to prompts to increase this number."
				leaderboard="prompt"
			/>
			<UserJourneyProgressSkeleton v-else />
			<UserJourneyProgress
				v-if="!loading"
				icon="mdi:newspaper"
				title="Articles"
				:count="state.article.count"
				:rank="state.article.rank"
				help="Read articles to increase this number."
				leaderboard="article"
			/>
			<UserJourneyProgressSkeleton v-else />
			<UserJourneyProgress
				v-if="!loading"
				icon="mdi:calendar-star"
				title="Events"
				:count="state.event.count"
				:rank="state.event.rank"
				help="Attend events to increase this number."
				leaderboard="event"
			/>
			<UserJourneyProgressSkeleton v-else />
		</div>
	</div>
</template>

<script setup lang="ts">
import type { User } from '~/shared/types/user';

const props = defineProps<{
	user: User;
}>();

const toast = useToast();

const loading = ref(false);
const state = reactive({
	activity: { rank: 0, count: 0 },
	prompt: { rank: 0, count: 0 },
	article: { rank: 0, count: 0 },
	event: { rank: 0, count: 0 }
});
const { count: totalActivities } = useActivitiesCount();

onMounted(async () => {
	loading.value = true;

	// Retrieve journey values
	const journeyTypes = ['activity', 'event', 'prompt', 'article'] as const;

	await Promise.all(
		journeyTypes.map(async (type) => {
			// Fetch count
			const countRes = await getCurrentJourney(type, props.user.id);
			if (countRes.success && countRes.data) {
				if ('message' in countRes.data) {
					toast.add({
						title: 'Error',
						description: (countRes.data.message || 'Failed to fetch journey data.') as string,
						icon: 'mdi:alert-circle-outline',
						color: 'error'
					});
				} else if ('count' in countRes.data) {
					state[type].count = countRes.data.count;
				}
			} else {
				toast.add({
					title: 'Error',
					description: countRes.message || 'Failed to fetch journey data.',
					icon: 'mdi:alert-circle-outline',
					color: 'error'
				});
			}

			// Fetch rank
			if (type !== 'activity') {
				const rankRes = await getCurrentJourneyRank(type, props.user.id);
				if (rankRes.success && rankRes.data && 'rank' in rankRes.data) {
					state[type].rank = rankRes.data.rank;
				}
			}
		})
	);

	loading.value = false;
});
</script>
