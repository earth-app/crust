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
		<ClientOnly>
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
				<EventCard
					v-for="event in recommendedEvents"
					:key="event.id"
					:event="event"
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
				<EventCard
					v-for="event in randomEvents"
					:key="event.id"
					:event="event"
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
				<EventCard
					v-for="event in recentEvents"
					:key="event.id"
					:event="event"
				/>
			</InfoCardGroup>
		</ClientOnly>
	</div>
</template>

<script setup lang="ts">
import { type Event } from '~/shared/types/event';

const toast = useToast();
const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Events');

const { user, maxEventAttendees, currentEventsCount } = useAuth();

const recommendedLoaded = ref(false);
const recommendedEvents = ref<Event[]>([]);

const randomLoaded = ref(false);
const randomEvents = ref<Event[]>([]);

const recentLoaded = ref(false);
const recentEvents = ref<Event[]>([]);

const loading = computed(() => {
	const loaded = !randomLoaded.value || !recentLoaded.value;
	if (!user.value) {
		return loaded;
	}

	return !recommendedLoaded.value || loaded;
});

async function loadContent() {
	// reset states
	recommendedLoaded.value = false;
	recommendedEvents.value = [];
	randomLoaded.value = false;
	randomEvents.value = [];
	recentLoaded.value = false;
	recentEvents.value = [];

	if (user.value) {
		const recommendedRes = await getRecommendedEvents();
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
	} else {
		recommendedLoaded.value = true;
	}

	const randomRes = await getRandomEvents(5);
	if (randomRes.success && randomRes.data) {
		if ('message' in randomRes.data) {
			randomLoaded.value = true;
			randomEvents.value = [];
			console.error('Failed to load random events:', randomRes.data.message);

			toast.add({
				title: 'Error',
				icon: 'mdi:alert-circle',
				description: randomRes.data.message || 'Failed to load random events.',
				color: 'error'
			});
		} else {
			randomEvents.value = randomRes.data;
			randomLoaded.value = true;
		}
	} else {
		randomLoaded.value = true;
		randomEvents.value = [];

		console.error('Failed to load random events:', randomRes.message);

		toast.add({
			title: 'Error',
			icon: 'mdi:alert-circle',
			description: randomRes.message || 'Failed to load random events.',
			color: 'error'
		});
	}

	const recentRes = await getRecentEvents();
	if (recentRes.success && recentRes.data) {
		if ('message' in recentRes.data) {
			recentLoaded.value = true;
			recentEvents.value = [];
			console.error('Failed to load recent events:', recentRes.data.message);

			toast.add({
				title: 'Error',
				icon: 'mdi:alert-circle',
				description: recentRes.data.message || 'Failed to load recent events.',
				color: 'error'
			});
		} else {
			recentEvents.value = recentRes.data.items;
			recentLoaded.value = true;
		}
	} else {
		console.error('Failed to load recent events:', recentRes.message);
		recentLoaded.value = true;

		toast.add({
			title: 'Error',
			icon: 'mdi:alert-circle',
			description: recentRes.message || 'Failed to load recent events.',
			color: 'error'
		});
	}
}

onMounted(async () => {
	await loadContent();
});

const newDisabled = computed(() => {
	if (user.value === null) return true;
	return currentEventsCount.value >= maxEventAttendees.value;
});
</script>
