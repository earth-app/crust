<template>
	<div class="flex flex-col w-full items-center justify-center mt-4">
		<div class="flex items-start h-24 w-24">
			<UIcon
				id="activity-icon"
				:name="activity.fields['icon'] || 'mdi:earth'"
				size="6rem"
				class="my-2"
			/>
			<UButton
				icon="mdi:progress-question"
				color="secondary"
				variant="subtle"
				@click="startTour('activities')"
			/>
		</div>
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

			<div class="ml-2 mt-2">
				<UButton
					v-if="questState === 'not_started'"
					color="success"
					@click="questOpen = true"
				>
					<UIcon name="mdi:sword-cross" />
					View Quest
				</UButton>

				<UButton
					v-else-if="questState === 'in_progress'"
					color="warning"
					@click="questOpen = true"
				>
					<UIcon name="mdi:shield-sword" />
					Continue Quest
				</UButton>

				<UButton
					v-else-if="questState === 'completed'"
					color="primary"
					variant="outline"
					@click="questOpen = true"
				>
					<UIcon name="mdi:shield-crown-outline" />
					View Completed Quest
				</UButton>

				<LazyUserQuestModal
					v-if="quest"
					v-model:open="questOpen"
					:quest="quest"
					:progress="
						questState === 'completed'
							? completedQuestProgress?.progress
							: inProgressQuestProgress?.progress
					"
					:completed-at="
						questState === 'completed' ? completedQuestProgress?.completedAt : undefined
					"
				/>
			</div>
		</div>
		<h3
			id="activity-description"
			class="text-md sm:text-lg md:text-xl min-w-75 w-3/5 mt-8"
		>
			{{ activity.description }}
		</h3>
		<!-- Icon Islands -->
		<UIcon
			v-for="island in islands"
			:key="island.name"
			:name="island.icon"
			class="absolute top-0 hidden md:inline-block md:size-8 lg:size-12 z-10duration-300 motion-preset-fade-lg"
			:style="{ transform: `translate(${island.x}vw, ${island.y}vh)` }"
		/>
		<div
			id="activity-cards"
			class="grid grid-cols-1 xl:grid-cols-2 justify-items-center items-stretch w-2/3 min-w-100 xl:min-w-260 mt-6 sm:px-4 gap-y-8"
		>
			<!-- Skeleton Loading Cards -->
			<InfoCardSkeleton
				v-if="cards.length === 0"
				v-for="n in 6"
				:key="`skeleton-${n}`"
			/>

			<!-- Card Data Entries (with widgets interleaved every 6 cards) -->
			<template
				v-for="(card, index) in cards"
				:key="card.key || `card-${index}`"
			>
				<LazyInfoCard
					:id="`card-${index}`"
					class="z-20 contain-[layout_paint_style]"
					style="content-visibility: auto; contain-intrinsic-size: 520px"
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
				<LazyWidgetSlot
					v-if="cardWidgetKind(index)"
					:kind="cardWidgetKind(index)!"
					:activity="{ id: activity.id, name: activity.name }"
					hydrate-on-visible
				/>
			</template>
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

		<ClientOnly>
			<SiteTour
				:steps="activityTour"
				name="Activity Tour"
				tour-id="activities"
				:pulse="true"
			/>
		</ClientOnly>
	</div>
</template>

<script setup lang="ts">
import ActivityEditorModal from '../admin/ActivityEditorModal.vue';

const props = defineProps<{
	activity: Activity;
}>();

const { user } = useAuth();
const { widgetForIndex } = useFeedWidgets();
const { islands, loadIslandsForActivity } = useActivityIslands();
const { cards, loadCardsForActivity, loadMore, hasMore, isLoadingMore } = useActivityCards();

// interleave a widget after every 6 InfoCards (positions 5, 11, 17, ...) so they ride
// alongside the infinite-scroll stream rather than sitting below the loading sentinel.
// shifted by an activity-id hash so different activities don't all show the same widget
// at the same position.
const activityIdHash = computed(() =>
	(props.activity?.id ?? '').split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
);
function cardWidgetKind(index: number): FeedWidgetKind | null {
	// position widget on every 6th card (5, 11, 17, ...) so each row has a clean rhythm
	if ((index + 1) % 6 !== 0) return null;
	// shift the index by activity hash so the picked widget kind varies between activities
	const shifted = 7 + (Math.floor((index + 1) / 6) - 1 + (activityIdHash.value % 8)) * 8;
	return widgetForIndex(shifted);
}

const editing = ref(false);
const loadMoreRef = ref<HTMLElement | null>(null);
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

useIntersectionObserver(
	loadMoreRef,
	(entries) => {
		if (entries[0]?.isIntersecting) queueLoadMore();
	},
	{ rootMargin: '300px 0px 300px 0px', threshold: 0.01 }
);

watch(loadMoreRef, (el) => {
	if (el) scheduleSentinelCheck();
});

onMounted(scheduleSentinelCheck);

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
});

// activity tour

const { startTour } = useSiteTour();

const activityTour: SiteTourStep[] = [
	{
		id: 'activity-icon',
		title: `Welcome to ${props.activity.name}`,
		description:
			"Activities are hobbies, sports, and interests you can explore on the Earth App. Each one has its own page with curated guides, resources, and - if you're up for it - a quest.",
		footer: 'Even if this one is new to you, give it a few cards and see if it sticks.',
		icon: 'mdi:run-fast',
		placement: 'bottom'
	},
	{
		id: 'activity-description',
		title: 'What This Activity Is',
		description: `A short overview of ${props.activity.name}. Scan this first to get the gist before diving into the cards below.`,
		footer: 'Admins can edit this description as the activity evolves.',
		icon: 'mdi:information-outline'
	},
	{
		id: 'activity-cards',
		title: 'Resources & Guides',
		waitFor: 'card-0',
		waitTimeout: 4000,
		description:
			'Each card is a curated resource - a guide, a video, an article, a useful link, or a quick how-to. Tap a card to open it in a new tab.',
		footer:
			'Cards load progressively as you scroll. Reload if you want a fresh shuffle of resources.',
		icon: 'mdi:cards-outline',
		highlightPadding: 12
	}
];

// activity quest

const { fetchQuest } = useQuests();
const quest = ref<Quest | null>(null);
const questOpen = ref(false);
const questState = ref<'not_started' | 'completed' | 'in_progress' | null>(null);
const inProgressQuestProgress = ref<UserQuestProgress | null>(null);
const completedQuestProgress = ref<QuestHistoryEntry | null>(null);

async function loadQuest() {
	const questId = `activity_quest_${props.activity.id}`;
	if (!quest.value) {
		quest.value = await fetchQuest(questId);
		if (!quest.value) {
			// no quest for this activity
			questState.value = null;
			console.warn(`No quest found for activity "${props.activity.id}"`);
			return;
		}
	}

	if (!user.value) return;

	// load user's progress on this quest
	const {
		quest: currentQuest,
		fetchUserQuest,
		questHistory,
		fetchQuestHistory
	} = useUser(user.value?.id);
	const currentProgress = currentQuest.value || (await fetchUserQuest());

	if (quest.value.id === currentProgress?.questId) {
		if (currentProgress.completed) {
			questState.value = 'completed';
			completedQuestProgress.value = questHistory.value?.get(questId) || null;
		} else {
			questState.value = 'in_progress';
			inProgressQuestProgress.value = currentProgress;
		}
	} else {
		const history = questHistory.value || (await fetchQuestHistory());
		const completedEntry = history.get(questId);
		questState.value = completedEntry ? 'completed' : 'not_started';

		if (completedEntry) {
			completedQuestProgress.value = completedEntry;
		}
	}
}

watch(
	() => user.value,
	(newUser) => {
		if (newUser) {
			loadQuest();
		} else {
			quest.value = null;
			questState.value = null;
			inProgressQuestProgress.value = null;
			completedQuestProgress.value = null;
		}
	},
	{ immediate: true }
);

onMounted(() => {
	loadQuest();
});
</script>
