<template>
	<div
		v-if="currentActivity"
		class="flex flex-row items-center justify-between w-full pt-20 sm:pt-0"
	>
		<ActivityProfile :activity="currentActivity" />
	</div>
	<div
		v-else-if="currentActivity === null"
		class="flex flex-col items-center justify-center h-screen"
	>
		<p class="text-gray-600">Activity doesn't exist. Maybe look at the URL again?</p>
	</div>
	<Loading v-else />
</template>

<script setup lang="ts">
const { setTitleSuffix } = useTitleSuffix();
const route = useRoute();
const toast = useToast();
const currentActivity = ref<Activity | null | undefined>(undefined);

if (route.params.id) {
	const activityStore = useActivityStore();
	const activity = await activityStore.fetchActivity(route.params.id as string);

	if (activity) {
		currentActivity.value = activity;
		setTitleSuffix(currentActivity.value?.name || 'Activity Profile');
	} else {
		toast.add({
			title: 'Error Fetching Activity',
			description: 'Activity not found.',
			icon: 'mdi:alert-circle-outline',
			color: 'error',
			duration: 5000
		});

		currentActivity.value = null;
		setTitleSuffix('Activity Profile');
	}
}

useSeoMeta({
	ogTitle: currentActivity.value?.name || 'Activity Profile',
	ogDescription: currentActivity.value?.description || ''
});

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
