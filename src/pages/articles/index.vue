<template>
	<div class="flex flex-col pt-20 sm:pt-0">
		<div class="flex justify-center mt-2 gap-x-2">
			<UButton
				title="Refresh"
				icon="i-lucide-refresh-cw"
				color="neutral"
				variant="outline"
				:loading="loading"
				:disabled="loading"
				class="mt-2"
				@click="loadContent"
			/>
			<UTooltip
				arrow
				:text="
					newDisabled ? `Upgrade to Organizer to create articles!` : `Click to create an article`
				"
			>
				<UButton
					icon="mdi:plus"
					color="neutral"
					variant="outline"
					class="mt-2"
					:disabled="newDisabled"
					@click="$router.push('/articles/new')"
				/>
			</UTooltip>
		</div>
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
				id="articles"
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
			<InfoCardGroup
				title="Recent Articles"
				description="Latest articles from the community"
				icon="mdi:history"
			>
				<InfoCardSkeleton
					v-if="!recentLoaded"
					v-for="n in 2"
					:key="n"
					content-size="small"
				/>
				<ArticleCard
					v-for="article in recentArticles"
					:key="article.id"
					:article="article"
				/>
			</InfoCardGroup>
		</ClientOnly>
	</div>
</template>

<script setup lang="ts">
import type { Article } from '~/shared/types/article';

const toast = useToast();
const { user } = useAuth();
const newDisabled = computed(() => {
	switch (user.value?.account.account_type) {
		case 'FREE':
		case 'PRO':
		case 'WRITER':
			return true;
		default:
			return false;
	}
});

const recommendedLoaded = ref(false);
const recommendedArticles = ref<Article[]>([]);

const randomLoaded = ref(false);
const randomArticles = ref<Article[]>([]);

const recentLoaded = ref(false);
const recentArticles = ref<Article[]>([]);

const loading = computed(() => {
	const loaded = !randomLoaded.value || !recentLoaded.value;
	if (!user.value) {
		return loaded;
	}

	return !recommendedLoaded.value || loaded;
});

async function loadContent() {
	// reset states
	recommendedLoaded.value = false;
	recommendedArticles.value = [];
	randomLoaded.value = false;
	randomArticles.value = [];
	recentLoaded.value = false;
	recentArticles.value = [];

	if (user.value) {
		const recommendedRes = await getRecommendedArticles();
		if (recommendedRes.success && recommendedRes.data) {
			recommendedArticles.value = recommendedRes.data;
			recommendedLoaded.value = true;
		} else {
			console.error('Failed to load recommended articles:', recommendedRes.message);
			recommendedLoaded.value = true;

			toast.add({
				title: 'Error',
				icon: 'mdi:alert-circle',
				description: recommendedRes.message || 'Failed to load recommended articles.',
				color: 'error'
			});
		}
	} else {
		recommendedLoaded.value = true;
	}

	const randomRes = await getRandomArticles(5);
	if (randomRes.success && randomRes.data) {
		if ('message' in randomRes.data) {
			randomLoaded.value = true;
			randomArticles.value = [];
			console.error('Failed to load random articles:', randomRes.data.message);

			toast.add({
				title: 'Error',
				icon: 'mdi:alert-circle',
				description: randomRes.data.message || 'Failed to load random articles.',
				color: 'error'
			});
		} else {
			randomArticles.value = randomRes.data;
			randomLoaded.value = true;
		}
	} else {
		randomLoaded.value = true;
		randomArticles.value = [];

		console.error('Failed to load random articles:', randomRes.message);

		toast.add({
			title: 'Error',
			icon: 'mdi:alert-circle',
			description: randomRes.message || 'Failed to load random articles.',
			color: 'error'
		});
	}

	const recentRes = await getRecentArticles();
	if (recentRes.success && recentRes.data) {
		if ('message' in recentRes.data) {
			recentLoaded.value = true;
			recentArticles.value = [];
			console.error('Failed to load recent articles:', recentRes.data.message);

			toast.add({
				title: 'Error',
				icon: 'mdi:alert-circle',
				description: recentRes.data.message || 'Failed to load recent articles.',
				color: 'error'
			});
		} else {
			recentArticles.value = recentRes.data.items;
			recentLoaded.value = true;
		}
	} else {
		console.error('Failed to load recent articles:', recentRes.message);
		recentLoaded.value = true;

		toast.add({
			title: 'Error',
			icon: 'mdi:alert-circle',
			description: recentRes.message || 'Failed to load recent articles.',
			color: 'error'
		});
	}
}

onMounted(async () => {
	await loadContent();
});
</script>
