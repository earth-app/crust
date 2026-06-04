<template>
	<div class="flex flex-col pt-20 sm:pt-0">
		<div
			id="events-toolbar"
			class="flex justify-center mt-2 gap-x-2"
		>
			<UButton
				title="Refresh"
				icon="i-lucide-refresh-cw"
				color="neutral"
				variant="outline"
				:loading="loading"
				:disabled="loading"
				class="mt-2"
				@click="loadContent"
			/>
			<EventEditor mode="create">
				<UButton
					v-if="user"
					title="Create Event"
					icon="i-lucide-plus"
					color="primary"
					variant="outline"
					class="mt-2"
					:disabled="newDisabled"
				/>
			</EventEditor>
			<UButton
				icon="mdi:progress-question"
				color="secondary"
				variant="subtle"
				class="mt-2"
				@click="startTour('events-index')"
			/>
		</div>
		<InfoCardGroup
			v-if="user"
			title="Recommended for You"
			description="Based on your interests and activities"
			icon="mdi:calendar-star"
			special
		>
			<LazyEventCard
				v-for="event in recommended.items"
				:key="event.id"
				:event="event"
				class="motion-preset-fade-md"
				hydrate-on-visible
			/>
			<InfoCardSkeleton
				v-for="n in recommended.remaining"
				:key="`event-recommended-skel-${n}`"
				content-size="small"
			/>
		</InfoCardGroup>
		<div class="flex justify-center w-full px-4 my-2">
			<div class="w-full max-w-2xl">
				<LazyWidgetSlot
					kind="MoodSpark"
					topic="events"
					hydrate-on-visible
				/>
			</div>
		</div>
		<InfoCardGroup
			title="Upcoming Events"
			description="Don't miss out on these!"
			icon="mdi:calendar-clock"
		>
			<LazyEventCard
				v-for="event in upcoming.items"
				:key="event.id"
				:event="event"
				class="motion-preset-fade-md"
				hydrate-on-visible
			/>
			<InfoCardSkeleton
				v-for="n in upcoming.remaining"
				:key="`event-upcoming-skel-${n}`"
				content-size="small"
			/>
		</InfoCardGroup>
		<InfoCardGroup
			title="Explore Events"
			description="Discover new and interesting events"
			icon="mdi:compass"
			id="events"
		>
			<LazyEventCard
				v-for="event in random.items"
				:key="event.id"
				:event="event"
				class="motion-preset-fade-md"
				hydrate-on-visible
			/>
			<InfoCardSkeleton
				v-for="n in random.remaining"
				:key="`event-random-skel-${n}`"
				content-size="small"
			/>
		</InfoCardGroup>
		<div class="flex justify-center w-full px-4 my-2">
			<div class="w-full max-w-2xl">
				<LazyWidgetSlot
					kind="MicroPoll"
					topic="events"
					hydrate-on-visible
				/>
			</div>
		</div>
		<InfoCardGroup
			title="Recent Events"
			description="Latest events from the community"
			icon="mdi:history"
		>
			<LazyEventCard
				v-for="event in recent.items"
				:key="event.id"
				:event="event"
				class="motion-preset-fade-md"
				hydrate-on-visible
			/>
			<InfoCardSkeleton
				v-for="n in recent.remaining"
				:key="`event-recent-skel-${n}`"
				content-size="small"
			/>
		</InfoCardGroup>
	</div>

	<ClientOnly>
		<SiteTour
			:steps="eventsIndexTour"
			name="Events Index Tour"
			tour-id="events-index"
		/>
	</ClientOnly>
</template>

<script setup lang="ts">
import { type Event } from 'types/event';

const toast = useToast();
const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Events');

const { user } = useAuth();

const recommended = useIncrementalList<Event>({ staggerMs: 80, initialExpectedCount: 2 });
const random = useIncrementalList<Event>({ staggerMs: 80, initialExpectedCount: 3 });
const recent = useIncrementalList<Event>({ staggerMs: 80, initialExpectedCount: 2 });
const upcoming = useIncrementalList<Event>({ staggerMs: 80, initialExpectedCount: 3 });

const loading = computed(() => {
	const loaded = random.isLoading || recent.isLoading;
	if (!user.value) return loaded;
	return recommended.isLoading || loaded;
});

const isLoadingContent = ref(false);

function reportError(label: string, message?: string) {
	console.error(`Failed to load ${label}:`, message);
	toast.add({
		title: 'Error',
		icon: 'mdi:alert-circle',
		description: message || `Failed to load ${label}.`,
		color: 'error'
	});
}

async function loadRecommended() {
	if (recommended.items.length > 0) return;

	if (!user.value) {
		recommended.reset(0);
		return;
	}

	await recommended.load(async () => {
		const { fetchRecommended } = useEvents();
		const res = await fetchRecommended();
		if (res.success && res.data) return res.data;
		reportError('recommended events', res.message);
		return null;
	});
}

async function loadContent() {
	if (isLoadingContent.value) return;
	isLoadingContent.value = true;

	try {
		const { fetchRandom, fetchRecent, fetchUpcoming } = useEvents();

		recommended.reset(user.value ? 2 : 0);
		random.reset(3);
		recent.reset(2);
		upcoming.reset(3);

		void loadRecommended();

		void random.load(async () => {
			const res = await fetchRandom(10);
			if (valid(res)) return res.data;
			reportError('random events', res.message);
			return null;
		});

		void recent.load(async () => {
			const res = await fetchRecent(10);
			if (valid(res)) return res.data.items;
			reportError('recent events', res.message);
			return null;
		});

		void upcoming.load(async () => {
			const res = await fetchUpcoming(10);
			if (valid(res)) return res.data.items;
			reportError('upcoming events', res.message);
			return null;
		});
	} finally {
		isLoadingContent.value = false;
	}
}

watch(
	() => user.value,
	(newUser, oldUser) => {
		if (newUser?.id !== oldUser?.id) {
			loadRecommended();
		}
	},
	{ immediate: false }
);

onMounted(async () => {
	await loadContent();
});

const newDisabled = computed(() => {
	if (user.value === null) return true;
	return false;
});

const { startTour } = useSiteTour();

const eventsIndexTour: SiteTourStep[] = [
	{
		id: 'events-toolbar',
		title: 'Events Hub',
		description:
			"Browse upcoming gatherings, online sessions, and in-person meetups. Refresh shuffles the picks. The plus button creates a new event if you're signed in.",
		footer: 'Logged-in users get personalized recommendations based on their activities.',
		icon: 'mdi:calendar-multiple',
		highlightPadding: 8
	},
	{
		id: 'events',
		title: 'Explore Events',
		description:
			'Each card shows the date, host, format (online / in-person / hybrid), tags, and current attendance. Click a card to view full details and sign up.',
		footer: 'Events near their start time get a "Starting soon" badge so you don\'t miss them.',
		icon: 'mdi:compass-outline',
		highlightPadding: 12,
		waitFor: 'events',
		waitTimeout: 3000
	}
];
</script>
