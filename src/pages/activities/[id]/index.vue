<template>
	<div
		v-if="currentActivity"
		class="flex flex-row items-center justify-between w-full pt-20 sm:pt-0"
	>
		<ActivityProfile :activity="currentActivity" />
	</div>
	<div
		v-else
		class="flex flex-col items-center justify-center h-screen"
	>
		<p class="text-gray-600">Activity doesn't exist. Maybe look at the URL again?</p>
	</div>
</template>

<script setup lang="ts">
import type { Activity } from '~/shared/types/activity';

const { setTitleSuffix } = useTitleSuffix();
const route = useRoute();
const toast = useToast();
const currentActivity = ref<Activity | null>(null);

if (route.params.id) {
	const res = await getActivity(route.params.id as string);

	if (res.success && res.data) {
		if ('message' in res.data) {
			toast.add({
				title: 'Error Fetching Activity',
				description: res.data.message || 'An unknown error occurred.',
				icon: 'mdi:alert-circle-outline',
				color: 'error',
				duration: 5000
			});

			currentActivity.value = null;
			setTitleSuffix('Activity Profile');
		} else {
			currentActivity.value = res.data;
			setTitleSuffix(currentActivity.value?.name || 'Activity Profile');

			useSeoMeta({
				ogTitle: currentActivity.value?.name || 'Activity Profile',
				ogDescription: currentActivity.value?.description || ''
			});
		}
	} else {
		currentActivity.value = null;
		setTitleSuffix('Activity Profile');
	}
}

const { user } = useAuth();
const { count: totalActivities } = useActivitiesCount();

onMounted(async () => {
	if (!route.params.id) return;
	if (!user.value) return;

	const count = await getCurrentJourney('activity', user.value.id);
	if (!count.success || !count.data) return; // silently ignore errors
	if ('message' in count.data) return;

	const res = await tapCurrentJourney('activity', route.params.id as string);
	if (!res.success || !res.data) return; // silently ignore errors
	if ('message' in res.data) return;

	if (count.data.count === res.data.count) return; // no change

	toast.add({
		title: 'Journey Updated',
		description: `You have now found ${res.data.count}/${totalActivities.value} activities on your journey. Keep going!`,
		icon: 'game-icons:horizon-road',
		color: 'success',
		duration: 5000
	});
});
</script>
