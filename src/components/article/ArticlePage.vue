<template>
	<div class="flex flex-col items-center w-full px-12">
		<div class="my-8">
			<div class="flex justify-center mb-4">
				<UAvatar
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
			<USeparator class="my-2" />
		</div>
		<div class="prose min-w-67 max-w-4/7 items-center">
			<p
				v-for="(paragraph, index) in contentParagraphs"
				:key="index"
				class="mb-2"
			>
				{{ paragraph }}
			</p>
		</div>
		<h3 class="text-xs sm:text-sm text-gray-400">{{ time }}</h3>
		<div
			v-if="article.ocean"
			class="flex flex-col items-center my-8"
		>
			<h1 class="text-xl font-semibold">Cited Article</h1>
			<InfoCard
				:title="article.ocean.title"
				:avatar="article.ocean.favicon"
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
				class="my-6 w-2/3"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';
import type { Article } from '~/shared/types/article';
import { parseLooseDate, trimString } from '~/shared/util';

const props = defineProps<{
	article: Article;
}>();

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

const authorAvatar = ref<string>('https://cdn.earth-app.com/earth-app.png');
const { photo } = useUser(props.article.author_id);
watch(
	() => photo.value,
	(photo) => {
		if (photo) {
			if (authorAvatar.value && authorAvatar.value.startsWith('blob:'))
				URL.revokeObjectURL(authorAvatar.value);

			const blob = URL.createObjectURL(photo);
			authorAvatar.value = blob;
		}
	},
	{ immediate: true }
);

onBeforeUnmount(() => {
	if (authorAvatar.value && authorAvatar.value.startsWith('blob:'))
		URL.revokeObjectURL(authorAvatar.value);
});

const i18n = useI18n();
const time = computed(() => {
	if (!props.article.created_at) return 'sometime';
	const created = DateTime.fromISO(props.article.created_at, {
		zone: Intl.DateTimeFormat().resolvedOptions().timeZone
	});

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
</script>
