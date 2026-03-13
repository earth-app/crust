<template>
	<div
		v-if="event"
		class="flex flex-col items-center h-full w-full pt-24 sm:pt-0"
	>
		<EventPage :event="event" />

		<div
			v-if="user"
			class="flex items-center w-screen"
		>
			<LazyInfoCardGroup
				title="Similar Events"
				description="Events related to this one"
				icon="mdi:calendar-multiple"
				class="w-full mt-8 px-4"
				hydrate-on-visible
			>
				<InfoCardSkeleton
					v-if="!relatedLoaded"
					v-for="n in 3"
					:key="n"
					content-size="small"
				/>
				<LazyEventCard
					v-else
					v-for="event in relatedEvents"
					:key="event.id"
					:event="event"
					hydrate-on-visible
				/>
			</LazyInfoCardGroup>
		</div>
	</div>
	<div
		v-else-if="event === null"
		class="flex flex-col items-center justify-center h-screen w-screen"
	>
		<p class="text-gray-600">Event doesn't exist. Maybe look at the URL again?</p>
	</div>
	<Loading v-else />
</template>

<script setup lang="ts">
import type { Event } from 'types/event';

const toast = useToast();
const route = useRoute();
const { setTitleSuffix } = useTitleSuffix();
const { user } = useAuth();
const { event, fetch } = useEvent(route.params.id as string);

const relatedLoaded = ref(false);
const relatedEvents = ref<Event[]>([]);
const similarLoadedFor = ref<string | null>(null);
const similarInFlight = ref(false);

// Force fetch on mount to ensure fresh data on page refresh
onMounted(() => {
	fetch();
});

watch(
	() => event.value,
	(e) => {
		setTitleSuffix(e ? e.name : 'Event');

		if (e && user.value && similarLoadedFor.value !== e.id && !similarInFlight.value) {
			loadSimilar(e);
		} else if (!e) {
			relatedLoaded.value = false;
			relatedEvents.value = [];
			similarLoadedFor.value = null;
		}
	},
	{ immediate: true }
);
watch([() => event.value, () => user.value] as const, ([e, u]) => {
	if (e && u && similarLoadedFor.value !== e.id && !similarInFlight.value) {
		loadSimilar(e);
	}
});

useSeoMeta({
	ogTitle: event.value ? event.value.name : 'Event',
	ogDescription: event.value ? event.value.description : 'Event'
});

async function loadSimilar(event?: Event) {
	if (!event) return;
	if (!user.value) return;
	if (similarInFlight.value) return;
	if (similarLoadedFor.value === event.id) return;

	similarInFlight.value = true;
	relatedLoaded.value = false;

	try {
		const { getSimilar } = useEvent(event.id);
		const res = await getSimilar();
		if (res.success && res.data) {
			relatedEvents.value = res.data;
			similarLoadedFor.value = event.id;
		} else {
			console.error('Failed to load similar events:', res.message);
			toast.add({
				title: 'Error',
				icon: 'mdi:alert-circle',
				description: res.message || 'Failed to load similar events.',
				color: 'error'
			});
		}
	} finally {
		relatedLoaded.value = true;
		similarInFlight.value = false;
	}
}
</script>
