<template>
	<div class="flex flex-col">
		<InfoCardGroup
			v-if="user"
			title="Recommended for You"
			description="Based on your interests and activities"
			icon="mdi:star"
			special
		>
			<InfoCardSkeleton
				v-if="!recommendedLoaded"
				v-for="n in 2"
				:key="n"
				content-size="small"
			/>
			<LazyActivityCard
				v-for="(activity, i) in recommendedActivities"
				:key="activity.id"
				:activity="activity"
				class="motion-preset-fade-md"
				:style="`--motion-delay: ${Math.min(i, 8) * 50}ms`"
				hydrate-on-visible
			/>
		</InfoCardGroup>
	</div>
	<div class="flex justify-center w-full px-4 mt-8">
		<div class="w-full max-w-2xl">
			<LazyActivityWidgetsWordOfTheDay hydrate-on-visible />
		</div>
	</div>

	<div class="flex w-full justify-center items-center my-4 gap-2">
		<h2
			id="activities"
			class="text-2xl mt-24 sm:mt-0 text-center font-semibold"
		>
			All Activities
		</h2>
		<UButton
			icon="mdi:progress-question"
			color="secondary"
			variant="subtle"
			class="mt-24 sm:mt-0"
			@click="startTour('activities-index')"
		/>
	</div>
	<div class="flex flex-col w-full justify-between items-center">
		<div
			class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 place-items-stretch w-9/10 px-4 gap-4"
		>
			<InfoCardSkeleton
				v-if="allActivities.length === 0"
				v-for="n in 12"
				:key="n"
				content-size="small"
			/>
			<template
				v-for="(activity, i) in allActivities"
				:key="activity.id"
			>
				<LazyActivityCard
					:activity="activity"
					class="motion-preset-fade-md w-full"
					:style="`--motion-delay: ${Math.min(i % 12, 8) * 40}ms`"
					hydrate-on-visible
				/>
				<LazyActivityWidgetSlot
					v-if="widgetForIndex(i)"
					:kind="widgetForIndex(i)!"
					topic="activities"
					hydrate-on-visible
				/>
			</template>
		</div>
	</div>

	<div
		v-if="isLoading"
		class="flex justify-center py-4"
	>
		<Loading />
	</div>

	<div
		ref="loadMoreRef"
		class="h-1"
	></div>

	<ClientOnly>
		<SiteTour
			:steps="activitiesIndexTour"
			name="Activities Index Tour"
			tour-id="activities-index"
		/>
	</ClientOnly>
</template>
<script setup lang="ts">
const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Activities');

const { user, fetchRecommendedActivities } = useAuth();
const { widgetForIndex } = useFeedWidgets();
const toast = useToast();

const recommendedLoaded = ref(false);
const recommendedActivities = ref<Activity[]>([]);
watch(
	() => user.value,
	async (newUser) => {
		if (newUser) {
			const res = await fetchRecommendedActivities();
			if (valid(res)) {
				recommendedLoaded.value = true;
				recommendedActivities.value = res.data;
			} else {
				recommendedLoaded.value = true;
				recommendedActivities.value = [];

				toast.add({
					title: 'No Recommendations',
					description: res.message,
					icon: 'mdi:account-off',
					color: 'info',
					duration: 5000
				});
			}
		}
	},
	{ immediate: true }
);

const allActivities = ref<Activity[]>([]);
const page = ref(1);
const hasMore = ref(true);
const isLoading = ref(false);

async function loadActivities() {
	if (isLoading.value || !hasMore.value) return;
	isLoading.value = true;

	const { fetch } = useActivities();
	const res = await fetch(page.value, 100);
	if (valid(res)) {
		// Shuffle only the new items before adding them (Fisher-Yates shuffle)
		const newItems = res.data.items;
		for (let i = newItems.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			const temp = newItems[i];
			newItems[i] = newItems[j]!;
			newItems[j] = temp!;
		}
		allActivities.value.push(...newItems);
		hasMore.value = allActivities.value.length < res.data.total;
		page.value++;
	} else {
		hasMore.value = false;
		toast.add({
			title: 'Error Loading Activities',
			description: res.message,
			icon: 'mdi:alert-circle',
			color: 'error',
			duration: 5000
		});
	}

	isLoading.value = false;
}

const loadMoreRef = ref<HTMLElement | null>(null);

useIntersectionObserver(
	loadMoreRef,
	(entries) => {
		if (entries[0]?.isIntersecting && hasMore.value && !isLoading.value) {
			loadActivities();
		}
	},
	{ rootMargin: '100px' }
);

onMounted(loadActivities);

const { startTour } = useSiteTour();

const activitiesIndexTour: SiteTourStep[] = [
	{
		id: 'activities',
		title: 'Browse Activities',
		description:
			'This is the full catalog of activities on the Earth App - from gardening and running to astronomy and creative writing. Each one has its own page with curated resources and an optional quest.',
		footer: "Don't see something? The list grows over time, and admins can add new activities.",
		icon: 'mdi:format-list-bulleted-square',
		highlightPadding: 8
	},
	{
		title: 'Personalized Picks',
		description:
			'Signed-in users get a "Recommended for You" section at the top, generated from the activities on your profile. The more accurate your profile, the better the picks.',
		footer:
			'Pick an activity and visit its page to see resources, related events, and start a quest.',
		icon: 'mdi:star',
		placement: 'center'
	}
];
</script>
