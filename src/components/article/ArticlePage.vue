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
			<h2>
				by
				<NuxtLink :to="`/profile/@${article.author.username}`">
					<span class="font-semibold text-blue-500"> @{{ article.author.username }} </span>
				</NuxtLink>
				on
				<span class="font-semibold">{{ time }}</span>
			</h2>
			<USeparator class="my-2" />
		</div>
		<div class="prose min-w-67 max-w-4/7 items-center">
			<p>{{ article.content }}</p>
		</div>
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
				:badges="
					article.ocean.keywords
						?.slice(0, 10)
						.map((k) => ({ text: k.toLowerCase(), color: 'info' }))
				"
				:color="oceanColor"
				:additional-links="
					Object.entries(article.ocean.links || {}).map(([k, v]) => ({
						text: k,
						link: v,
						external: true
					}))
				"
				class="my-6 w-2/3"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';
import { useUser } from '~/compostables/useUser';
import type { Article } from '~/shared/types/article';
import { parseLooseDate, trimString } from '~/shared/util';

const props = defineProps<{
	article: Article;
}>();

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
</script>
