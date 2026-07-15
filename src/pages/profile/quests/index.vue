<template>
	<div
		v-if="user !== undefined"
		class="flex flex-col items-center px-8"
	>
		<div class="flex mt-8">
			<h1
				id="quests-title"
				class="text-3xl font-bold"
			>
				Quests
			</h1>
			<UButton
				icon="mdi:progress-question"
				color="secondary"
				variant="subtle"
				class="ml-2"
				@click="startTour('quests')"
			/>
		</div>
		<span class="text-base opacity-90">Track your progress and earn rewards!</span>

		<div class="flex gap-2 mt-6 w-full max-w-2xl">
			<UInput
				v-model="search"
				placeholder="Search Quests..."
				icon="mdi:magnify"
				class="flex-1"
				@keyup.enter="refresh"
			/>
			<UButton
				color="primary"
				icon="mdi:refresh"
				:loading="isRefreshing"
				@click="refresh"
			>
				Refresh
			</UButton>
		</div>

		<div
			v-if="trimmedSearch"
			class="flex flex-col items-center w-full mt-8"
		>
			<h2 class="text-xl">Search Results</h2>
			<span class="text-base opacity-80">{{ searchResults.length }} matches</span>
			<div
				v-if="searchResults.length > 0"
				class="grid grid-cols-2 lg:grid-cols-3 gap-4 pt-4"
			>
				<LazyUserQuestThumbnail
					v-for="(q, i) in searchResults"
					:id="`quest-${i}`"
					:key="q.id"
					:quest="q"
					:progress="questHistory.get(q.id)?.progress"
					:completedAt="questHistory.get(q.id)?.completedAt"
					hydrate-on-visible
				/>
			</div>
			<span
				v-else
				class="text-base opacity-60 mt-4"
			>
				No quests match "{{ trimmedSearch }}". Hit refresh to search your full history.
			</span>
		</div>

		<template v-else-if="!trimmedSearch">
			<div
				v-if="quest?.quest"
				class="flex flex-col items-center"
			>
				<h2 class="text-xl mt-8 mb-4">Current Quest</h2>
				<LazyUserQuestThumbnail
					id="current-quest"
					:quest="quest.quest"
					:progress="quest.progress"
					:current="true"
				/>
			</div>

			<div
				v-if="premiumQuests && premiumQuests.length > 0"
				class="flex flex-col items-center mt-8 p-4 bg-gray-900 light:bg-gray-200/20 border-2 border-warning-500 rounded-lg"
			>
				<h2 class="text-xl">Premium Quests</h2>
				<span class="text-base opacity-80">{{ premiumQuests.length }} Total</span>

				<UModal
					v-if="isFree"
					:modal="true"
					fullscreen
					dismissible
				>
					<UButton
						v-if="isFree"
						class="mt-2"
						color="warning"
						icon="mdi:star-circle"
					>
						Upgrade
					</UButton>

					<template #title>
						<div class="flex">
							<UIcon
								name="mdi:diamond-stone"
								class="size-6"
							/>
							<span class="ml-2">Upgrade to Access Premium Quests</span>
						</div>
					</template>
					<template #body>
						<div class="flex flex-col w-full items-center gap-4">
							<LazyUserCard
								v-if="user"
								:user="user"
							/>
							<LazyPricingPlans highlighted="PRO" />
						</div>
					</template>
				</UModal>

				<div class="grid grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
					<LazyUserQuestThumbnail
						v-for="(q, i) in premiumQuests"
						:id="`quest-${i}`"
						:key="q.id"
						:quest="q"
						:progress="questHistory.get(q.id)?.progress"
						:completedAt="questHistory.get(q.id)?.completedAt"
						hydrate-on-visible
					/>
				</div>
			</div>

			<div
				v-if="byRarity.size > 0"
				class="flex flex-col items-center mt-8"
			>
				<h2 class="text-xl">By Rarity</h2>

				<div
					v-for="[rarity, quests] of byRarity"
					:key="rarity"
					class="flex flex-col items-center"
				>
					<h3 class="text-lg font-semibold mt-4">{{ capitalizeFully(rarity) }}</h3>
					<span class="text-base opacity-80">{{ quests.length }} Total</span>

					<div class="grid grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
						<LazyUserQuestThumbnail
							v-for="(q, i) in quests"
							:id="`quest-${i}`"
							:key="q.id"
							:quest="q"
							:progress="questHistory.get(q.id)?.progress"
							:completedAt="questHistory.get(q.id)?.completedAt"
							hydrate-on-visible
						/>
					</div>
				</div>
			</div>

			<h2 class="text-xl mt-8">All Quests</h2>
			<span
				v-if="allQuests.length > 0"
				class="text-base opacity-80"
				>{{ allQuests.length }} Total</span
			>
			<div
				v-if="allQuests.length > 0"
				class="grid grid-cols-2 lg:grid-cols-3 gap-4 pt-4"
			>
				<LazyUserQuestThumbnail
					v-for="(q, i) in allQuests"
					:id="`quest-${i}`"
					:key="q.id"
					:quest="q"
					:progress="questHistory.get(q.id)?.progress"
					:completedAt="questHistory.get(q.id)?.completedAt"
					hydrate-on-visible
				/>
			</div>

			<h2 class="text-xl mt-8">Completed Quests</h2>
			<span
				v-if="completedQuests && completedQuests.length > 0"
				class="text-base opacity-80"
			>
				{{ completedQuests.length }} Total
			</span>
			<div v-if="completedQuests && completedQuests.length > 0">
				<div class="grid grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
					<LazyUserQuestThumbnail
						v-for="(q, i) in completedQuests"
						:id="`quest-${i}`"
						:key="q.id"
						:quest="q"
						:progress="questHistory.get(q.id)?.progress"
						:completedAt="questHistory.get(q.id)?.completedAt"
						hydrate-on-visible
					/>
				</div>
			</div>
			<div
				v-else
				class="text-center"
			>
				<span class="text-base opacity-60 mt-4"> No completed quests yet. Try one today!</span>
			</div>

			<Loading v-if="quests === null" />
			<span
				v-else-if="allQuests.length === 0"
				class="text-base opacity-60 mt-4"
				>No quests available.</span
			>
		</template>
	</div>
	<Loading v-else />

	<ClientOnly>
		<SiteTour
			:steps="questTour"
			name="Quests Tour"
			tour-id="quests"
		/>
	</ClientOnly>

	<LazyUserQuestModal
		v-if="autoOpenQuest"
		v-model:open="autoOpen"
		:quest="autoOpenQuest"
		:progress="autoOpenProgress"
		:completedAt="autoOpenCompletedAt"
	/>
</template>

<script setup lang="ts">
definePageMeta({
	pageTransition: false,
	layoutTransition: false,
	viewTransition: false
});

const { user } = useAuth();
const { quests, fetchQuests } = useQuests();
const userId = computed(() => user.value?.id);
const { quest, fetchUserQuest, questHistory, fetchQuestHistory } = useUser(userId);
const { setTitleSuffix } = useTitleSuffix();
const route = useRoute();

const isFree = computed(() => user.value?.account.account_type === 'FREE');

const search = ref('');
const isRefreshing = ref(false);
const trimmedSearch = computed(() => search.value.trim());

// the cloud caps quest-history responses at 100 per page. server-side search lets users
// look up completed quests beyond that window without an explicit pagination UI
const HISTORY_PAGE_LIMIT = 100;

async function refresh() {
	if (!userId.value || isRefreshing.value) return;
	isRefreshing.value = true;
	try {
		await Promise.all([
			fetchQuests(true),
			fetchUserQuest(true),
			fetchQuestHistory({
				force: true,
				limit: HISTORY_PAGE_LIMIT,
				...(trimmedSearch.value ? { search: trimmedSearch.value } : {})
			})
		]);
	} finally {
		isRefreshing.value = false;
	}
}

// defer non-critical fetches off the hydration / route-transition critical path
// so the modal (when opened via ?open=<id>) can paint immediately. The auth
// plugin's invalidateSelf already kicks off quest/history fetches on login.
function deferIdle(run: () => void, timeout = 1_500) {
	if (typeof window === 'undefined') {
		run();
		return;
	}
	const ric = (window as any).requestIdleCallback as
		((cb: IdleRequestCallback, opts?: IdleRequestOptions) => number) | undefined;
	if (ric) ric(() => run(), { timeout });
	else setTimeout(run, 0);
}

watch(
	() => user.value,
	(newUser) => {
		if (newUser) {
			void fetchQuests(true);
			const wantsOpen = typeof route.query.open === 'string';
			if (wantsOpen) void fetchUserQuest();
			deferIdle(() => {
				if (!wantsOpen) void fetchUserQuest();
				void fetchQuestHistory({ limit: HISTORY_PAGE_LIMIT });
			});
		} else if (newUser === null) {
			navigateTo(`/login?redirect=${encodeURIComponent(useRoute().fullPath)}`);
		}
	},
	{ immediate: true }
);

const allQuests = computed<Quest[]>(() => {
	const merged = new Map<string, Quest>();
	// drop malformed entries (a quest with no id) so the search filter can't throw on
	// `.id.toLowerCase()` and take down the whole list
	for (const q of quests.value ?? []) if (q?.id) merged.set(q.id, q);
	for (const entry of questHistory.value.values()) {
		if (entry?.quest?.id && !merged.has(entry.quest.id)) merged.set(entry.quest.id, entry.quest);
	}
	return Array.from(merged.values());
});

const byRarity = computed(() => {
	const map = new Map<string, Quest[]>();
	for (const quest of allQuests.value) {
		if (quest.mobile_only) continue;

		const rarity = quest.rarity || 'normal';
		if (!map.has(rarity)) {
			map.set(rarity, []);
		}
		map.get(rarity)?.push(quest);
	}
	return map;
});

const premiumQuests = computed(() => allQuests.value.filter((q) => q.premium && !q.mobile_only));

const completedQuests = computed(() =>
	allQuests.value.filter((q) => questHistory.value.get(q.id)?.completedAt)
);

const searchResults = computed<Quest[]>(() => {
	const term = trimmedSearch.value.toLowerCase();
	if (!term) return [];
	return allQuests.value.filter((q) => {
		const id = q.id?.toLowerCase() ?? '';
		const title = q.title?.toLowerCase() ?? '';
		const description = q.description?.toLowerCase() ?? '';
		return id.includes(term) || title.includes(term) || description.includes(term);
	});
});

// quest tours
const { startTour } = useSiteTour();
const questTour = computed<SiteTourStep[]>(() => [
	{
		id: 'quests-title',
		title: 'Your Quest Hub',
		description:
			'Quests turn an activity into a structured journey: a series of steps to complete with a reward at the end. Browse by rarity below, or jump back into your active quest if you have one.',
		footer: 'You can only have one active quest at a time - pick one that excites you.',
		icon: 'mdi:sword-cross',
		placement: 'bottom'
	},
	{
		id: 'current-quest',
		title: 'Your Active Quest',
		description:
			"This is the quest you're currently working through. Click it to open the timeline and submit progress on the next step.",
		footer: 'Only one quest is active at a time.',
		icon: 'mdi:shield-sword',
		highlightPadding: 8,
		condition: () => !!quest.value?.quest
	},
	{
		id: 'quest-0',
		title: 'Browse Quests',
		description:
			'Click any quest to see its steps. Tasks might ask you to read articles, take a photo, record audio, sort items, or visit a place. Premium quests are unlocked with PRO accounts.',
		footer:
			'Steps may include time delays or be mobile-only - those will be flagged in the quest timeline.',
		icon: 'mdi:map-marker-path',
		highlightPadding: 8,
		waitFor: 'quest-0',
		waitTimeout: 4000,
		condition: () => !!quests.value && quests.value.length > 0
	}
]);

setTitleSuffix('Quests');
useSeoMeta({
	ogTitle: 'Quests - The Earth App',
	ogDescription: 'Track your progress and earn rewards with quests on The Earth App!'
});

// auto-open a quest modal when navigated here via ?open=<id> (used by the daily-quest chip)
const router2 = useRouter();
const autoOpen = ref(false);
const autoOpenQuest = computed<Quest | null>(() => {
	const id = typeof route.query.open === 'string' ? route.query.open : null;
	if (!id) return null;
	if (quest.value?.quest?.id === id) return quest.value.quest;

	return allQuests.value.find((q) => q.id === id) ?? null;
});

const autoOpenProgress = computed(() => {
	const id = autoOpenQuest.value?.id;
	if (!id) return undefined;
	if (quest.value?.questId === id) return quest.value.progress;
	return questHistory.value.get(id)?.progress;
});
const autoOpenCompletedAt = computed(() => {
	const id = autoOpenQuest.value?.id;
	if (!id) return undefined;
	return questHistory.value.get(id)?.completedAt;
});

const wantsAutoOpen = computed(() => typeof route.query.open === 'string');
if (import.meta.client) {
	watch(
		wantsAutoOpen,
		(wants) => {
			if (!wants) return;
			try {
				// note: prefetchComponents takes the non-Lazy name even when used with LazyXxx
				void prefetchComponents(['UserQuestModal', 'UserQuestTimeline']);
			} catch {
				// prefetchComponents is best-effort; ignore failures
			}
		},
		{ immediate: true }
	);
}

watch(
	autoOpenQuest,
	(q) => {
		if (q) autoOpen.value = true;
	},
	{ immediate: true }
);

watch(autoOpen, (open) => {
	if (open) return;
	if (typeof route.query.open !== 'string') return;
	const { open: _omit, ...rest } = route.query;
	deferIdle(() => router2.replace({ query: rest }), 500);
});
</script>
