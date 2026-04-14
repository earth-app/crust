<template>
	<div class="flex flex-col w-full items-center justify-center mt-4">
		<UIcon
			v-if="activity.fields['icon']"
			:name="activity.fields['icon']"
			size="6rem"
			class="my-2"
		/>
		<div class="flex flex-col sm:flex-row items-center justify-center">
			<h1 class="text-4xl sm:text-5xl font-bold">{{ activity.name }}</h1>
			<UButton
				v-if="user && user.is_admin"
				color="primary"
				class="ml-4 mt-2"
				@click="editing = true"
			>
				Edit Activity
			</UButton>
			<ActivityEditorModal
				v-if="user && user.is_admin"
				:activity="activity"
				v-model:open="editing"
			/>
		</div>
		<h3 class="text-md sm:text-lg md:text-xl min-w-75 w-3/5 mt-8">{{ activity.description }}</h3>
		<!-- Icon Islands -->
		<UIcon
			v-for="island in islands"
			:key="island.name"
			:name="island.icon"
			class="absolute top-0 hidden md:inline-block md:size-8 lg:size-12 z-10duration-300 motion-preset-fade-lg"
			:style="{ transform: `translate(${island.x}vw, ${island.y}vh)` }"
		/>
		<div
			class="grid grid-cols-1 xl:grid-cols-2 justify-items-center items-start w-2/3 min-w-100 xl:min-w-260 mt-6 sm:px-4 gap-y-8"
		>
			<!-- Skeleton Loading Cards -->
			<InfoCardSkeleton
				v-if="cards.length === 0"
				v-for="n in 6"
				:key="`skeleton-${n}`"
			/>

			<!-- Card Data Entries -->
			<LazyInfoCard
				v-for="(card, index) in cards"
				class="z-20 contain-[layout_paint_style]"
				style="content-visibility: auto; contain-intrinsic-size: 520px"
				:key="card.key || `card-${index}`"
				:icon="card.icon"
				:external="true"
				:title="card.title"
				:description="card.description"
				:content="card.content"
				:link="card.link"
				:description-link="card.descriptionLink"
				:image="card.image"
				:image-link="card.imageLink"
				:object="{ url: card.object, type: card.objectType }"
				:youtube-id="card.youtubeId"
				:video="card.video"
				:footer="card.footer"
				:secondary-footer="card.secondaryFooter"
				:color="card.color || 0xffffff"
				hydrate-on-visible
			/>
		</div>
		<LazyClientOnly>
			<div
				v-if="isLoadingMore"
				class="flex justify-center py-4"
			>
				<LazyLoading />
			</div>
			<div
				v-if="hasMore"
				ref="loadMoreRef"
				class="h-1 w-full"
			></div>
		</LazyClientOnly>
	</div>
</template>

<script setup lang="ts">
import ActivityEditorModal from '../admin/ActivityEditorModal.vue';

const props = defineProps<{
	activity: Activity;
}>();

const { user } = useAuth();
const { islands, loadIslandsForActivity } = useActivityIslands();
const { cards, loadCardsForActivity, loadMore, hasMore, isLoadingMore } = useActivityCards();

const editing = ref(false);
const loadMoreRef = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;
let loadMoreRaf: number | null = null;
let sentinelCheckRaf: number | null = null;

const activityReloadKey = computed(() => {
	const id = props.activity?.id || '';
	const name = props.activity?.name || '';
	const aliases = props.activity?.aliases?.join(',') || '';
	return `${id}:${name}:${aliases}`;
});

const queueLoadMore = () => {
	if (!import.meta.client) return;
	if (!hasMore.value || isLoadingMore.value) return;
	if (loadMoreRaf !== null) return;

	loadMoreRaf = window.requestAnimationFrame(async () => {
		loadMoreRaf = null;
		if (!hasMore.value || isLoadingMore.value) return;
		await loadMore();
	});
};

const scheduleSentinelCheck = () => {
	if (!import.meta.client) return;
	if (sentinelCheckRaf !== null) return;

	sentinelCheckRaf = window.requestAnimationFrame(() => {
		sentinelCheckRaf = null;
		void maybeLoadMoreIfSentinelVisible();
	});
};

const maybeLoadMoreIfSentinelVisible = async () => {
	if (!loadMoreRef.value || !hasMore.value || isLoadingMore.value) return;
	if (!import.meta.client) return;

	const rect = loadMoreRef.value.getBoundingClientRect();
	if (rect.top <= window.innerHeight + 200) {
		queueLoadMore();
	}
};

// Reload when the activity changes (name or aliases)
watch(
	activityReloadKey,
	() => {
		loadCardsForActivity(props.activity);
		loadIslandsForActivity(props.activity);
	},
	{ immediate: true }
);

onMounted(() => {
	observer = new IntersectionObserver(
		(entries) => {
			if (entries[0]?.isIntersecting) {
				queueLoadMore();
			}
		},
		{ rootMargin: '300px 0px 300px 0px', threshold: 0.01 }
	);

	if (loadMoreRef.value) {
		observer.observe(loadMoreRef.value);
	}

	scheduleSentinelCheck();
});

watch(loadMoreRef, (newEl, oldEl) => {
	if (!observer) return;
	if (oldEl) {
		observer.unobserve(oldEl);
	}
	if (newEl) {
		observer.observe(newEl);
	}
});

watch(
	() => cards.value.length,
	() => {
		scheduleSentinelCheck();
	},
	{ flush: 'post' }
);

watch([hasMore, isLoadingMore], () => {
	scheduleSentinelCheck();
});

onUnmounted(() => {
	if (import.meta.client && loadMoreRaf !== null) {
		window.cancelAnimationFrame(loadMoreRaf);
		loadMoreRaf = null;
	}

	if (import.meta.client && sentinelCheckRaf !== null) {
		window.cancelAnimationFrame(sentinelCheckRaf);
		sentinelCheckRaf = null;
	}

	if (observer) {
		observer.disconnect();
		observer = null;
	}
});
</script>
