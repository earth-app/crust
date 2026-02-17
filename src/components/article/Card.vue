<template>
	<div class="w-full flex items-center justify-center my-8">
		<InfoCard
			:title="article.title"
			:description="trimString(article.description, 100)"
			:content="trimString(article.content, 300)"
			:link="noLink ? undefined : `/articles/${article.id}`"
			:footer="footer"
			:color="article.color"
			:avatar="authorAvatar"
			:avatar-chip="authorAvatarChipColor ? true : false"
			:avatar-chip-color="authorAvatarChipColor"
			:secondary-avatar="article.ocean?.favicon"
			:badges="
				article.tags.map((tag) => ({
					text: tag,
					color: 'warning',
					icon: 'mdi:tag-outline',
					variant: 'subtle',
					size: 'md'
				}))
			"
			secondary-avatar-size="xs"
		/>
	</div>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';
import type { Article } from '~/shared/types/article';
import { trimString } from '~/shared/util';

const props = defineProps<{
	article: Article;
	noLink?: boolean;
}>();

const footer = ref<string | undefined>(undefined);

const avatarStore = useAvatarStore();
const userStore = useUserStore();

// Use embedded author data directly
const authorAvatarUrl = computed(() => props.article.author.account?.avatar_url);
const authorAvatar = computed(() => {
	const url = authorAvatarUrl.value;
	if (!url || !url.startsWith('http')) return '/favicon.png';
	return avatarStore.get(url)?.avatar128 || '/favicon.png';
});
const authorAvatarChipColor = computed(() => userStore.getChipColor(props.article.author));

// Preload author avatar
if (authorAvatarUrl.value) {
	avatarStore.preloadAvatar(authorAvatarUrl.value);
}

const i18n = useI18n();
const time = computed(() => {
	if (!props.article.created_at) return 'sometime';
	const created = DateTime.fromISO(props.article.created_at, {
		zone: Intl.DateTimeFormat().resolvedOptions().timeZone
	});

	return created.setLocale(i18n.locale.value).toLocaleString(DateTime.DATETIME_MED);
});

onMounted(async () => {
	footer.value = `@${props.article.author.username} - ${time.value}`;
});
</script>
