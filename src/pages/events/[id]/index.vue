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
				<LazyEventCard
					v-for="similarEvent in related.items"
					:key="similarEvent.id"
					:event="similarEvent"
					class="motion-preset-fade-md"
					hydrate-on-visible
				/>
				<InfoCardSkeleton
					v-for="n in related.remaining"
					:key="`event-related-skel-${n}`"
					content-size="small"
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

// SSR: await so the SWR-cached HTML contains the resolved event (or null)
// instead of a Loading skeleton. Client navs rely on the composable's
// auto-fetch + reactive Loading state.
if (import.meta.server) await fetch();

const related = useIncrementalList<Event>({
	staggerMs: 120,
	initialExpectedCount: 3
});

const similarLoadedFor = ref<string | null>(null);

onMounted(() => {
	if (!event.value) fetch();
});

watch(
	() => event.value,
	(e) => {
		setTitleSuffix(e ? e.name : 'Event');

		if (e && user.value && similarLoadedFor.value !== e.id && !related.isLoading) {
			loadSimilar(e);
		} else if (!e) {
			related.reset(3);
			similarLoadedFor.value = null;
		}
	},
	{ immediate: true }
);
watch([() => event.value, () => user.value] as const, ([e, u]) => {
	if (e && u && similarLoadedFor.value !== e.id && !related.isLoading) {
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
	if (related.isLoading) return;
	if (similarLoadedFor.value === event.id) return;

	similarLoadedFor.value = event.id;

	await related.load(async () => {
		const { fetchSimilar } = useEvent(event.id);
		const res = await fetchSimilar();
		if (valid(res)) {
			return res.data;
		}
		console.error('Failed to load similar events:', res.message);
		toast.add({
			title: 'Error',
			icon: 'mdi:alert-circle',
			description: res.message || 'Failed to load similar events.',
			color: 'error'
		});
		similarLoadedFor.value = null;
		return null;
	});
}
</script>
