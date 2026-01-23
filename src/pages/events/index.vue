<template>
	<div class="flex w-full justify-center my-4">
		<h2
			id="events"
			class="text-2xl mt-24 sm:mt-0 text-center font-semibold"
		>
			All Events
		</h2>
	</div>
	<div class="flex flex-col w-full justify-between items-center">
		<div
			class="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 place-items-center w-9/10 px-4 gap-x-4 gap-y-12 *:mx-2 *:max-w-100 *:lg:w-1/2 *:xl:w-1/3"
		>
			<InfoCardSkeleton
				v-if="allEvents.length === 0"
				v-for="n in 12"
				:key="n"
				content-size="small"
			/>
			<EventCard
				v-for="event in allEvents"
				:key="event.id"
				:event="event"
			/>
		</div>
	</div>

	<div
		v-if="isLoading"
		class="text-center py-4"
	>
		<UIcon name="eos-icons:loading" />
	</div>

	<div
		ref="loadMoreRef"
		class="h-1"
	></div>
</template>

<script setup lang="ts">
import { type Event } from '~/shared/types/event';

const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Events');

const { user } = useAuth();
const { getEvents } = useEvents();
const toast = useToast();

const allEvents = ref<Event[]>([]);
const page = ref(1);
const hasMore = ref(true);
const isLoading = ref(false);

async function loadEvents() {
	if (isLoading.value || !hasMore.value) return;
	isLoading.value = true;

	try {
		const res = await getEvents(page.value, 100);
		const data = res.items;

		// Shuffle only the new items before adding them (Fisher-Yates shuffle)
		for (let i = data.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			const temp = data[i];
			data[i] = data[j]!;
			data[j] = temp!;
		}
		allEvents.value.push(...data);
		hasMore.value = allEvents.value.length < res.total;
		page.value++;
	} catch (error) {
		toast.add({
			title: 'Error Loading Events',
			description: (error as Error).message,
			icon: 'mdi:alert-circle',
			color: 'error',
			duration: 5000
		});

		hasMore.value = false;
	}

	isLoading.value = false;
}

const loadMoreRef = ref<HTMLElement | null>(null);

onMounted(async () => {
	await loadEvents();
	const observer = new IntersectionObserver(
		(entries) => {
			if (entries[0]?.isIntersecting && hasMore.value && !isLoading.value) {
				loadEvents();
			}
		},
		{ rootMargin: '100px' }
	);

	if (loadMoreRef.value) {
		observer.observe(loadMoreRef.value);
	}

	onUnmounted(() => {
		observer.disconnect();
	});
});
</script>
