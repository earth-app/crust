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

const { avatar128: authorAvatar } = useUser(props.article.author_id);

const authorAvatarChipColor = ref<any | null>(null);

const i18n = useI18n();
const time = computed(() => {
	if (!props.article.created_at) return 'sometime';
	const created = DateTime.fromISO(props.article.created_at, {
		zone: Intl.DateTimeFormat().resolvedOptions().timeZone
	});

	return created.setLocale(i18n.locale.value).toLocaleString(DateTime.DATETIME_MED);
});

onMounted(async () => {
	switch (props.article.author.account.account_type) {
		case 'WRITER':
			authorAvatarChipColor.value = 'primary';
			break;
		case 'ORGANIZER':
			authorAvatarChipColor.value = 'warning';
			break;
		case 'ADMINISTRATOR':
			authorAvatarChipColor.value = 'error';
			break;
	}

	footer.value = `@${props.article.author.username} - ${time.value}`;
});
</script>
