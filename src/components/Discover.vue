<template>
	<UModal v-model:open="open">
		<UButton
			label="Discover"
			color="neutral"
			icon="mdi:compass"
			variant="outline"
			class="w-full"
		/>

		<template #content>
			<UCommandPalette
				v-model:search-term="search"
				close
				:loading="loading"
				:groups="filteredGroups"
				@update:open="open = $event"
				:ui="{ itemDescription: 'text-[10px]' }"
			/>
		</template>
	</UModal>
</template>

<script setup lang="ts">
import type { CommandPaletteGroup, CommandPaletteItem } from '#ui/types';
import { getUserDisplayName } from '~/shared/util';

const { user } = useAuth();
const router = useRouter();
const open = ref(false);

const users = ref<CommandPaletteItem[]>([]);
const usersLoading = ref(false);
const activities = ref<CommandPaletteItem[]>([]);
const activitiesLoading = ref(false);
const prompts = ref<CommandPaletteItem[]>([]);
const promptsLoading = ref(false);
const articles = ref<CommandPaletteItem[]>([]);
const articlesLoading = ref(false);

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

watch(search, (newSearch: string) => populate(newSearch), { immediate: true });
onMounted(() => populate(''));

function populate(searchTerm: string) {
	const empty = searchTerm.length === 0;
	const sort = empty ? 'rand' : 'desc';

	// populate users
	usersLoading.value = true;
	getUsers(empty ? 5 : 150, searchTerm, sort).then((res) => {
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
			}));

			groups.value = groups.value.map((group) =>
				group.id === 'users' ? { ...group, items: users.value } : group
			);
		} else {
			users.value = [];
		}

		usersLoading.value = false;
	});

	// populate activities
	activitiesLoading.value = true;
	getAllActivities(empty ? 5 : 150, searchTerm, sort).then((res) => {
		if (res.success && res.data) {
			const items = res.data;
			activities.value = items.map((activity) => ({
				id: `activity-${activity.id}`,
				label: activity.name,
				description: activity.description,
				icon: activity.fields['icon'] || 'mdi:earth',
				to: `/activities/${activity.id}`,
				onSelect: close
			}));

			groups.value = groups.value.map((group) =>
				group.id === 'activities' ? { ...group, items: activities.value } : group
			);
		} else {
			activities.value = [];
		}

		activitiesLoading.value = false;
	});

	// populate prompts
	promptsLoading.value = true;
	getPrompts(empty ? 5 : 25, searchTerm, sort).then((res) => {
		if (res.success && res.data) {
			const items = res.data;
			prompts.value = items.map((prompt) => {
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
			});

			groups.value = groups.value.map((group) =>
				group.id === 'prompts' ? { ...group, items: prompts.value } : group
			);
		} else {
			prompts.value = [];
		}

		promptsLoading.value = false;
	});

	// populate articles
	articlesLoading.value = true;
	getArticles(empty ? 5 : 25, searchTerm, sort).then((res) => {
		if (res.success && res.data) {
			const items = res.data;
			articles.value = items.map((article) => {
				const owner = article.author;
				const type = owner.account.account_type;
				const isChipShown = owner.is_admin || type === 'ORGANIZER';

				return {
					id: `article-${article.id}`,
					label: article.title,
					description: `by ${getUserDisplayName(owner)} • ${article.tags
						.slice(0, 3)
						.map((tag) => `#${tag}`)
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
			});

			groups.value = groups.value.map((group) =>
				group.id === 'articles' ? { ...group, items: articles.value } : group
			);
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
		getRandomPrompts(1).then((res) => {
			if (res.success && res.data && !('message' in res.data)) {
				const prompt = res.data[0];
				if (prompt) {
					router.push(`/prompts/${prompt.id}`);
				}
			}
		});
	} else if (choice === 1) {
		// Random Article
		getRandomArticles(1).then((res) => {
			if (res.success && res.data && !('message' in res.data)) {
				const article = res.data[0];
				if (article) {
					router.push(`/articles/${article.id}`);
				}
			}
		});
	} else {
		// Random Activity
		getRandomActivities(1).then((res) => {
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
