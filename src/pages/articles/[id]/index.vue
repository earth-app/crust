<template>
	<ClientOnly>
		<div
			v-if="currentArticle"
			class="flex flex-col items-center w-full h-full"
		>
			<ArticlePage :article="currentArticle" />
			<USeparator class="my-2 w-3/4" />

			<div class="flex items-center w-screen">
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
			v-else
			class="flex w-full h-full items-center justify-center text-center"
		>
			<p>Article not found.</p>
		</div>
	</ClientOnly>
</template>

<script setup lang="ts">
import { getArticle, getSimilarArticles } from '~/compostables/useArticle';
import { useTitleSuffix } from '~/compostables/useTitleSuffix';
import type { Article } from '~/shared/types/article';

const { setTitleSuffix } = useTitleSuffix();
const route = useRoute();
const currentArticle = ref<Article | null>(null);

const relatedLoaded = ref(false);
const relatedArticles = ref<Article[]>([]);

if (route.params.id) {
	const res = await getArticle(route.params.id as string);

	if (res.success && res.data) {
		currentArticle.value = res.data;
		loadSimilar(currentArticle.value);
		setTitleSuffix(`Article | ${currentArticle.value.title}`);
	} else {
		currentArticle.value = null;
		setTitleSuffix('Article');
	}
}

async function loadSimilar(article?: Article) {
	if (!article) return;
	relatedLoaded.value = false;

	const res = await getSimilarArticles(article);
	if (res.success && res.data) {
		relatedArticles.value = res.data;
		relatedLoaded.value = true;
		console.log('Related articles loaded:', relatedArticles.value);
	} else {
		console.error('Failed to load similar articles:', res.message);
		relatedLoaded.value = true;

		const toast = useToast();
		toast.add({
			title: 'Error',
			icon: 'mdi:alert-circle',
			description: res.message || 'Failed to load similar articles.',
			color: 'error'
		});
	}
}
</script>
