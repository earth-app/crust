<template>
	<UModal v-model:open="open">
		<UButton
			:label="isLabelVisible ? 'Discover' : undefined"
			color="neutral"
			icon="mdi:compass"
			variant="outline"
			class="w-full"
		/>

		<template #content>
			<LazyUCommandPalette
				v-model:search-term="search"
				close
				:loading="loading"
				:groups="filteredGroups"
				@update:open="open = $event"
				:ui="{ itemDescription: 'text-[10px]' }"
				hydrate-on-interaction
			/>
		</template>
	</UModal>
</template>

<script setup lang="ts">
import type { CommandPaletteGroup, CommandPaletteItem } from '#ui/types';

const { user } = useAuth();
const { fetchAll: fetchAllUsers } = useUsers();
const router = useRouter();
const viewport = useViewport();
const open = ref(false);

const users = ref<CommandPaletteItem[]>([]);
const usersLoading = ref(false);
const activities = ref<CommandPaletteItem[]>([]);
const activitiesLoading = ref(false);
const prompts = ref<CommandPaletteItem[]>([]);
const promptsLoading = ref(false);
const articles = ref<CommandPaletteItem[]>([]);
const articlesLoading = ref(false);

const isLabelVisible = computed(() => !viewport.isLessOrEquals('mobileMedium'));

const loading = computed(
	() =>
		usersLoading.value || activitiesLoading.value || promptsLoading.value || articlesLoading.value
);
const search = ref('');

const filteredGroups = computed(() => {
	const result = [];
	for (const group of groups.value) {
		if (!group.items) {
			result.push(group);
			continue;
		}

		const filteredItems = [];
		for (const item of group.items) {
			if ('auth' in item && (item as any).auth === true) {
				if (user.value !== null) {
					filteredItems.push(item);
				}
			} else {
				filteredItems.push(item);
			}
		}

		result.push({
			...group,
			items: filteredItems
		});
	}
	return result;
});

// Watch search changes, but don't use immediate to avoid double-call with onMounted
watch(search, (newSearch: string) => populate(newSearch));
onMounted(() => populate(''));

function populate(searchTerm: string) {
	const empty = searchTerm.length === 0;
	const sort = empty ? 'rand' : 'desc';

	// populate users
	usersLoading.value = true;
	fetchAllUsers(empty ? 5 : 150, searchTerm, sort).then((res) => {
		if (res.success && res.data) {
			const items = res.data;

			users.value = items.map((user) => ({
				id: `user-${user.id}`,
				label: getUserDisplayName(user),
				suffix: `@${user.username}`,
				avatar: {
					src: `${user.account.avatar_url}?size=32`,
					icon: 'mdi:account'
				},
				to: `/profile/@${user.username}`,
				onSelect: close
			})) as CommandPaletteItem[];

			const userGroupIdx = (groups.value as any[]).findIndex((g) => g.id === 'users');
			if (userGroupIdx !== -1) {
				(groups.value[userGroupIdx] as any).items = users.value;
			}
		} else {
			users.value = [];
		}

		usersLoading.value = false;
	});

	// populate activities
	activitiesLoading.value = true;
	const { fetchAll: fetchAllActivities } = useActivities();
	fetchAllActivities(empty ? 5 : 150, searchTerm, sort).then((res) => {
		if (res.success && res.data) {
			const items = res.data;
			activities.value = items.map((activity: any) => ({
				id: `activity-${activity.id}`,
				label: activity.name,
				description: activity.description,
				icon: activity.fields['icon'] || 'mdi:earth',
				to: `/activities/${activity.id}`,
				onSelect: close
			})) as any;

			const activityGroupIdx = (groups.value as any[]).findIndex((g) => g.id === 'activities');
			if (activityGroupIdx !== -1) {
				(groups.value[activityGroupIdx] as any).items = activities.value;
			}
		} else {
			activities.value = [];
		}

		activitiesLoading.value = false;
	});

	// populate prompts
	promptsLoading.value = true;
	const { fetchAll: fetchAllPrompts } = usePrompts();
	fetchAllPrompts(empty ? 5 : 25, searchTerm, sort).then((res) => {
		if (res.success && res.data) {
			const items = res.data;
			prompts.value = items.map((prompt: any) => {
				const owner = prompt.owner;
				const type = owner.account.account_type;
				const isChipShown = owner.is_admin || type === 'ORGANIZER';

				return {
					id: `prompt-${prompt.id}`,
					label: prompt.prompt,
					description: `by ${getUserDisplayName(owner)}`,
					avatar: {
						src: `${owner.account.avatar_url}?size=32`,
						icon: 'mdi:lightbulb-outline',
						chip: {
							color: owner.is_admin ? 'error' : 'warning',
							ui: { root: isChipShown ? 'visible' : 'hidden' }
						}
					},
					to: `/prompts/${prompt.id}`,
					onSelect: close
				};
			}) as any;

			const promptGroupIdx = (groups.value as any[]).findIndex((g) => g.id === 'prompts');
			if (promptGroupIdx !== -1) {
				(groups.value[promptGroupIdx] as any).items = prompts.value;
			}
		} else {
			prompts.value = [];
		}

		promptsLoading.value = false;
	});

	// populate articles
	articlesLoading.value = true;
	const { fetchAll: fetchAllArticles } = useArticles();
	fetchAllArticles(empty ? 5 : 25, searchTerm, sort).then((res) => {
		if (res.success && res.data) {
			const items = res.data;
			articles.value = items.map((article: any) => {
				const owner = article.author;
				const type = owner.account.account_type;
				const isChipShown = owner.is_admin || type === 'ORGANIZER';

				return {
					id: `article-${article.id}`,
					label: article.title,
					description: `by ${getUserDisplayName(owner)} • ${article.tags
						.slice(0, 3)
						.map((tag: any) => `#${tag}`)
						.join(' ')}`,
					avatar: {
						src: `${owner.account.avatar_url}?size=32`,
						icon: 'mdi:file-document-outline',
						chip: {
							color: owner.is_admin ? 'error' : 'warning',
							ui: { root: isChipShown ? 'visible' : 'hidden' }
						}
					},
					to: `/articles/${article.id}`,
					onSelect: close,
					ui: { itemLabel: 'font-semibold' }
				};
			}) as any;

			const articleGroupIdx = (groups.value as any[]).findIndex((g) => g.id === 'articles');
			if (articleGroupIdx !== -1) {
				(groups.value[articleGroupIdx] as any).items = articles.value;
			}
		} else {
			articles.value = [];
		}

		articlesLoading.value = false;
	});
}

const groups = ref<CommandPaletteGroup<CommandPaletteItem>[]>([
	{
		id: 'main',
		items: [
			{
				id: 'home',
				label: 'Home',
				icon: 'mdi:home',
				to: '/',
				onSelect: close
			},
			{
				id: 'profile',
				label: 'Profile',
				icon: 'mdi:account',
				to: '/profile',
				auth: true,
				onSelect: close
			},
			{
				id: 'randomize',
				label: "I'm Feeling Novel",
				icon: 'mdi:dice-multiple',
				onSelect: randomize,
				ui: { itemLabelBase: 'text-primary font-semibold' }
			}
		]
	},
	{
		id: 'activities',
		label: 'Activities'
	},
	{
		id: 'users',
		label: 'Users'
	},
	{
		id: 'prompts',
		label: 'Prompts'
	},
	{
		id: 'articles',
		label: 'Articles'
	}
]);

function close() {
	open.value = false;
}

function randomize() {
	close();

	const choice = Math.floor(Math.random() * 3);
	if (choice === 0) {
		// Random Prompt
		const { fetchRandom: fetchRandomPrompts } = usePrompts();
		fetchRandomPrompts(1).then((res) => {
			if (res.success && res.data && !('message' in res.data)) {
				const prompt = res.data[0];
				if (prompt) {
					router.push(`/prompts/${prompt.id}`);
				}
			}
		});
	} else if (choice === 1) {
		// Random Article
		const { fetchRandom: fetchRandomArticles } = useArticles();
		fetchRandomArticles(1).then((res) => {
			if (res.success && res.data && !('message' in res.data)) {
				const article = res.data[0];
				if (article) {
					router.push(`/articles/${article.id}`);
				}
			}
		});
	} else {
		// Random Activity
		const { fetchRandom: fetchRandomActivities } = useActivities();
		fetchRandomActivities(1).then((res) => {
			if (res.success && res.data && !('message' in res.data)) {
				const activity = res.data[0];
				if (activity) {
					router.push(`/activities/${activity.id}`);
				}
			}
		});
	}
}
</script>
