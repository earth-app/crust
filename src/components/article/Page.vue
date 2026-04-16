<template>
	<div class="flex flex-col items-center w-full px-12">
		<div class="mt-8 mb-4">
			<div class="flex justify-center mb-4">
				<UAvatar
					id="author-avatar"
					:src="authorAvatar"
					alt="Author's avatar"
					:title="`@${article.author.username}`"
					class="mb-4 w-30 h-30"
				/>
			</div>
			<h1 class="text-2xl sm:text-3xl font-bold">{{ article.title }}</h1>
			<UTooltip :text="time">
				<h2>
					by
					<NuxtLink :to="`/profile/@${article.author.username}`">
						<span class="font-semibold text-blue-500"> @{{ article.author.username }} </span>
					</NuxtLink>
				</h2>
			</UTooltip>
			<div
				id="article-tags"
				class="flex my-2"
			>
				<UBadge
					v-for="(tag, index) in article.tags"
					:id="`article-tag-${index}`"
					:key="`article-tag-${index}`"
					class="mr-2 mb-2"
					:ui="{ label: 'text-sm' }"
					variant="subtle"
					icon="mdi:tag"
					size="lg"
					color="warning"
					>{{ tag }}</UBadge
				>
			</div>
			<USeparator class="my-2" />
		</div>
		<div class="mb-4 space-x-2">
			<UButton
				v-if="hasWriteAccess"
				color="error"
				icon="mdi:delete"
				variant="subtle"
				@click="removeArticle"
				>Delete</UButton
			>

			<ArticleEditor
				v-if="hasWriteAccess"
				:article="article"
				mode="edit"
			>
				<UButton
					color="info"
					icon="mdi:pencil"
					variant="subtle"
					>Edit</UButton
				>
			</ArticleEditor>

			<UButton
				v-if="user && quiz && quiz.length > 0 && !score"
				id="quiz-button"
				color="success"
				icon="mdi:school"
				variant="subtle"
				@click="quizOpen = true"
				>Take Quiz</UButton
			>

			<UButton
				v-else-if="score"
				id="quiz-button"
				color="neutral"
				icon="mdi:check-all"
				variant="subtle"
				@click="quizOpen = true"
				>View Quiz Score</UButton
			>

			<UButton
				v-if="!quiz && user?.is_admin"
				id="quiz-button"
				color="primary"
				icon="mdi:plus"
				variant="subtle"
				@click="createQuiz"
				:loading="quizLoading"
				>Create Quiz</UButton
			>

			<UButton
				color="secondary"
				icon="mdi:progress-question"
				variant="subtle"
				@click="startTour('article-profile')"
			/>
		</div>
		<div class="mt-2 prose min-w-67 max-w-5/7 items-center">
			<p
				v-for="(paragraph, index) in contentParagraphs"
				:key="index"
				class="mb-2"
			>
				{{ paragraph }}
			</p>
		</div>
		<h3
			id="article-time"
			class="text-xs sm:text-sm text-gray-400"
		>
			{{ time }}
		</h3>
		<div
			v-if="article.ocean"
			class="flex flex-col items-center my-8"
		>
			<h1 class="text-xl font-semibold">Cited Article</h1>
			<InfoCard
				:title="article.ocean.title"
				:avatar="{ src: article.ocean.favicon }"
				:description="article.ocean.author"
				:external="true"
				:link="article.ocean.url"
				:content="
					trimString(article.ocean.content || article.ocean.abstract || 'No content provided.', 400)
				"
				:footer="oceanTime"
				:secondary-footer="article.ocean.source"
				:badges="oceanBadges"
				:color="oceanColor"
				:additional-links="oceanLinks"
				class="my-6 min-w-140 w-2/3"
			/>
		</div>
	</div>
	<UModal
		v-model:open="quizOpen"
		class="min-w-full sm:min-w-175"
		close-icon="mdi:close"
	>
		<template #header>
			<div class="flex items-center space-x-4">
				<UAvatar
					:src="authorAvatar"
					class="size-8"
				/>
				<h1 class="text-lg font-semibold">Quiz: {{ article.title }}</h1>
			</div>
		</template>
		<template #body>
			<div class="p-4 w-full">
				<ArticleQuiz
					v-if="quiz !== undefined"
					:article="article"
				/>
				<div
					v-else
					class="flex items-center justify-center h-32"
				>
					<Loading />
				</div>
			</div>
		</template>
	</UModal>

	<ClientOnly>
		<SiteTour
			:steps="articleTour"
			name="Article Tour"
			tour-id="article-profile"
		/>
	</ClientOnly>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';
import { parseLooseDate, trimString } from 'utils';

const props = defineProps<{
	article: Article;
}>();

const toast = useToast();
const router = useRouter();

const contentParagraphs = computed(() => {
	return props.article.content.split('\n').filter((p) => p.trim().length > 0);
});
const oceanBadges = computed(() => {
	return (
		props.article.ocean?.keywords
			?.slice(0, 10)
			.map((k) => ({ text: k.toLowerCase(), color: 'info' as const })) || []
	);
});
const oceanLinks = computed(() => {
	return Object.entries(props.article.ocean?.links || {}).map(([k, v]) => ({
		text: k,
		link: v,
		external: true
	}));
});

const avatarStore = useAvatarStore();
const authorAvatarUrl = computed(() => props.article.author.account?.avatar_url);
const authorAvatar = computed(() => {
	const url = authorAvatarUrl.value;
	if (!url || !url.startsWith('http')) return '/favicon.png';
	return avatarStore.get(url)?.avatar128 || '/favicon.png';
});

// Preload author avatar
if (authorAvatarUrl.value) {
	avatarStore.preloadAvatar(authorAvatarUrl.value);
}

const i18n = useI18n();
const time = computed(() => {
	if (!props.article.created_at) return 'sometime';
	const zone = import.meta.client ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';
	const created = DateTime.fromISO(props.article.created_at, { zone });

	return created.setLocale(i18n.locale.value).toLocaleString(DateTime.DATETIME_FULL);
});

const oceanTime = computed(() => {
	if (!props.article.ocean?.date) return 'sometime';
	const created = parseLooseDate(props.article.ocean.date);
	if (typeof created === 'string') return created;

	return created.setLocale(i18n.locale.value).toLocaleString(DateTime.DATE_MED_WITH_WEEKDAY);
});

const oceanColor = computed(() => {
	if (!props.article.ocean?.theme_color) return 0xffffff;
	return parseInt(props.article.ocean.theme_color.replace('#', ''), 16);
});

useHead({
	meta: [
		{
			name: 'citation_title',
			content: props.article.title
		},
		{
			name: 'citation_author',
			content: props.article.author.username
		},
		{
			name: 'citation_publication_date',
			content: props.article.created_at
				? DateTime.fromISO(props.article.created_at).toISODate()
				: undefined
		},
		{
			name: 'citation_journal_title',
			content: 'Earth App'
		},
		{
			name: 'citation_abstract',
			content: props.article.description
		}
	]
});

// Owner Actions

const { user } = useAuth();
const hasWriteAccess = computed(() => {
	if (user.value == null) return false;
	if (props.article.author_id === user.value.id) return true;

	return user.value?.is_admin;
});

async function removeArticle() {
	const yes = confirm(
		'Are you sure you want to delete this article? This action cannot be undone.'
	);

	if (yes) {
		const articleStore = useArticleStore();
		const res = await articleStore.deleteArticle(props.article.id);
		if (res.success) {
			toast.add({
				title: 'Article Deleted',
				description: 'The article has been successfully deleted.',
				icon: 'mdi:check',
				color: 'success',
				duration: 5000
			});

			refreshNuxtData(`article-${props.article.id}`);
			router.push('/articles');
		} else {
			toast.add({
				title: 'Error',
				description: res.message || 'An unknown error occurred while deleting your article.',
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 7000
			});
		}
	} else {
		toast.add({
			title: 'Cancelled',
			description: 'Article deletion has been cancelled.',
			icon: 'mdi:cancel',
			color: 'info',
			duration: 5000
		});
	}
}

// Article Quiz

const { quiz, fetchQuiz, score } = useArticle(props.article.id);
const quizOpen = ref(false);

onMounted(() => {
	fetchQuiz();
});

const quizLoading = ref(false);
async function createQuiz() {
	quizLoading.value = true;
	if (user.value?.account.account_type !== 'ADMINISTRATOR') {
		toast.add({
			title: 'Access Denied',
			description: 'Only administrators can create quizzes for articles.',
			icon: 'mdi:alert-circle',
			color: 'error',
			duration: 5000
		});
		return;
	}

	const { createQuiz } = useArticle(props.article.id);
	const res = await createQuiz();
	if (res.success && res.data) {
		toast.add({
			title: 'Quiz Created',
			description: 'The quiz has been successfully created for this article.',
			icon: 'mdi:check',
			color: 'success',
			duration: 5000
		});

		await fetchQuiz();
	} else {
		toast.add({
			title: 'Error',
			description: res.message || 'An unknown error occurred while creating the quiz.',
			icon: 'mdi:alert-circle',
			color: 'error',
			duration: 7000
		});
	}

	quizLoading.value = false;
}

// article tour

const { startTour } = useSiteTour();

const articleTour: SiteTourStep[] = [
	{
		id: 'author-avatar',
		title: 'Welcome to Articles!',
		description:
			'Articles are little bits of information where anyone can share their knowledge on unique topics. They can be about anything - from how to compost at home, to the history of a local park, to a deep dive into the science of tides.',
		footer:
			'@cloud writes articles based on scientific papers. Click next to learn more about this article.'
	},
	{
		id: 'article-tags',
		title: props.article.title,
		description: `This article is written by @${props.article.author.username}. It reads, "${props.article.description}". Click next to learn more about the article content!`,
		footer: 'Scroll down to read the article and explore!'
	},
	{
		id: 'quiz-button',
		anonymous: false,
		title: 'Test Your Knowledge!',
		description:
			'Many articles have quizzes to test your knowledge on the topic. Click this button to take the quiz and see how much you learned!',
		footer:
			'If you have already taken the quiz, you can click the button to view your score and see which questions you got right or wrong.'
	},
	{
		id: 'article-time',
		title: 'Learning More!',
		description: `This article was published on ${time.value}. If the article cites any scientific papers, you can find them linked at the bottom along with a summary of their content.`,
		footer: 'Enjoy exploring the article!'
	}
];
</script>
