<template>
	<div
		v-if="currentActivity"
		class="flex flex-col items-center w-full pt-20 sm:pt-0 gap-6"
	>
		<div class="flex flex-row items-center justify-between w-full">
			<ActivityProfile :activity="currentActivity" />
		</div>
		<ClientOnly>
			<div class="w-full max-w-2xl px-4 mb-8">
				<LazyActivityWidgetSlot
					:kind="detailWidgetKind"
					:topic="`activity-${currentActivity.id}`"
					hydrate-on-visible
				/>
			</div>
		</ClientOnly>
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

const { user, tapCurrentJourney } = useAuth();
const { widgetForIndex } = useFeedWidgets();
const { count: totalActivities, refresh } = useActivitiesCount();

// pick a single widget for the detail page. seed off the activity id so the same activity
// always shows the same widget kind for a given day - feels intentional rather than random.
const detailWidgetKind = computed<FeedWidgetKind>(() => {
	const idSeed = (currentActivity.value?.id ?? '')
		.split('')
		.reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
	// widgetForIndex returns a kind only at indices 7, 15, 23, ... so step through valid slots only
	const slotNumber = idSeed % 8;
	return widgetForIndex(7 + slotNumber * 8) ?? 'MoodSpark';
});
const journeyTrackedActivityId = ref<string | null>(null);
const journeyTrackingActivityId = ref<string | null>(null);

watch(
	[() => currentActivity.value, () => user.value] as const,
	async ([activity, currentUser]) => {
		if (!activity || !currentUser) return;

		const activityId = activity.id;
		if (
			journeyTrackedActivityId.value === activityId ||
			journeyTrackingActivityId.value === activityId
		) {
			return;
		}

		journeyTrackingActivityId.value = activityId;
		try {
			const res = await tapCurrentJourney('activity', activityId);
			if (!valid(res)) return;

			journeyTrackedActivityId.value = activityId;
			if (!res.data.incremented) return;

			const journeyCount = res.data.count > 0 ? res.data.count : null;

			toast.add({
				title: 'Journey Updated',
				description: journeyCount
					? `You have now found ${journeyCount}/${totalActivities.value} activities on your journey. Keep going!`
					: 'Your activity journey has been updated. Keep going!',
				icon: 'game-icons:horizon-road',
				color: 'success',
				duration: 5000
			});
		} finally {
			if (journeyTrackingActivityId.value === activityId) {
				journeyTrackingActivityId.value = null;
			}
		}
	},
	{ immediate: true }
);

// activity read time tracking

const { startTimer, stopTimer } = useTimeOnPage('activity_read_time', {
	activity: currentActivity.value,
	user: user.value
});

onMounted(() => {
	if (import.meta.client) {
		startTimer();
	}

	refresh();
});

onUnmounted(() => {
	if (import.meta.client) {
		stopTimer();
	}
});
</script>
