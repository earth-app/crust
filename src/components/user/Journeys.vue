<template>
	<div
		class="p-4 bg-white dark:bg-gray-900 rounded-lg shadow border-2 border-gray-200 dark:border-gray-700"
	>
		<h2 class="text-lg font-semibold mb-4">@{{ user.username }}'s Journeys</h2>
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			<UserJourneyProgress
				v-if="!loading"
				icon="mdi:leaf"
				title="Activities"
				:count="activity"
				:total="totalActivities"
				help="Visit and read about activities to increase this number."
			/>
			<UserJourneyProgressSkeleton v-else />
			<UserJourneyProgress
				v-if="!loading"
				icon="mdi:pencil"
				title="Prompts"
				:count="prompt"
				help="Respond to prompts to increase this number."
			/>
			<UserJourneyProgressSkeleton v-else />
			<UserJourneyProgress
				v-if="!loading"
				icon="mdi:newspaper"
				title="Articles"
				:count="article"
				help="Read articles to increase this number."
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
const activity = ref(0);
const prompt = ref(0);
const article = ref(0);
const { count: totalActivities } = useActivitiesCount();

onMounted(async () => {
	loading.value = true;

	// Retrieve journey values
	const values: [
		Ref<number>,
		() => Promise<{
			data?: { count: number } | { code: number; message: string };
			success: boolean;
			message?: string;
		}>
	][] = [
		[activity, async () => await getCurrentJourney('activity', props.user.id)],
		[prompt, async () => await getCurrentJourney('prompt', props.user.id)],
		[article, async () => await getCurrentJourney('article', props.user.id)]
	];

	Promise.all(
		values.map(async ([ref, fn]) => {
			const res = await fn();
			if (res.success && res.data) {
				if ('message' in res.data) {
					toast.add({
						title: 'Error',
						description: res.data.message || 'Failed to fetch journey data.',
						icon: 'mdi:alert-circle-outline',
						color: 'error'
					});
				} else {
					ref.value = res.data.count;
				}
			} else {
				toast.add({
					title: 'Error',
					description: res.message || 'Failed to fetch journey data.',
					icon: 'mdi:alert-circle-outline',
					color: 'error'
				});
			}
		})
	).finally(() => {
		loading.value = false;
	});
});
</script>
