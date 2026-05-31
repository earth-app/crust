<template>
	<div class="flex flex-col pt-20 sm:pt-0">
		<div
			id="articles-toolbar"
			class="flex justify-center mt-2 gap-x-2"
		>
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
			<UButton
				icon="mdi:progress-question"
				color="secondary"
				variant="subtle"
				class="mt-2"
				@click="startTour('articles-index')"
			/>
		</div>
		<InfoCardGroup
			v-if="user"
			title="Recommended for You"
			description="Based on your interests and activities"
			icon="mdi:book-open-page-variant"
			special
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
		<div ref="recentSentinel">
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
		</div>
		<div ref="olderSentinel">
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
		</div>
		<div ref="byCloudSentinel">
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
		</div>
		<LazyArticleTagGroup
			v-for="tag in tagOrder"
			:key="tag"
			:tag="tag"
			hydrate-on-visible
		/>
	</div>

	<ClientOnly>
		<SiteTour
			:steps="articlesIndexTour"
			name="Articles Index Tour"
			tour-id="articles-index"
		/>
	</ClientOnly>
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

const recentSentinel = ref<HTMLElement | null>(null);
const olderSentinel = ref<HTMLElement | null>(null);
const byCloudSentinel = ref<HTMLElement | null>(null);

const loadedRecent = ref(false);
const loadedOlder = ref(false);
const loadedByCloud = ref(false);

function loadRecent() {
	if (loadedRecent.value) return;
	loadedRecent.value = true;
	const { fetchRecent } = useArticles();
	void recent.load(async () => {
		const res = await fetchRecent(15);
		if (valid(res)) return res.data.items;
		reportError('recent articles', res.message);
		return null;
	});
}

function loadOlder() {
	if (loadedOlder.value) return;
	loadedOlder.value = true;
	const { fetchOldest } = useArticles();
	void older.load(async () => {
		const res = await fetchOldest(15);
		if (valid(res)) return res.data.items;
		reportError('older articles', res.message);
		return null;
	});
}

function loadByCloud() {
	if (loadedByCloud.value) return;
	loadedByCloud.value = true;
	const { fetchRandom } = useArticles();
	void byCloud.load(async () => {
		const res = await fetchRandom(15, '1');
		if (valid(res)) return res.data;
		reportError('By Cloud articles', res.message);
		return null;
	});
}

async function loadContent() {
	const { fetchRandom } = useArticles();

	recommended.reset(user.value ? 2 : 0);
	random.reset(3);
	recent.reset(2);
	older.reset(2);
	byCloud.reset(2);

	loadedRecent.value = false;
	loadedOlder.value = false;
	loadedByCloud.value = false;

	void loadRecommended();

	void random.load(async () => {
		const res = await fetchRandom(15);
		if (valid(res)) return res.data;
		reportError('random articles', res.message);
		return null;
	});

	tagOrder.value = com.earthapp.activity.ActivityType.values()
		.map((type) => type.name.toLowerCase())
		.sort(() => Math.random() - 0.5);
}

onMounted(async () => {
	await loadContent();
});

if (import.meta.client) {
	const observe = (target: Ref<HTMLElement | null>, load: () => void) => {
		const { stop } = useIntersectionObserver(
			target,
			(entries) => {
				if (entries[0]?.isIntersecting) {
					stop();
					load();
				}
			},
			{ rootMargin: '300px' }
		);
	};

	onMounted(() => {
		observe(recentSentinel, loadRecent);
		observe(olderSentinel, loadOlder);
		observe(byCloudSentinel, loadByCloud);
	});
}

watch(
	user,
	(newUser, oldUser) => {
		if (newUser?.id !== oldUser?.id) {
			loadRecommended();
		}
	},
	{ immediate: false }
);

const { startTour } = useSiteTour();

const articlesIndexTour: SiteTourStep[] = [
	{
		id: 'articles-toolbar',
		title: 'Articles Library',
		description:
			'Refresh to shuffle in a fresh batch. The plus button creates a new article if your account tier allows it (Organizer and above).',
		footer: 'You always get a fresh mix when you reload.',
		icon: 'mdi:book-multiple-outline',
		highlightPadding: 8
	},
	{
		id: 'articles',
		title: 'Curated Sections',
		description:
			'Articles are grouped to help you find something: Recommended (based on your activities), Explore (random discovery), Recent (latest publishes), Older (archive dives), By Cloud (AI-summarized papers), and per-tag collections lower down.',
		footer: 'Logged-in users get personalized "Recommended for You" at the top.',
		icon: 'mdi:format-list-bulleted-type',
		highlightPadding: 12,
		waitFor: 'articles',
		waitTimeout: 3000
	}
];
</script>
