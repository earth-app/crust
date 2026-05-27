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
			<LazyArticleCard
				v-for="article in recommended.items"
				:key="article.id"
				:article="article"
				class="motion-preset-fade-md"
				hydrate-on-visible
			/>
			<InfoCardSkeleton
				v-for="n in recommended.remaining"
				:key="`recommended-skel-${n}`"
				content-size="small"
			/>
		</InfoCardGroup>
		<InfoCardGroup
			title="Explore Articles"
			description="Discover new and interesting reads"
			icon="mdi:compass"
			id="articles"
		>
			<LazyArticleCard
				v-for="article in random.items"
				:key="article.id"
				:article="article"
				class="motion-preset-fade-md"
				hydrate-on-visible
			/>
			<InfoCardSkeleton
				v-for="n in random.remaining"
				:key="`random-skel-${n}`"
				content-size="small"
			/>
		</InfoCardGroup>
		<InfoCardGroup
			title="Recent Articles"
			description="Latest articles from the community"
			icon="mdi:history"
		>
			<LazyArticleCard
				v-for="article in recent.items"
				:key="article.id"
				:article="article"
				class="motion-preset-fade-md"
				hydrate-on-visible
			/>
			<InfoCardSkeleton
				v-for="n in recent.remaining"
				:key="`recent-skel-${n}`"
				content-size="small"
			/>
		</InfoCardGroup>
		<InfoCardGroup
			title="Older Articles"
			description="Explore the archives"
			icon="mdi:archive"
		>
			<LazyArticleCard
				v-for="article in older.items"
				:key="article.id"
				:article="article"
				class="motion-preset-fade-md"
				hydrate-on-visible
			/>
			<InfoCardSkeleton
				v-for="n in older.remaining"
				:key="`older-skel-${n}`"
				content-size="small"
			/>
		</InfoCardGroup>
		<InfoCardGroup
			title="By Cloud"
			description="Articles from the automaton himself"
			icon="mdi:cloud"
		>
			<LazyArticleCard
				v-for="article in byCloud.items"
				:key="article.id"
				:article="article"
				class="motion-preset-fade-md"
				hydrate-on-visible
			/>
			<InfoCardSkeleton
				v-for="n in byCloud.remaining"
				:key="`byCloud-skel-${n}`"
				content-size="small"
			/>
		</InfoCardGroup>
		<ArticleTagGroup
			v-for="tag in tagOrder"
			:key="tag"
			:tag="tag"
		/>
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

const recommended = useIncrementalList<Article>({ staggerMs: 80, initialExpectedCount: 2 });
const random = useIncrementalList<Article>({ staggerMs: 80, initialExpectedCount: 3 });
const recent = useIncrementalList<Article>({ staggerMs: 80, initialExpectedCount: 2 });
const older = useIncrementalList<Article>({ staggerMs: 80, initialExpectedCount: 2 });
const byCloud = useIncrementalList<Article>({ staggerMs: 80, initialExpectedCount: 2 });

const tagOrder = ref<string[]>([]);

const loading = computed(() => {
	const loaded = random.isLoading || recent.isLoading;
	if (!user.value) return loaded;
	return recommended.isLoading || loaded;
});

async function loadRecommended() {
	if (recommended.items.length > 0) return;
	if (!user.value) {
		recommended.reset(0);
		return;
	}

	await recommended.load(async () => {
		const { fetchRecommended } = useArticles();
		const res = await fetchRecommended(10);
		if (res.success && res.data) {
			return res.data;
		}
		console.error('Failed to load recommended articles:', res.message);
		toast.add({
			title: 'Error',
			icon: 'mdi:alert-circle',
			description: res.message || 'Failed to load recommended articles.',
			color: 'error'
		});
		return null;
	});
}

function reportError(label: string, message?: string) {
	console.error(`Failed to load ${label}:`, message);
	toast.add({
		title: 'Error',
		icon: 'mdi:alert-circle',
		description: message || `Failed to load ${label}.`,
		color: 'error'
	});
}

async function loadContent() {
	const { fetchRandom, fetchRecent, fetchOldest } = useArticles();

	recommended.reset(user.value ? 2 : 0);
	random.reset(3);
	recent.reset(2);
	older.reset(2);
	byCloud.reset(2);

	void loadRecommended();

	void random.load(async () => {
		const res = await fetchRandom(15);
		if (valid(res)) return res.data;
		reportError('random articles', res.message);
		return null;
	});

	void recent.load(async () => {
		const res = await fetchRecent(15);
		if (valid(res)) return res.data.items;
		reportError('recent articles', res.message);
		return null;
	});

	void older.load(async () => {
		const res = await fetchOldest(15);
		if (valid(res)) return res.data.items;
		reportError('older articles', res.message);
		return null;
	});

	void byCloud.load(async () => {
		const res = await fetchRandom(15, '1');
		if (valid(res)) return res.data;
		reportError('By Cloud articles', res.message);
		return null;
	});

	tagOrder.value = com.earthapp.activity.ActivityType.values()
		.map((type) => type.name.toLowerCase())
		.sort(() => Math.random() - 0.5);
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
