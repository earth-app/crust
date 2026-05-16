<template>
	<div class="flex flex-col pt-20 sm:pt-0">
		<div class="flex justify-center mt-2 gap-x-2">
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
		</div>
		<InfoCardGroup
			v-if="user"
			title="Recommended for You"
			description="Based on your interests and activities"
			icon="mdi:calendar-star"
		>
			<InfoCardSkeleton
				v-if="!recommendedLoaded"
				v-for="n in 2"
				:key="n"
				content-size="small"
			/>
			<LazyEventCard
				v-for="event in recommendedEvents"
				:key="event.id"
				:event="event"
				hydrate-on-visible
			/>
		</InfoCardGroup>
		<InfoCardGroup
			title="Upcoming Events"
			description="Don't miss out on these!"
			icon="mdi:calendar-clock"
		>
			<InfoCardSkeleton
				v-if="!upcomingLoaded"
				v-for="n in 3"
				:key="n"
				content-size="small"
			/>
			<LazyEventCard
				v-for="event in upcomingEvents"
				:key="event.id"
				:event="event"
				hydrate-on-visible
			/>
		</InfoCardGroup>
		<InfoCardGroup
			title="Explore Events"
			description="Discover new and interesting events"
			icon="mdi:compass"
			id="events"
		>
			<InfoCardSkeleton
				v-if="!randomLoaded"
				v-for="n in 3"
				:key="n"
				content-size="small"
			/>
			<LazyEventCard
				v-for="event in randomEvents"
				:key="event.id"
				:event="event"
				hydrate-on-visible
			/>
		</InfoCardGroup>
		<InfoCardGroup
			title="Recent Events"
			description="Latest events from the community"
			icon="mdi:history"
		>
			<InfoCardSkeleton
				v-if="!recentLoaded"
				v-for="n in 2"
				:key="n"
				content-size="small"
			/>
			<LazyEventCard
				v-for="event in recentEvents"
				:key="event.id"
				:event="event"
				hydrate-on-visible
			/>
		</InfoCardGroup>
	</div>
</template>

<script setup lang="ts">
import { type Event } from 'types/event';

const toast = useToast();
const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Events');

const { user } = useAuth();

const recommendedLoaded = ref(false);
const recommendedEvents = ref<Event[]>([]);

const randomLoaded = ref(false);
const randomEvents = ref<Event[]>([]);

const recentLoaded = ref(false);
const recentEvents = ref<Event[]>([]);

const upcomingLoaded = ref(false);
const upcomingEvents = ref<Event[]>([]);

const loading = computed(() => {
	const loaded = !randomLoaded.value || !recentLoaded.value;
	if (!user.value) {
		return loaded;
	}

	return !recommendedLoaded.value || loaded;
});

// Prevent concurrent calls to loadContent
const isLoadingContent = ref(false);

function loadRecommended() {
	if (recommendedEvents.value.length > 0) return;

	if (user.value) {
		const { fetchRecommended } = useEvents();
		fetchRecommended().then((recommendedRes) => {
			if (recommendedRes.success && recommendedRes.data) {
				recommendedEvents.value = recommendedRes.data;
				recommendedLoaded.value = true;
			} else {
				console.error('Failed to load recommended events:', recommendedRes.message);
				recommendedLoaded.value = true;

				toast.add({
					title: 'Error',
					icon: 'mdi:alert-circle',
					description: recommendedRes.message || 'Failed to load recommended events.',
					color: 'error'
				});
			}
		});
	} else {
		recommendedLoaded.value = true;
	}
}

async function loadContent() {
	// Prevent duplicate concurrent loads
	if (isLoadingContent.value) {
		return;
	}

	isLoadingContent.value = true;

	// reset states
	randomLoaded.value = false;
	randomEvents.value = [];
	recentLoaded.value = false;
	recentEvents.value = [];
	upcomingLoaded.value = false;
	upcomingEvents.value = [];

	recommendedLoaded.value = false;
	recommendedEvents.value = [];
	loadRecommended();

	const { fetchRandom, fetchRecent, fetchUpcoming } = useEvents();
	fetchRandom(10).then((res) => {
		if (valid(res)) {
			randomEvents.value = res.data;
			randomLoaded.value = true;
		} else {
			randomLoaded.value = true;
			randomEvents.value = [];

			console.error('Failed to load random events:', res.message);

			toast.add({
				title: 'Error',
				icon: 'mdi:alert-circle',
				description: res.message || 'Failed to load random events.',
				color: 'error'
			});
		}
	});

	fetchRecent(10).then((res) => {
		if (valid(res)) {
			recentEvents.value = res.data.items;
			recentLoaded.value = true;
		} else {
			console.error('Failed to load recent events:', res.message);
			recentLoaded.value = true;

			toast.add({
				title: 'Error',
				icon: 'mdi:alert-circle',
				description: res.message || 'Failed to load recent events.',
				color: 'error'
			});
		}
	});

	fetchUpcoming(10).then((res) => {
		if (valid(res)) {
			upcomingEvents.value = res.data.items;
			upcomingLoaded.value = true;
		} else {
			console.error('Failed to load upcoming events:', res.message);
			upcomingLoaded.value = true;

			toast.add({
				title: 'Error',
				icon: 'mdi:alert-circle',
				description: res.message || 'Failed to load upcoming events.',
				color: 'error'
			});
		}
	});

	isLoadingContent.value = false;
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
	return false; // TODO: Implement event count check
});
</script>
