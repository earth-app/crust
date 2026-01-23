<template>
	<div
		v-if="event"
		class="flex flex-row items-center justify-between w-full pt-24 sm:pt-0"
	>
		<EventPage :event="event" />
	</div>
	<div
		v-else-if="event == null"
		class="flex flex-col items-center justify-center h-screen w-screen"
	>
		<p class="text-gray-600">Event doesn't exist. Maybe look at the URL again?</p>
	</div>
	<div
		v-else
		class="flex flex-col items-center justify-center h-screen w-screen"
	>
		<p class="text-gray-600">Loading event...</p>
	</div>
</template>

<script setup lang="ts">
const { setTitleSuffix } = useTitleSuffix();
const route = useRoute();
const { event, fetch } = useEvent(route.params.id as string);

// Force fetch on mount to ensure fresh data on page refresh
onMounted(() => {
	fetch();
});

watch(
	() => event.value,
	(event) => {
		setTitleSuffix(event ? event.name : 'Event');
	}
);

useSeoMeta({
	ogTitle: event.value ? event.value.name : 'Event',
	ogDescription: event.value ? event.value.description : 'Event'
});
</script>
