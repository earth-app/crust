<template>
	<UCard class="p-4">
		<h2 class="text-2xl font-bold mb-4">
			{{ mode === 'create' ? 'Create New Article' : 'Edit Article' }}
		</h2>
		<ContentTTLNotice
			v-if="mode === 'create'"
			kind="article"
			variant="banner"
			color="info"
		/>
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

			<div :class="canCreateQuiz ? 'hover:cursor-disabled' : ''">
				<h2 class="font-semibold text-lg">
					Article Quiz Editor
					<UIcon
						name="mdi:diamond-stone"
						class="ml-2 text-secondary"
					/>
				</h2>

				<UModal
					v-if="!canCreateQuiz"
					class="min-w-full min-h-full"
					:modal="true"
					fullscreen
					dismissible
				>
					<p
						v-if="!canCreateQuiz"
						class="text-sm text-primary font-bold hover:opacity-70 mb-2 transition-opacity duration-300"
					>
						Upgrade your account to create an interactive quiz for your article and engage readers
						with fun questions!
					</p>

					<template #title>
						<div class="flex">
							<UIcon
								name="mdi:diamond-stone"
								class="size-6"
							/>
							<span class="ml-2">Upgrade to Access Article Quizzes</span>
						</div>
					</template>
					<template #body>
						<div class="flex flex-col w-full items-center gap-4">
							<UserCard
								v-if="user"
								:user="user"
							/>
							<Ranks highlighted="ORGANIZER" />
						</div>
					</template>
				</UModal>

				<ArticleQuizEditor
					ref="quizEditor"
					:disabled="!canCreateQuiz"
				/>
			</div>

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
import { articleSchema } from 'schemas';
import ArticleQuizEditor from './QuizEditor.vue';

const props = defineProps<{
	article?: Article;
	mode: 'create' | 'edit';
}>();

const { user } = useAuth();
const canCreateQuiz = computed(() => {
	if (!user.value) return false;

	if (
		(props.mode === 'create' && user.value.account.account_type === 'ORGANIZER') ||
		user.value.is_admin
	)
		return true;

	if (props.mode === 'edit' && props.article) {
		return (
			(user.value.account.account_type === 'ORGANIZER' &&
				props.article.author_id === user.value.id) ||
			user.value.is_admin
		);
	}

	return false;
});

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

const { user } = useAuth();
const userId = computed(() => user.value?.id ?? null);
// only autosave on create; editing existing articles uses the server copy as truth
const draft = useFormDraft(state, {
	kind: 'article',
	userId,
	scope: props.mode === 'create' ? 'create' : `edit:${props.article?.id ?? 'unknown'}`
});

onMounted(async () => {
	if (props.mode === 'edit' && props.article) {
		const { quiz, fetchQuiz } = useArticle(props.article.id);
		if (!quiz.value) {
			// if quiz is not already loaded, fetch it to populate the cache and summary cache
			await fetchQuiz();
		}

		if (quiz.value && canCreateQuiz.value) {
			// populate quiz editor with existing quiz questions
			quizEditor.value?.setQuestions(quiz.value);
		}
	}
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

const quizEditor = ref<InstanceType<typeof ArticleQuizEditor>>();

const getSubmittedQuizQuestions = () => {
	return quizEditor.value?.getQuestions() || [];
};

function showQuizValidationError(message: string) {
	toast.add({
		title: 'Quiz Error',
		description: message,
		duration: 6000,
		icon: 'mdi:pencil-box-outline',
		color: 'warning'
	});
}

function validateQuizForCreate(questions: any[]) {
	if (!questions || questions.length === 0) return true; // optional

	const MAX_QUESTIONS = 10;
	const MAX_OPTIONS = 6;
	const QUESTION_MIN_LEN = 5;
	const QUESTION_MAX_LEN = 256;
	const OPTION_MIN_LEN = 1;
	const OPTION_MAX_LEN = 64;

	if (questions.length > MAX_QUESTIONS) {
		showQuizValidationError(`Quizzes may contain at most ${MAX_QUESTIONS} questions.`);
		return false;
	}

	for (let i = 0; i < questions.length; i++) {
		const q = questions[i];
		if (!q || !q.question || !String(q.question).trim()) {
			showQuizValidationError(`Question #${i + 1} must have non-empty text.`);
			return false;
		}

		const qText = String(q.question || '').trim();
		if (qText.length < QUESTION_MIN_LEN || qText.length > QUESTION_MAX_LEN) {
			showQuizValidationError(
				`Question #${i + 1} must be between ${QUESTION_MIN_LEN} and ${QUESTION_MAX_LEN} characters.`
			);
			return false;
		}

		if (q.type === 'multiple_choice') {
			const opts = Array.isArray(q.options)
				? q.options.map((o: any) => String(o || '').trim())
				: [];
			const nonEmpty = opts.filter((o: string) => o.length > 0);
			if (nonEmpty.length < 2) {
				showQuizValidationError(
					`Multiple choice question #${i + 1} needs at least 2 non-empty options.`
				);
				return false;
			}

			if (opts.length > MAX_OPTIONS) {
				showQuizValidationError(
					`Multiple choice question #${i + 1} may have at most ${MAX_OPTIONS} options.`
				);
				return false;
			}

			// enforce per-option length limits
			for (let k = 0; k < opts.length; k++) {
				const len = opts[k].length;
				if (len > 0 && (len < OPTION_MIN_LEN || len > OPTION_MAX_LEN)) {
					showQuizValidationError(
						`Option ${k + 1} for question #${i + 1} must be between ${OPTION_MIN_LEN} and ${OPTION_MAX_LEN} characters.`
					);
					return false;
				}
			}

			if (!q.correct_answer || !nonEmpty.includes(String(q.correct_answer))) {
				showQuizValidationError(
					`Multiple choice question #${i + 1} must have a correct answer selected.`
				);
				return false;
			}
		} else if (q.type === 'true_false') {
			if (q.correct_answer !== 'True' && q.correct_answer !== 'False') {
				showQuizValidationError(
					`True/False question #${i + 1} must have a correct answer selected.`
				);
				return false;
			}
		}
	}

	return true;
}

const emailGate = useEmailGate();

async function handleSubmit() {
	if (props.mode === 'create' && !emailGate.requireVerified('publish articles')) return;
	loading.value = true;
	if (props.mode === 'create') {
		const articleStore = useArticleStore();

		// validate quiz before creating article
		const submittedQuiz = getSubmittedQuizQuestions();
		if (!validateQuizForCreate(submittedQuiz)) {
			loading.value = false;
			return;
		}

		const res = await articleStore.createArticle({
			title: state.title,
			description: state.description,
			content: state.content,
			tags: state.tags,
			color: state.color,
			color_hex: state.color_hex
		});

		if (valid(res)) {
			if (canCreateQuiz.value) {
				const resQuiz = await articleStore.changeQuiz(res.data.id, getSubmittedQuizQuestions());
				if (!valid(resQuiz)) {
					loading.value = false;
					if (emailGate.handleServerError(resQuiz, 'create quizzes')) return;
					toast.add({
						title: 'Error Creating Quiz',
						description:
							resQuiz.data?.message || resQuiz.message || 'Failed to create quiz for article.',
						duration: 5000,
						icon: 'mdi:alert-circle',
						color: 'warning'
					});
					return;
				}
			}

			toast.add({
				title: 'Article Created',
				description: 'Your article has been created successfully.',
				duration: 3000,
				icon: 'mdi:pen-plus',
				color: 'success'
			});

			draft.clear();
			router.push(`/articles/${res.data.id}`);
		} else {
			loading.value = false;
			if (emailGate.handleServerError(res, 'publish articles')) return;
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
			content: state.content,
			tags: state.tags,
			color: state.color,
			color_hex: state.color_hex
		});

		if (valid(res)) {
			if (canCreateQuiz.value) {
				const resQuiz = await articleStore.changeQuiz(res.data.id, getSubmittedQuizQuestions());
				if (!valid(resQuiz)) {
					loading.value = false;
					if (emailGate.handleServerError(resQuiz, 'update quizzes')) return;
					toast.add({
						title: 'Error Updating Quiz',
						description:
							resQuiz.data?.message || resQuiz.message || 'Failed to create quiz for article.',
						duration: 5000,
						icon: 'mdi:alert-circle',
						color: 'warning'
					});
					return;
				}
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
