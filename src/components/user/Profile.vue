<template>
	<div class="flex flex-col items-center w-full mt-6">
		<div class="flex flex-col items-center mb-8">
			<UAvatar
				:src="avatar"
				id="avatar"
				class="size-20 sm:size-24 md:size-28 lg:size-32 rounded-full shadow-lg shadow-black/50 mb-4 hover:scale-110 transition-transform duration-300"
				width="128"
				height="128"
			/>
			<div class="flex flex-col md:flex-row">
				<h1 class="text-3xl font-semibold">
					{{ handle }}
				</h1>
				<UserTypeBadge
					:user="props.user"
					:editor="user?.account.account_type === 'ADMINISTRATOR'"
					class="ml-3 mt-1 mb-2"
				/>
			</div>
			<h2
				v-if="hasFullName"
				class="text-xl ml-2 text-gray-400"
			>
				@{{ props.user.username }}
			</h2>
			<span
				v-if="props.user.account.bio"
				class="mt-1 text-center max-w-md"
			>
				{{ props.user.account.bio }}
			</span>
		</div>
		<div class="flex mb-4">
			<UBadge
				v-if="props.user.account.email && props.user.account.email_verified"
				:label="props.user.account.email"
				variant="subtle"
				icon="mdi:mail-ru"
				class="mr-2 hover:cursor-pointer"
				@click="openEmail"
			/>
			<UBadge
				v-if="props.user.account.address"
				:label="props.user.account.address"
				variant="subtle"
				icon="mdi:map-marker"
				color="warning"
				class="mr-2"
			/>
			<UBadge
				v-if="props.user.account.country"
				:label="props.user.account.country"
				variant="subtle"
				icon="mdi:flag"
				color="info"
				class="mr-2"
			/>
		</div>
		<div class="flex items-center justify-center flex-wrap max-w-200">
			<UBadge
				v-for="(activity, i) in props.user.activities"
				:label="activity.name"
				:color="i <= 2 ? 'primary' : 'secondary'"
				:icon="activity.fields['icon']"
				:variant="badgeVariants[i] || 'outline'"
				@mouseenter="badgeVariants[i] = 'solid'"
				@mouseleave="badgeVariants[i] = 'outline'"
				@click="$router.push(`/activities/${activity.id}`)"
				:ui="{
					base: 'text-xs sm:text-sm md:text-md lg:text-base px-1 sm:px-1.5 md:px-2.5 py-1 gap-1 md:gap-1.5 rounded-sm sm:rounded-md',
					leadingIcon: 'size-4 sm:size-5 md:size-6'
				}"
				class="hover:cursor-pointer transition-all duration-500 ml-2 mb-2 sm:mb-3"
			/>
		</div>
		<div
			class="min-w-130 max-w-4xl mt-4"
			id="user-friends"
		>
			<UserFriends :user="props.user" />
		</div>
		<div
			class="min-w-80 max-w-3xl mt-4"
			id="user-journeys"
		>
			<UserJourneys :user="props.user" />
		</div>
		<div
			class="flex flex-col items-center mt-12 w-full"
			id="user-friends"
		>
			<h1 class="text-2xl font-bold">{{ props.user?.username }}'s Friends</h1>
			<InfoCardGroup
				v-if="props.user.friends"
				:title="`Friends of ${displayName}`"
				:description="`${props.user.friends.length} Friends connected to ${props.user.username} (${Math.min(props.user.friends.length, 100)} shown here)`"
				icon="mdi:account-multiple-outline"
				:icon-button="true"
				@icon-click="openFriends"
				class="w-11/12 my-4"
			>
				<UserCard
					v-for="friend in friends"
					:key="friend.id"
					:user="friend"
				/>
			</InfoCardGroup>
			<h2 v-else>
				{{ props.user.username }} hasn't added any friends yet. Be the first to connect!
			</h2>
		</div>
		<div
			class="flex flex-col items-center mt-12 mb-2 w-full"
			id="user-content"
		>
			<h1 class="text-2xl font-bold">{{ props.user?.username }}'s Content</h1>
			<InfoCardGroup
				v-if="prompts.length > 0"
				:title="`Prompts by ${displayName}`"
				:description="`${totalPrompts} Prompts created by ${props.user.username} (${Math.min(totalPrompts, 25)} shown here)`"
				icon="mdi:pencil-circle-outline"
				:icon-button="true"
				@icon-click="openPrompts"
				class="w-11/12 my-4"
				show-progress
			>
				<PromptCard
					v-for="prompt in prompts"
					:key="prompt.id"
					:prompt="prompt"
				/>
			</InfoCardGroup>
			<InfoCardGroup
				v-if="articles.length > 0"
				:title="`Articles by ${displayName}`"
				:description="`${totalArticles} Articles written by ${props.user.username} (${Math.min(totalArticles, 25)} shown here)`"
				icon="mdi:newspaper-variant-multiple-outline"
				:icon-button="true"
				@icon-click="openArticles"
				class="w-11/12 my-4"
				show-progress
			>
				<ArticleCard
					v-for="article in articles"
					:key="article.id"
					:article="article"
				/>
			</InfoCardGroup>
			<h2 v-if="prompts.length === 0 && articles.length === 0">
				{{ props.user.username }} has not created any content.
			</h2>
		</div>
	</div>
	<ContentDrawer
		ref="drawerRef"
		:title="drawerTitle"
		:is-loading="isLoading"
		@load-more="handleLoadMore"
	>
		<UserCard
			v-if="mode === 'friends'"
			v-for="friend in filteredFriends"
			:key="friend.id"
			:user="friend"
		/>
		<PromptCard
			v-else-if="mode === 'prompts'"
			v-for="prompt in filteredPrompts"
			:key="prompt.id"
			:prompt="prompt"
		/>
		<ArticleCard
			v-else-if="mode === 'articles'"
			v-for="article in filteredArticles"
			:key="article.id"
			:article="article"
		/>
	</ContentDrawer>
</template>

<script setup lang="ts">
import ContentDrawer from '~/components/ContentDrawer.vue';
import type { Article } from '~/shared/types/article';
import type { Prompt } from '~/shared/types/prompts';
import type { User } from '~/shared/types/user';

const props = defineProps<{
	user: User;
	title?: string;
}>();

const { user } = useAuth();
const { name: displayName, handle, hasFullName } = useDisplayName(() => props.user);

const { avatar } = useUser(props.user.id);
const {
	prompts,
	total: totalPrompts,
	fetch: fetchPrompts
} = useUserPrompts(props.user.id, 1, 25, 'rand');
const {
	articles,
	total: totalArticles,
	fetch: fetchArticles
} = useUserArticles(props.user.id, 1, 25, 'rand');
const { friends, fetchFriendsPage } = useFriends(props.user.id);

const badgeVariants = ref<('outline' | 'solid')[]>([]);

function openEmail() {
	if (!props.user.account.email && !props.user.account.email_verified) return;
	window.location.href = `mailto:${props.user.account.email}`;
}

const drawerRef = ref<InstanceType<typeof ContentDrawer>>();
const mode = ref<'friends' | 'prompts' | 'articles' | null>(null);
const allFriends = ref<User[]>([]);
const allPrompts = ref<Prompt[]>([]);
const allArticles = ref<Article[]>([]);

const drawerTitle = computed(() => {
	if (mode.value === 'friends') return `${displayName.value}'s Friends`;
	if (mode.value === 'prompts') return `Prompts by ${displayName.value}`;
	if (mode.value === 'articles') return `Articles by ${displayName.value}`;
	return '';
});

const search = computed(() => drawerRef.value?.search || '');

// Client-side filtering for already loaded content
const filteredFriends = computed(() => {
	if (!search.value.trim()) return allFriends.value;
	const searchLower = search.value.toLowerCase();
	return allFriends.value.filter((friend) => {
		const fullName = friend.full_name?.toLowerCase() || '';
		const username = friend.username.toLowerCase();
		return fullName.includes(searchLower) || username.includes(searchLower);
	});
});

const filteredPrompts = computed(() => {
	if (!search.value.trim()) return allPrompts.value;
	const searchLower = search.value.toLowerCase();
	return allPrompts.value.filter((prompt) => {
		return prompt.prompt.toLowerCase().includes(searchLower);
	});
});

const filteredArticles = computed(() => {
	if (!search.value.trim()) return allArticles.value;
	const searchLower = search.value.toLowerCase();
	return allArticles.value.filter((article) => {
		const title = article.title.toLowerCase();
		const description = article.description.toLowerCase();
		return title.includes(searchLower) || description.includes(searchLower);
	});
});
const friendsPage = ref(1);
const friendsHasMore = ref(true);
const promptsPage = ref(1);
const promptsHasMore = ref(true);
const articlesPage = ref(1);
const articlesHasMore = ref(true);
const isLoading = ref(false);

// load functions for each content type
async function loadFriends() {
	if (isLoading.value || !friendsHasMore.value) return;
	isLoading.value = true;

	const res = await fetchFriendsPage(friendsPage.value, 100, search.value);
	if (res.success && res.data) {
		if ('message' in res.data) {
			friendsHasMore.value = false;
		} else {
			allFriends.value.push(...res.data.items);
			friendsHasMore.value = allFriends.value.length < res.data.total;
			friendsPage.value++;
		}
	} else {
		friendsHasMore.value = false;
	}

	isLoading.value = false;
}

async function loadPrompts() {
	if (isLoading.value || !promptsHasMore.value) return;
	isLoading.value = true;

	const res = await fetchPrompts(promptsPage.value, 100, search.value);
	if (res.success && res.data) {
		if ('message' in res.data) {
			promptsHasMore.value = false;
		} else {
			allPrompts.value.push(...res.data.items);
			promptsHasMore.value = allPrompts.value.length < res.data.total;
			promptsPage.value++;
		}
	} else {
		promptsHasMore.value = false;
	}

	isLoading.value = false;
}

async function loadArticles() {
	if (isLoading.value || !articlesHasMore.value) return;
	isLoading.value = true;

	const res = await fetchArticles(articlesPage.value, 100, search.value);
	if (res.success && res.data) {
		if ('message' in res.data) {
			articlesHasMore.value = false;
		} else {
			allArticles.value.push(...res.data.items);
			articlesHasMore.value = allArticles.value.length < res.data.total;
			articlesPage.value++;
		}
	} else {
		articlesHasMore.value = false;
	}

	isLoading.value = false;
}

async function openFriends() {
	if (drawerRef.value) drawerRef.value.search = '';
	mode.value = 'friends';
	allFriends.value = [];
	friendsPage.value = 1;
	friendsHasMore.value = true;
	drawerRef.value?.open();
	await loadFriends();
}

async function openPrompts() {
	if (drawerRef.value) drawerRef.value.search = '';
	mode.value = 'prompts';
	allPrompts.value = [];
	promptsPage.value = 1;
	promptsHasMore.value = true;
	drawerRef.value?.open();
	await loadPrompts();
}

async function openArticles() {
	if (drawerRef.value) drawerRef.value.search = '';
	mode.value = 'articles';
	allArticles.value = [];
	articlesPage.value = 1;
	articlesHasMore.value = true;
	drawerRef.value?.open();
	await loadArticles();
}

async function handleLoadMore() {
	if (mode.value === 'friends') await loadFriends();
	else if (mode.value === 'prompts') await loadPrompts();
	else if (mode.value === 'articles') await loadArticles();
}
</script>
