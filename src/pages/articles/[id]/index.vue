<template>
	<div
		v-if="article && !('error' in article) && article.author"
		class="flex flex-col items-center w-full h-full pt-12 sm:pt-0"
	>
		<ContentTTLNotice
			v-if="articleExpiresAt"
			kind="article"
			variant="countdown"
			:expires-at="articleExpiresAt"
			class="w-full max-w-3xl px-4 mt-4"
		/>
		<ArticlePage :article="article" />
		<USeparator
			v-if="user"
			class="my-2 w-3/4"
		/>

		<div
			v-if="user"
			class="flex items-center w-screen"
		>
			<LazyInfoCardGroup
				title="Related Articles"
				description="Articles similar to this one"
				icon="mdi:book-multiple-variant"
				hydrate-on-visible
			>
				<LazyArticleCard
					v-for="similarArticle in related.items"
					:key="similarArticle.id"
					:article="similarArticle"
					class="motion-preset-fade-md"
					hydrate-on-visible
				/>
				<InfoCardSkeleton
					v-for="n in related.remaining"
					:key="`related-skel-${n}`"
				/>
			</LazyInfoCardGroup>
		</div>
	</div>
	<div
		v-else-if="article === null"
		class="flex w-full h-full items-center justify-center text-center"
	>
		<p>Article not found.</p>
	</div>
	<Loading v-else />
</template>

<script setup lang="ts">
import { defineArticle } from 'nuxt-schema-org/schema';
import { computeContentExpiry } from 'utils';

const toast = useToast();
const route = useRoute();
const { user, tapCurrentJourney } = useAuth();
const { setTitleSuffix } = useTitleSuffix();
const { article, fetch } = useArticle(route.params.id as string);

const related = useIncrementalList<Article>({
	staggerMs: 120,
	initialExpectedCount: 3
});

const similarLoadedFor = ref<string | null>(null);
const journeyTrackedArticleId = ref<string | null>(null);
const journeyTrackingArticleId = ref<string | null>(null);

const articleExpiresAt = computed(() => {
	const a = article.value;
	if (!a || 'error' in (a as any) || !a.created_at) return null;
	const createdSec = Math.floor(Date.parse(a.created_at) / 1000);
	if (!Number.isFinite(createdSec)) return null;
	return computeContentExpiry('article', createdSec);
});

onMounted(() => {
	if (!article.value) fetch();
});

watch(
	() => article.value,
	(a) => {
		if (a && !('error' in (a as any)) && 'title' in a) {
			setTitleSuffix(a.title);
		} else {
			setTitleSuffix('Article');
			related.reset(3);
			similarLoadedFor.value = null;
		}
	},
	{ immediate: true }
);

watch(
	[() => article.value, () => user.value] as const,
	([a, u]) => {
		if (
			a &&
			!('error' in (a as any)) &&
			u &&
			similarLoadedFor.value !== a.id &&
			!related.isLoading
		) {
			loadSimilar(a);
		}
	},
	{ immediate: true }
);

watch(
	[() => article.value, () => user.value] as const,
	async ([currentArticle, currentUser]) => {
		if (!currentArticle || !currentUser || 'error' in (currentArticle as any)) return;

		const articleId = currentArticle.id;
		if (
			journeyTrackedArticleId.value === articleId ||
			journeyTrackingArticleId.value === articleId
		) {
			return;
		}

		journeyTrackingArticleId.value = articleId;
		try {
			const res = await tapCurrentJourney('article');
			if (!valid(res)) return;

			journeyTrackedArticleId.value = articleId;
			if (!res.data.incremented) return;

			const journeyCount = res.data.count > 0 ? res.data.count : null;

			toast.add({
				title: 'Journey Updated',
				description: journeyCount
					? `You have now read ${journeyCount} articles on your journey streak. Keep going!`
					: 'Your article journey has been updated. Keep going!',
				icon: 'game-icons:horizon-road',
				color: 'success',
				duration: 5000
			});
		} finally {
			if (journeyTrackingArticleId.value === articleId) {
				journeyTrackingArticleId.value = null;
			}
		}
	},
	{ immediate: true }
);

useSeoMeta({
	ogTitle: article.value ? article.value.title : 'Article',
	ogDescription: article.value ? article.value.description : 'Article'
});

// JSON-LD Article schema for richer search-engine previews
useSchemaOrg(() => {
	const a = article.value;
	if (!a || 'error' in (a as any)) return [];
	return [
		defineArticle({
			'@type': 'Article',
			headline: a.title,
			description: a.description,
			datePublished: a.created_at,
			...(a.updated_at ? { dateModified: a.updated_at } : {}),
			...(a.author?.username ? { author: { '@type': 'Person', name: a.author.username } } : {})
		})
	];
});

async function loadSimilar(article?: Article) {
	if (!article) return;
	if (!user.value) return;
	if (related.isLoading) return;
	if (similarLoadedFor.value === article.id) return;

	similarLoadedFor.value = article.id;

	await related.load(async () => {
		const { fetchSimilar } = useArticle(article.id);
		const res = await fetchSimilar();
		if (valid(res)) {
			return res.data;
		}
		console.error('Failed to load similar articles:', res.message);
		toast.add({
			title: 'Error',
			icon: 'mdi:alert-circle',
			description: res.message || 'Failed to load similar articles.',
			color: 'error'
		});
		similarLoadedFor.value = null;
		return null;
	});
}

// articles read time tracking

const { startTimer, stopTimer } = useTimeOnPage('articles_read_time', {
	article: article.value,
	user: user.value
});

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
