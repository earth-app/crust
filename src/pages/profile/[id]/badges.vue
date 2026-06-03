<template>
	<div
		v-if="user"
		class="flex flex-col items-center px-4"
	>
		<h2 class="text-xl font-semibold my-2 mt-28 md:mt-2">{{ handle }}'s Badges</h2>
		<LazyUserCard
			:user="user"
			class="w-full max-w-2xl mb-4"
			hydrate-on-idle
		/>

		<template v-if="isOwnProfile && masteryList">
			<h3 class="my-4 font-medium text-lg">Available Mastery Quests</h3>
			<p class="text-sm opacity-80 -mt-2 mb-2 text-center max-w-xl">
				{{ masteryList.active }} / {{ masteryList.cap }} mastery slots used.
				<span
					v-if="masteryList.active >= masteryList.cap"
					class="text-error"
				>
					Complete or let one expire before generating another.
				</span>
				<span v-else> Each generated mastery expires {{ ttlDays }} days after creation. </span>
			</p>
			<div
				v-if="activeMasteryItems.length"
				class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 justify-items-center items-center gap-4 my-4 mx-8"
			>
				<LazyUserQuestThumbnail
					v-for="item in activeMasteryItems"
					:key="item.quest.id"
					:quest="item.quest"
					:progress="masteryProgressFor(item.quest.id)"
					:current="item.quest.id === quest?.questId"
				/>
			</div>
			<p
				v-else
				class="text-xs opacity-60 mb-4"
			>
				No active mastery quests. Generate one from any completed badge below.
			</p>
		</template>

		<h3 class="mt-4 font-medium text-lg">Mastered Badges</h3>
		<h4 class="text-sm opacity-80 mb-4">
			{{ masteredBadges.length }}/{{ nonMasteryExemptBadges }} Mastered
		</h4>

		<div
			v-if="masteredBadges.length"
			class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 justify-items-center items-center gap-4"
		>
			<LazyUserBadgeCard
				v-for="badge in masteredBadges"
				:key="badge.id"
				:badge="badge"
				hydrate-on-visible
			/>
		</div>
		<div
			v-else
			class="flex items-center"
		>
			<Loading />
		</div>

		<h3 class="mt-4 font-medium text-lg">Completed Badges</h3>
		<h4 class="text-sm opacity-80 mb-4">
			{{ completedBadges.length }}/{{ badges.length }} Completed
		</h4>

		<div
			v-if="completedBadges.length"
			class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 justify-items-center items-center gap-4"
		>
			<LazyUserBadgeCard
				v-for="badge in completedBadges"
				:key="badge.id"
				:badge="badge"
				hydrate-on-visible
			/>
		</div>
		<div
			v-else
			class="flex items-center"
		>
			<Loading />
		</div>

		<h3 class="my-4 font-medium text-lg">All Badges</h3>
		<div
			v-if="badges.length > 0"
			class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 justify-items-center items-center gap-4"
		>
			<LazyUserBadgeCard
				v-for="badge in badges"
				:key="badge.id"
				:badge="badge"
				hydrate-on-visible
			/>
		</div>
		<div
			v-else
			class="flex items-center"
		>
			<Loading />
		</div>
	</div>
	<div
		v-else-if="user === null"
		class="flex flex-col items-center px-4 mt-28 md:mt-2"
	>
		<h2 class="text-xl font-semibold">User Not Found</h2>
		<p class="text-base mt-2">The user you are looking for does not exist.</p>
	</div>
	<div
		v-else
		class="flex flex-col items-center px-4 mt-28 md:mt-2"
	>
		<Loading />
	</div>
</template>

<script setup lang="ts">
const route = useRoute();
const {
	user,
	fetchUser,
	badges,
	fetchBadges,
	quest,
	fetchUserQuest,
	questHistory,
	fetchQuestHistory,
	masteryList,
	fetchMasteryList
} = useUser(route.params.id as string);
const { handle } = useDisplayName(user);
const { setTitleSuffix } = useTitleSuffix();
const { user: authUser } = useAuth();
const userStore = useUserStore();

// masteries are private state - only fetch when viewing your own profile (mantle2 enforces
// 403 anyway, but a preflight check avoids a needless round trip + console error)
const isOwnProfile = computed(() => {
	if (!user.value || !authUser.value) return false;
	return user.value.id === authUser.value.id;
});

const ttlDays = computed(() => {
	if (!masteryList.value) return 90;
	return Math.round(masteryList.value.ttl_seconds / 86400);
});

const masteryProgressFor = (questId: string) => {
	const uid = authUser.value?.id;
	if (!uid) return undefined;
	const current = userStore.quest.get(uid);
	if (current?.questId === questId) return current.progress;
	const history = userStore.questHistory.get(uid);
	return history?.get(questId)?.progress;
};

onMounted(() => {
	fetchUser();
	fetchBadges();
	if (isOwnProfile.value && authUser.value) {
		fetchUserQuest();
		fetchQuestHistory();
		fetchMasteryList();
	}
});

watch(isOwnProfile, (own) => {
	if (own && authUser.value) {
		fetchUserQuest();
		fetchQuestHistory();
		fetchMasteryList();
	}
});

const completedBadges = computed(() => badges.value.filter((b) => b.granted));
const masteredBadges = computed(() => badges.value.filter((b) => b.mastered));
const nonMasteryExemptBadges = computed(() => badges.value.filter((b) => !b.mastery_exempt).length);

// hide finished masteries from the active list - the dedicated "Mastered Badges" section
// below already surfaces them, and showing them here misled users into thinking the slot
// was still occupied even though `active` correctly excluded them
const activeMasteryItems = computed(
	() => masteryList.value?.items.filter((i) => !i.mastered) ?? []
);

watch(
	() => user.value,
	(user) => {
		if (user) {
			setTitleSuffix(`${handle.value}'s Badges`);
		} else if (user === null) {
			setTitleSuffix('User Not Found');
		} else {
			setTitleSuffix('Badges');
		}
	}
);
</script>
