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
		</ClientOnly>
	</div>
</template>

<script setup lang="ts">
import type { Article } from '~/shared/types/article';

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

const loading = computed(() => {
	return !recommendedLoaded.value || !randomLoaded.value;
});

async function loadContent() {
	// reset states
	recommendedLoaded.value = false;
	recommendedArticles.value = [];
	randomLoaded.value = false;
	randomArticles.value = [];

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
		if ('message' in randomRes.data) {
			randomLoaded.value = true;
			randomArticles.value = [];
			console.error('Failed to load random articles:', randomRes.data.message);

			const toast = useToast();
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
		const toast = useToast();

		toast.add({
			title: 'Error',
			icon: 'mdi:alert-circle',
			description: randomRes.message || 'Failed to load random articles.',
			color: 'error'
		});
	}
}

onMounted(async () => {
	await loadContent();
});
</script>
