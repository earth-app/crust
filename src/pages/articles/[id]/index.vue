<template>
	<ClientOnly>
		<div
			v-if="article && !('error' in article) && article.author"
			class="flex flex-col items-center w-full h-full pt-12 sm:pt-0"
		>
			<ArticlePage :article="article" />
			<USeparator
				v-if="user"
				class="my-2 w-3/4"
			/>

			<div
				v-if="user"
				class="flex items-center w-screen"
			>
				<InfoCardGroup
					title="Related Articles"
					description="Articles similar to this one"
					icon="mdi:book-multiple-variant"
				>
					<InfoCardSkeleton
						v-if="!relatedLoaded"
						v-for="n in 3"
						:key="n"
					/>
					<ArticleCard
						v-else
						v-for="article in relatedArticles"
						:key="article.id"
						:article="article"
					/>
				</InfoCardGroup>
			</div>
		</div>
		<div
			v-else-if="article === null"
			class="flex w-full h-full items-center justify-center text-center"
		>
			<p>Article not found.</p>
		</div>
		<Loading v-else />
	</ClientOnly>
</template>

<script setup lang="ts">
import type { Article } from '~/shared/types/article';

const toast = useToast();
const route = useRoute();
const { user } = useAuth();
const { setTitleSuffix } = useTitleSuffix();
const { article } = useArticle(route.params.id as string);
const { startTimer, stopTimer } = useTimeOnPage('articles_read_time');

const relatedLoaded = ref(false);
const relatedArticles = ref<Article[]>([]);

watch(
	() => article.value,
	(article) => {
		if (article && !('error' in (article as any)) && 'title' in article) {
			setTitleSuffix(article.title);
			loadSimilar(article);
		} else {
			setTitleSuffix('Article');
			relatedLoaded.value = false;
			relatedArticles.value = [];
		}
	},
	{ immediate: true }
);
watch(
	() => user.value,
	() => {
		if (user.value && article.value) {
			loadSimilar(article.value);
		}
	}
);

useSeoMeta({
	ogTitle: article.value ? article.value.title : 'Article',
	ogDescription: article.value ? article.value.description : 'Article'
});

onMounted(async () => {
	if (!article.value || 'error' in (article.value as any)) return;
	if (user.value) {
		const count = await getCurrentJourney('article', user.value.id);
		if (!count.success || !count.data) return; // silently ignore errors
		if ('message' in count.data) return;

		const res = await tapCurrentJourney('article');
		if (!res.success || !res.data) return; // silently ignore errors
		if ('message' in res.data) return;

		if (count.data.count === res.data.count) return; // no change

		toast.add({
			title: 'Journey Updated',
			description: `You have now read ${res.data.count} articles on your journey streak. Keep going!`,
			icon: 'game-icons:horizon-road',
			color: 'success',
			duration: 5000
		});
	}
});

async function loadSimilar(article?: Article) {
	if (!article) return;
	if (!user.value) return;
	relatedLoaded.value = false;

	const res = await getSimilarArticles(article);
	if (res.success && res.data) {
		relatedArticles.value = res.data;
		relatedLoaded.value = true;
	} else {
		console.error('Failed to load similar articles:', res.message);
		relatedLoaded.value = true;

		toast.add({
			title: 'Error',
			icon: 'mdi:alert-circle',
			description: res.message || 'Failed to load similar articles.',
			color: 'error'
		});
	}
}

onMounted(() => {
	if (import.meta.client) {
		startTimer();
	}
});

onUnmounted(() => {
	if (import.meta.client) {
		stopTimer();
	}
});
</script>
