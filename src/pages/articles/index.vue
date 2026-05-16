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
			<LazyArticleCard
				v-for="article in recommendedArticles"
				:key="article.id"
				:article="article"
				hydrate-on-visible
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
			<LazyArticleCard
				v-for="article in randomArticles"
				:key="article.id"
				:article="article"
				hydrate-on-visible
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
			<LazyArticleCard
				v-for="article in recentArticles"
				:key="article.id"
				:article="article"
				hydrate-on-visible
			/>
		</InfoCardGroup>
		<InfoCardGroup
			title="Older Articles"
			description="Explore the archives"
			icon="mdi:archive"
		>
			<InfoCardSkeleton
				v-if="!olderLoaded"
				v-for="n in 2"
				:key="n"
				content-size="small"
			/>
			<LazyArticleCard
				v-for="article in olderArticles"
				:key="article.id"
				:article="article"
				hydrate-on-visible
			/>
		</InfoCardGroup>
		<InfoCardGroup
			title="By Cloud"
			description="Articles from the automaton himself"
			icon="mdi:cloud"
		>
			<InfoCardSkeleton
				v-if="!byCloudLoaded"
				v-for="n in 2"
				:key="n"
				content-size="small"
			/>
			<LazyArticleCard
				v-for="article in byCloudArticles"
				:key="article.id"
				:article="article"
				hydrate-on-visible
			/>
		</InfoCardGroup>
		<LazyInfoCardGroup
			v-for="tag in byTagLoaded.keys()"
			:key="tag"
			:title="`${capitalizeFully(tag.replace(/_/g, ' '))} Articles`"
			:description="`Explore articles related to the ${tag.replace(/_/g, ' ').toLowerCase()} tag`"
			icon="mdi:tag"
		>
			<LazyInfoCardSkeleton
				v-if="!byTagLoaded.get(tag)"
				v-for="n in 2"
				:key="n"
				content-size="small"
				hydrate-on-visible
			/>
			<LazyArticleCard
				v-for="article in byTagArticles.get(tag) || []"
				:key="article.id"
				:article="article"
				hydrate-on-visible
			/>
		</LazyInfoCardGroup>
	</div>
</template>

<script setup lang="ts">
import { com } from '@earth-app/ocean';

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

const olderLoaded = ref(false);
const olderArticles = ref<Article[]>([]);

const byCloudLoaded = ref(false);
const byCloudArticles = ref<Article[]>([]);

const byTagLoaded = reactive(new Map<string, boolean>());
const byTagArticles = reactive(new Map<string, Article[]>());

const loading = computed(() => {
	const loaded = !randomLoaded.value || !recentLoaded.value;
	if (!user.value) {
		return loaded;
	}

	return !recommendedLoaded.value || loaded;
});

function loadRecommended() {
	if (recommendedArticles.value.length > 0) return;

	if (user.value) {
		const { fetchRecommended } = useArticles();
		fetchRecommended(10).then((recommendedRes) => {
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
		});
	} else {
		recommendedLoaded.value = true;
	}
}

async function loadContent() {
	// reset states
	recommendedLoaded.value = false;
	recommendedArticles.value = [];
	loadRecommended();

	randomLoaded.value = false;
	randomArticles.value = [];
	recentLoaded.value = false;
	recentArticles.value = [];
	olderLoaded.value = false;
	olderArticles.value = [];
	byCloudLoaded.value = false;
	byCloudArticles.value = [];
	byTagLoaded.clear();
	byTagArticles.clear();

	const { fetchRandom, fetchRecent, fetchOldest } = useArticles();
	fetchRandom(15).then((res) => {
		if (valid(res)) {
			randomArticles.value = res.data;
			randomLoaded.value = true;
		} else {
			randomLoaded.value = true;
			randomArticles.value = [];

			console.error('Failed to load random articles:', res.message);

			toast.add({
				title: 'Error',
				icon: 'mdi:alert-circle',
				description: res.message || 'Failed to load random articles.',
				color: 'error'
			});
		}
	});

	fetchRecent(15).then((res) => {
		if (valid(res)) {
			recentArticles.value = res.data.items;
			recentLoaded.value = true;
		} else {
			console.error('Failed to load recent articles:', res.message);
			recentLoaded.value = true;

			toast.add({
				title: 'Error',
				icon: 'mdi:alert-circle',
				description: res.message || 'Failed to load recent articles.',
				color: 'error'
			});
		}
	});

	fetchOldest(15).then((res) => {
		if (valid(res)) {
			olderArticles.value = res.data.items;
			olderLoaded.value = true;
		} else {
			console.error('Failed to load older articles:', res.message);
			olderLoaded.value = true;

			toast.add({
				title: 'Error',
				icon: 'mdi:alert-circle',
				description: res.message || 'Failed to load older articles.',
				color: 'error'
			});
		}
	});

	fetchRandom(15, '1').then((res) => {
		if (valid(res)) {
			byCloudArticles.value = res.data;
			byCloudLoaded.value = true;
		} else {
			console.error('Failed to load By Cloud articles:', res.message);
			byCloudLoaded.value = true;

			toast.add({
				title: 'Error',
				icon: 'mdi:alert-circle',
				description: res.message || 'Failed to load By Cloud articles.',
				color: 'error'
			});
		}
	});

	const randomTypes = com.earthapp.activity.ActivityType.values().sort(
		(a, b) => Math.random() - 0.5
	);
	for (const type of randomTypes) {
		const tag = type.name.toLowerCase();
		fetchRandom(15, undefined, tag).then((res) => {
			if (valid(res)) {
				byTagArticles.set(tag, res.data);
				byTagLoaded.set(tag, true);
			} else {
				console.error(`Failed to load articles for tag ${tag}:`, res.message);
				byTagLoaded.set(tag, true);
				byTagArticles.set(tag, []);

				toast.add({
					title: 'Error',
					icon: 'mdi:alert-circle',
					description: res.message || `Failed to load articles for tag ${tag}.`,
					color: 'error'
				});
			}
		});
	}
}

onMounted(async () => {
	await loadContent();
});

watch(
	user,
	(newUser, oldUser) => {
		if (newUser?.id !== oldUser?.id) {
			loadRecommended();
		}
	},
	{ immediate: false }
);
</script>
