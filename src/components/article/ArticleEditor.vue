<template>
	<UModal
		v-model:open="isOpen"
		close
	>
		<slot />

		<template #title>
			<div class="flex">
				<UAvatar
					:src="avatar32"
					class="mr-2"
				/>
				<span>{{ mode === 'create' ? 'Create New Article' : 'Edit Article' }}</span>
			</div>
		</template>

		<template #content>
			<ArticleForm
				:mode="mode"
				:article="article"
				@submitted="isOpen = false"
			/>
		</template>
	</UModal>
</template>

<script setup lang="ts">
import type { Article } from '../../shared/types/article';

const props = defineProps<{
	article?: Article;
	mode: 'create' | 'edit';
}>();

const { user } = useAuth();
const { avatar32 } = useUser(props.article?.author_id || user.value?.id || '');

const isOpen = ref(false);
</script>
