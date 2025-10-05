<template>
	<div class="w-full flex justify-center">
		<div class="relative size-48 my-28">
			<EarthCircle />
		</div>
	</div>
	<div class="w-full flex flex-col items-center justify-center">
		<h1 class="text-3xl">The Earth App</h1>
		<ClientOnly>
			<p
				v-if="!user"
				class="text-lg mt-3 motion-preset-fade-lg"
			>
				Find Your Novelty, Try New Things, Discover the World
			</p>
			<div
				v-else
				class="flex justify-center mt-3 motion-preset-fade-lg"
			>
				<UAvatar
					:src="avatar"
					class="size-8 min-w-4 h-auto mr-2"
				/>
				<p class="text-lg font-semibold">Welcome, @{{ user.username }}</p>
			</div>
			<div
				class="flex flex-col items-center justify-center w-full motion-opacity-in-0 motion-duration-1500"
			>
				<InfoCardGroup
					:title="user ? `Today's Content` : 'Discover Content'"
					:description="user ? 'Topics you might enjoy' : 'Explore interests from around the world'"
					icon="material-symbols:apps"
					class="w-11/12"
				>
					<ActivityCard
						v-for="activity in randomActivities"
						:key="activity.id"
						:activity="activity"
					/>
				</InfoCardGroup>
				<InfoCardGroup
					:title="user ? `A Fun Prompt` : 'Get Inspired'"
					description="Writing prompts to spark your creativity"
					icon="mdi:lightbulb-on-outline"
					class="w-11/12 mt-4"
				>
					<PromptCard
						v-for="prompt in randomPrompts"
						:key="prompt.id"
						:prompt="prompt"
					/>
				</InfoCardGroup>
				<InfoCardGroup
					title="A Good Read"
					description="Articles you might find interesting"
					icon="mdi:book-multiple-variant"
					class="w-11/12 mt-4"
				>
					<ArticleCard
						v-for="article in randomArticles"
						:key="article.id"
						:article="article"
					/>
				</InfoCardGroup>
			</div>
		</ClientOnly>
	</div>
</template>

<script setup lang="ts">
import { getRandomActivities } from '~/compostables/useActivity';
import { getRandomArticles } from '~/compostables/useArticle';
import { getRandomPrompts } from '~/compostables/usePrompt';
import { useAuth } from '~/compostables/useUser';
import type { Activity } from '~/shared/types/activity';
import type { Article } from '~/shared/types/article';
import type { Prompt } from '~/shared/types/prompts';

const { user, photo } = useAuth();
const avatar = ref<string>('https://cdn.earth-app.com/earth-app.png');
watch(
	() => photo.value,
	(photo) => {
		if (photo) {
			if (avatar.value && avatar.value.startsWith('blob:')) URL.revokeObjectURL(avatar.value);

			const blob = URL.createObjectURL(photo);
			avatar.value = blob;
		}
	},
	{ immediate: true }
);

onBeforeUnmount(() => {
	if (avatar.value && avatar.value.startsWith('blob:')) URL.revokeObjectURL(avatar.value);
});

const toast = useToast();
const randomPrompts = ref<Prompt[]>([]);
const randomActivities = ref<Activity[]>([]);
const randomArticles = ref<Article[]>([]);

onMounted(async () => {
	const resPrompt = await getRandomPrompts(3);
	if (resPrompt.success && resPrompt.data) {
		if ('message' in resPrompt.data) {
			randomPrompts.value = [];

			toast.add({
				title: 'Error Fetching Prompts',
				description: resPrompt.data.message || 'An unknown error occurred.',
				icon: 'mdi:alert-circle-outline',
				color: 'error',
				duration: 5000
			});
		} else {
			randomPrompts.value = resPrompt.data;
		}
	}

	const resActivities = await getRandomActivities(5);
	if (resActivities.success && resActivities.data) {
		if ('message' in resActivities.data) {
			randomActivities.value = [];

			toast.add({
				title: 'Error Fetching Activities',
				description: resActivities.data.message || 'An unknown error occurred.',
				icon: 'mdi:alert-circle-outline',
				color: 'error',
				duration: 5000
			});
		} else {
			randomActivities.value = resActivities.data;
		}
	}

	const resArticles = await getRandomArticles(4);
	if (resArticles.success && resArticles.data) {
		if ('message' in resArticles.data) {
			randomArticles.value = [];

			toast.add({
				title: 'Error Fetching Articles',
				description: resArticles.data.message || 'An unknown error occurred.',
				icon: 'mdi:alert-circle-outline',
				color: 'error',
				duration: 5000
			});
		} else {
			randomArticles.value = resArticles.data;
		}
	}
});
</script>
