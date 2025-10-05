<template>
	<div
		v-if="currentActivity"
		class="flex flex-row items-center justify-between w-full"
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
import { getActivity } from '~/compostables/useActivity';
import { useTitleSuffix } from '~/compostables/useTitleSuffix';
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
</script>
