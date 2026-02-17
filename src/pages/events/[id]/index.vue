<template>
	<ClientOnly>
		<div
			v-if="event"
			class="flex flex-col items-center h-full w-full pt-24 sm:pt-0"
		>
			<EventPage :event="event" />

			<div
				v-if="user"
				class="flex items-center w-screen"
			>
				<InfoCardGroup
					title="Similar Events"
					description="Events related to this one"
					icon="mdi:calendar-multiple"
					class="w-full mt-8 px-4"
				>
					<InfoCardSkeleton
						v-if="!relatedLoaded"
						v-for="n in 3"
						:key="n"
						content-size="small"
					/>
					<EventCard
						v-else
						v-for="event in relatedEvents"
						:key="event.id"
						:event="event"
					/>
				</InfoCardGroup>
			</div>
		</div>
		<div
			v-else-if="event === null"
			class="flex flex-col items-center justify-center h-screen w-screen"
		>
			<p class="text-gray-600">Event doesn't exist. Maybe look at the URL again?</p>
		</div>
		<Loading v-else />
	</ClientOnly>
</template>

<script setup lang="ts">
import type { Event } from '~/shared/types/event';

const toast = useToast();
const route = useRoute();
const { setTitleSuffix } = useTitleSuffix();
const { user } = useAuth();
const { event, fetch } = useEvent(route.params.id as string);

const relatedLoaded = ref(false);
const relatedEvents = ref<Event[]>([]);

// Force fetch on mount to ensure fresh data on page refresh
onMounted(() => {
	fetch();
});

watch(
	() => event.value,
	(event) => {
		setTitleSuffix(event ? event.name : 'Event');

		if (event) {
			loadSimilar(event);
		} else {
			relatedLoaded.value = false;
			relatedEvents.value = [];
		}
	},
	{ immediate: true }
);
watch(
	() => user.value,
	() => {
		if (user.value && event.value) {
			loadSimilar(event.value);
		}
	}
);

useSeoMeta({
	ogTitle: event.value ? event.value.name : 'Event',
	ogDescription: event.value ? event.value.description : 'Event'
});

async function loadSimilar(event?: Event) {
	if (!event) return;
	if (!user.value) return;
	relatedLoaded.value = false;

	const { getSimilar } = useEvent(event.id);
	const res = await getSimilar();
	if (res.success && res.data) {
		relatedEvents.value = res.data;
		relatedLoaded.value = true;
	} else {
		console.error('Failed to load similar events:', res.message);
		relatedLoaded.value = true;

		toast.add({
			title: 'Error',
			icon: 'mdi:alert-circle',
			description: res.message || 'Failed to load similar events.',
			color: 'error'
		});
	}
}
</script>
