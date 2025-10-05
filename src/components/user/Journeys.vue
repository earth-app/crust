<template>
	<div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
		<h2 class="text-lg font-semibold mb-4">@{{ user.username }}'s Journeys</h2>
		<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
			<UserJourneyProgress
				v-if="!loading"
				icon="mdi:leaf"
				title="Activities"
				:count="activity"
				:total="totalActivities"
			/>
			<UserJourneyProgressSkeleton v-else />
			<UserJourneyProgress
				v-if="!loading"
				icon="mdi:pencil"
				title="Prompts"
				:count="prompt"
			/>
			<UserJourneyProgressSkeleton v-else />
			<UserJourneyProgress
				v-if="!loading"
				icon="mdi:newspaper"
				title="Articles"
				:count="article"
			/>
			<UserJourneyProgressSkeleton v-else />
		</div>
	</div>
</template>

<script setup lang="ts">
import { getActivitiesList } from '~/compostables/useActivity';
import { getCurrentJourney } from '~/compostables/useUser';
import type { User } from '~/shared/types/user';

const props = defineProps<{
	user: User;
}>();

const toast = useToast();

const loading = ref(false);
const activity = ref(0);
const prompt = ref(0);
const article = ref(0);
const totalActivities = ref(0);

onMounted(async () => {
	loading.value = true;

	const { total: activitiesCount } = await getActivitiesList(1, 1).then((res) => {
		if (res.success && res.data) {
			if ('message' in res.data) {
				toast.add({
					title: 'Error',
					description: res.data.message || 'Failed to fetch activity data.',
					icon: 'mdi:alert-circle-outline',
					color: 'error'
				});

				return { total: 0 };
			}

			return res.data;
		} else {
			toast.add({
				title: 'Error',
				description: res.message || 'Failed to fetch activity data.',
				icon: 'mdi:alert-circle-outline',
				color: 'error'
			});
		}

		return { total: 0 };
	});

	totalActivities.value = activitiesCount;

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
