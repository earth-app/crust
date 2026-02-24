<template>
	<UCard class="p-4">
		<h2 class="text-2xl font-bold mb-4">
			{{ mode === 'create' ? 'Create New Article' : 'Edit Article' }}
		</h2>
		<UForm
			:state="state"
			class="space-y-2"
			@submit="handleSubmit"
			:schema="articleSchema"
		>
			<UFormField
				label="Title"
				name="title"
				:required="true"
			>
				<UInput
					v-model="state.title"
					placeholder="The Wonderful World of Pizzas"
					class="w-full"
				/>
			</UFormField>

			<UFormField
				label="Description"
				name="description"
				:required="true"
			>
				<UInput
					v-model="state.description"
					placeholder="Pizzas are great because..."
					class="w-full"
				/>
			</UFormField>

			<UFormField
				label="Content"
				name="content"
				:required="true"
			>
				<UTextarea
					v-model="state.content"
					placeholder="The first reason pizzas are great is because they are delicious and..."
					class="w-full"
				/>
			</UFormField>

			<UFormField
				label="Color"
				name="color_hex"
				help="The theme color for the article"
			>
				<div class="flex items-center">
					<UInput
						v-model="state.color_hex"
						placeholder="#ffffff"
						class="mr-4"
						:disabled="loading"
					/>
					<input
						type="color"
						v-model="state.color_hex"
						class="h-10 w-20 rounded border cursor-pointer"
						:disabled="loading"
					/>
				</div>
			</UFormField>

			<UFormField
				label="Tags"
				name="tags"
				help="Additional tags that label your article. Max 10 allowed"
			>
				<div class="space-y-2">
					<div class="flex gap-2">
						<UInput
							v-model="tagInput"
							:placeholder="state.tags.length < 10 ? 'Add a Tag' : 'Tag limit reached'"
							:disabled="loading || state.tags.length >= 10"
							@keypress.enter.prevent="addTag"
						/>
						<UButton
							:icon="state.tags.length < 10 ? 'mdi:tag-plus' : 'mdi:tag-off'"
							color="info"
							variant="outline"
							:disabled="loading || !tagInput.trim() || state.tags.length >= 10"
							@click="addTag"
						>
							Add
						</UButton>
					</div>
					<div
						v-if="state.tags.length > 0"
						class="flex flex-wrap gap-2"
					>
						<UBadge
							v-for="(tag, index) in state.tags"
							:key="index"
							color="primary"
							variant="subtle"
							class="cursor-pointer"
							@click="removeTag(index)"
						>
							{{ tag }}
							<UIcon
								name="mdi:close"
								class="ml-1"
							/>
						</UBadge>
					</div>
				</div>
			</UFormField>

			<UButton
				type="submit"
				:loading="loading"
				color="success"
				class="mt-4"
				:icon="mode === 'create' ? 'mdi:pen-plus' : 'mdi:pen'"
			>
				{{ mode === 'create' ? 'Create Article' : 'Save Changes' }}
			</UButton>
		</UForm>
	</UCard>
</template>

<script setup lang="ts">
import type { Article } from '~/shared/types/article';
import { articleSchema } from '~/shared/utils/schemas';

const props = defineProps<{
	article?: Article;
	mode: 'create' | 'edit';
}>();

const toast = useToast();
const router = useRouter();
const loading = ref(false);

const state = reactive<
	Omit<Article, 'id' | 'ocean' | 'created_at' | 'updated_at' | 'author' | 'author_id'>
>({
	title: props.article?.title || '',
	description: props.article?.description || '',
	content: props.article?.content || '',
	tags: props.article?.tags || [],
	color: props.article?.color || 0xffffff,
	color_hex: props.article?.color_hex || '#ffffff'
});

// link color_hex and color
watch(
	() => state.color_hex,
	(newHex) => {
		state.color = parseInt(newHex.replace('#', ''), 16);
	}
);

const tagInput = ref('');
const addTag = () => {
	const tag = tagInput.value.trim();
	if (tag && !state.tags.includes(tag)) {
		state.tags.push(tag);
		tagInput.value = '';
	}
};

const removeTag = (index: number) => {
	state.tags.splice(index, 1);
};

async function handleSubmit() {
	loading.value = true;
	if (props.mode === 'create') {
		const articleStore = useArticleStore();
		const res = await articleStore.createArticle({
			title: state.title,
			description: state.description,
			content: state.content
		});

		if (res.success && res.data) {
			if ('message' in res.data) {
				toast.add({
					title: 'Error',
					description: res.data.message,
					duration: 5000,
					icon: 'mdi:information',
					color: 'info'
				});
				loading.value = false;
				return;
			}

			toast.add({
				title: 'Article Created',
				description: 'Your article has been created successfully.',
				duration: 3000,
				icon: 'mdi:pen-plus',
				color: 'success'
			});

			router.push(`/articles/${res.data.id}`);
		} else {
			toast.add({
				title: 'Error',
				description: res.message || 'Failed to create article.',
				duration: 5000,
				icon: 'mdi:alert-circle',
				color: 'error'
			});
		}
	} else {
		const articleStore = useArticleStore();
		const res = await articleStore.updateArticle({
			id: props.article!.id,
			title: state.title,
			description: state.description,
			content: state.content
		});

		if (res.success && res.data) {
			if ('message' in res.data) {
				toast.add({
					title: 'Error',
					description: res.data.message,
					duration: 5000,
					icon: 'mdi:information',
					color: 'info'
				});
				loading.value = false;
				return;
			}

			toast.add({
				title: 'Article Updated',
				description: 'Your article has been updated successfully.',
				duration: 3000,
				icon: 'mdi:content-save',
				color: 'success'
			});

			router.push(`/articles/${res.data.id}`);
		} else {
			toast.add({
				title: 'Error',
				description: res.message || 'Failed to update article.',
				duration: 5000,
				icon: 'mdi:alert-circle',
				color: 'error'
			});
		}
	}

	loading.value = false;
}
</script>
