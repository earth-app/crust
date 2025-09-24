<template>
	<div class="flex flex-col">
		<ClientOnly>
			<InfoCardGroup
				v-if="user"
				title="Recommended for You"
				description="Based on your interests and activities"
				icon="mdi:book-open-page-variant"
			>
				<InfoCardSkeleton
					v-if="!recommendedLoaded"
					v-for="n in 2"
					:key="n"
					content-size="small"
				/>
				<ArticleCard
					v-for="article in recommendedArticles"
					:key="article.id"
					:article="article"
				/>
			</InfoCardGroup>
			<InfoCardGroup
				title="Explore Articles"
				description="Discover new and interesting reads"
				icon="mdi:compass"
			>
				<InfoCardSkeleton
					v-if="!randomLoaded"
					v-for="n in 3"
					:key="n"
					content-size="small"
				/>
				<ArticleCard
					v-for="article in randomArticles"
					:key="article.id"
					:article="article"
				/>
			</InfoCardGroup>
		</ClientOnly>
	</div>
</template>

<script setup lang="ts">
import { getRandomArticles, getRecommendedArticles } from '~/compostables/useArticle';
import { useAuth } from '~/compostables/useUser';
import type { Article } from '~/shared/types/article';

const { user } = useAuth();

const recommendedLoaded = ref(false);
const recommendedArticles = ref<Article[]>([]);

const randomLoaded = ref(false);
const randomArticles = ref<Article[]>([]);

onMounted(async () => {
	if (user.value) {
		const res = await getRecommendedArticles(user.value);
		if (res.success && res.data) {
			recommendedArticles.value = res.data;
			recommendedLoaded.value = true;
		} else {
			console.error('Failed to load recommended articles:', res.message);
			recommendedLoaded.value = true;

			const toast = useToast();
			toast.add({
				title: 'Error',
				icon: 'mdi:alert-circle',
				description: res.message || 'Failed to load recommended articles.',
				color: 'error'
			});
		}
	}

	const randomRes = await getRandomArticles(5);
	if (randomRes.success && randomRes.data) {
		randomArticles.value = randomRes.data;
		randomLoaded.value = true;
	} else {
		randomLoaded.value = true;
		randomArticles.value = [];

		console.error('Failed to load random articles:', randomRes.message);
		const toast = useToast();

		toast.add({
			title: 'Error',
			icon: 'mdi:alert-circle',
			description: randomRes.message || 'Failed to load random articles.',
			color: 'error'
		});
	}
});
</script>
