<template>
	<div class="flex flex-col">
		<InfoCardGroup
			v-if="user"
			title="Recommended for You"
			description="Based on your interests and activities"
			icon="mdi:star"
		>
			<InfoCardSkeleton
				v-if="!recommendedLoaded"
				v-for="n in 2"
				:key="n"
				content-size="small"
			/>
			<ActivityCard
				v-for="activity in recommendedActivities"
				:key="activity.id"
				:activity="activity"
			/>
		</InfoCardGroup>
	</div>
	<h2 class="text-center text-2xl font-semibold my-4">All Activities</h2>
	<div class="flex flex-col w-full justify-between items-center">
		<div
			class="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 place-items-center w-9/10 px-4 gap-x-4 gap-y-12 *:mx-2 *:max-w-100 *:lg:w-1/2 *:xl:w-1/3"
		>
			<InfoCardSkeleton
				v-if="allActivities.length === 0"
				v-for="n in 12"
				:key="n"
				content-size="small"
			/>
			<ActivityCard
				v-for="activity in allActivities"
				:activity="activity"
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
import { getActivities } from '~/compostables/useActivity';
import { useTitleSuffix } from '~/compostables/useTitleSuffix';
import { getRecommendedActivities, useAuth } from '~/compostables/useUser';
import type { Activity } from '~/shared/types/activity';

const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Activities');

const { user } = useAuth();
const toast = useToast();

const recommendedLoaded = ref(false);
const recommendedActivities = ref<Activity[]>([]);
watch(
	() => user.value,
	async (newUser) => {
		if (newUser) {
			const res = await getRecommendedActivities();
			if (res.success && res.data) {
				if ('message' in res.data) {
					// No recommendations available
					recommendedLoaded.value = true;
					recommendedActivities.value = [];

					toast.add({
						title: 'No Recommendations',
						description: res.data.message,
						icon: 'mdi:alert-circle',
						color: 'info',
						duration: 5000
					});
					return;
				}

				recommendedLoaded.value = true;
				recommendedActivities.value = res.data;
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

	const res = await getActivities(page.value, 100);
	if (res.success && res.data) {
		if ('message' in res.data) {
			toast.add({
				title: 'Error Loading Activities',
				description: res.data.message,
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 5000
			});

			isLoading.value = false;
			return;
		}

		allActivities.value.push(...res.data.items.sort(() => Math.random() - 0.5)); // Shuffle the activities
		hasMore.value = allActivities.value.length < res.data.total;
		page.value++;
	} else {
		hasMore.value = false;
	}

	isLoading.value = false;
}

const loadMoreRef = ref<HTMLElement | null>(null);

onMounted(async () => {
	// Load initial activities
	await loadActivities();

	// Set up intersection observer for infinite scrolling
	const observer = new IntersectionObserver(
		(entries) => {
			if (entries[0]?.isIntersecting && hasMore.value && !isLoading.value) {
				loadActivities();
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
