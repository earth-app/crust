<template>
	<div class="flex flex-col gap-4 items-center justify-center w-full min-h-50">
		<h3
			v-if="score"
			class="text-base font-semibold"
		>
			{{ score.scorePercent }}% ({{ score.score }} / {{ score.total }})
		</h3>
		<div
			v-if="quiz && quiz.length > 0"
			class="flex flex-col items-center justify-between w-full"
		>
			<div class="flex items-start justify-between w-full">
				<UButton
					icon="mdi:arrow-left"
					variant="soft"
					size="md"
					class="mt-4"
					@click="index--"
					:disabled="index === 0"
				/>

				<Transition
					name="fade"
					mode="out-in"
				>
					<div
						:key="index"
						class="flex flex-col items-center p-4 w-full mx-4"
						v-if="currentQuestion"
					>
						<h2 class="text-lg font-semibold mb-4 self-start">
							{{ index + 1 }}. {{ currentQuestion.question }}
						</h2>

						<div
							v-if="currentResult"
							class="flex items-center mb-2 self-start"
						>
							<UIcon
								:name="currentResult.correct ? 'mdi:check' : 'mdi:close'"
								class="mr-2"
								:class="currentResult.correct ? 'text-green-500' : 'text-red-500'"
							/>
							<span>{{ currentResult.correct ? 'Correct' : 'Incorrect' }}</span>
						</div>

						<!-- single-pick: multiple_choice + true_false (unchanged behavior) -->
						<URadioGroup
							v-if="
								currentQuestion.type === 'multiple_choice' || currentQuestion.type === 'true_false'
							"
							:model-value="singlePickAnswers[index]"
							@update:model-value="(v) => onSinglePick(index, v as number)"
							:items="currentSingleOptions"
							:disabled="!!score"
							color="info"
							class="self-start w-full"
						/>

						<!-- multi_select: independent checkboxes -->
						<div
							v-else-if="currentQuestion.type === 'multi_select'"
							class="flex flex-col gap-2 self-start w-full"
						>
							<p class="text-xs text-muted">Select every option that applies.</p>
							<label
								v-for="(option, i) in currentQuestion.options"
								:key="`ms-${index}-${i}`"
								class="flex items-center gap-2 rounded-md border border-default px-3 py-2 cursor-pointer hover:bg-elevated/50"
							>
								<UCheckbox
									:model-value="multiSelectAnswers[index]?.includes(i) ?? false"
									:disabled="!!score"
									@update:model-value="(checked) => onMultiSelect(index, i, !!checked)"
								/>
								<span>{{ option }}</span>
							</label>
						</div>

						<!-- order: reuse Orderer in untimed mode -->
						<div
							v-else-if="currentQuestion.type === 'order'"
							class="flex flex-col gap-2 self-start w-full"
						>
							<UserQuestStepOrderer
								:items="currentQuestion.items"
								untimed
								:disabled="!!score"
								:submit="false"
								@update:order="(order: string[]) => onOrderUpdate(index, order)"
							/>
						</div>

						<!-- post-score breakdown -->
						<div
							v-if="score && currentResult"
							class="flex flex-col justify-center space-y-2 w-full self-start min-h-55 mt-3"
						>
							<USeparator />

							<template v-if="currentQuestion.type === 'multi_select'">
								<div
									v-for="(option, i) in currentQuestion.options"
									:key="`msr-${i}`"
									class="flex items-center justify-between p-2 rounded"
									:class="multiSelectResultClass(i, currentResult)"
								>
									<span>#{{ i + 1 }}. {{ option }}</span>
									<UIcon
										v-if="
											Array.isArray(currentResult.correct_answer_indices) &&
											currentResult.correct_answer_indices.includes(i)
										"
										name="mdi:check-circle"
										class="text-green-500"
									/>
									<UIcon
										v-else-if="
											Array.isArray(currentResult.user_answer_indices) &&
											currentResult.user_answer_indices.includes(i)
										"
										name="mdi:close-circle"
										class="text-red-500"
									/>
								</div>
							</template>

							<template v-else-if="currentQuestion.type === 'order'">
								<p class="text-xs text-muted">Correct order:</p>
								<ol class="flex flex-col gap-1">
									<li
										v-for="(item, i) in currentResult.correct_order || []"
										:key="`co-${i}`"
										class="flex items-center gap-2 rounded-md border border-default px-3 py-2"
										:class="
											currentResult.user_order && currentResult.user_order[i] === item
												? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
												: ''
										"
									>
										<span class="text-xs text-muted w-5 text-right tabular-nums">{{ i + 1 }}.</span>
										<span>{{ item }}</span>
									</li>
								</ol>
								<p
									v-if="
										!currentResult.correct &&
										currentResult.user_order &&
										currentResult.user_order.length > 0
									"
									class="text-xs text-muted mt-2"
								>
									Your order: {{ currentResult.user_order.join(' → ') }}
								</p>
							</template>

							<template v-else>
								<div
									v-for="(option, i) in singleOptionLabels(currentQuestion)"
									:key="i"
									class="flex items-center justify-between p-2 rounded"
									:class="{
										'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400':
											i === currentResult?.correct_answer_index,
										'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400':
											i === singlePickAnswers[index] &&
											!currentResult?.correct &&
											i !== currentResult?.correct_answer_index
									}"
								>
									<span>#{{ i + 1 }}. {{ option }}</span>
									<UIcon
										v-if="i === currentResult?.correct_answer_index"
										name="mdi:check-circle"
										class="text-green-500"
									/>
									<UIcon
										v-else-if="i === singlePickAnswers[index] && !currentResult?.correct"
										name="mdi:close-circle"
										class="text-red-500"
									/>
								</div>
							</template>
						</div>
					</div>
				</Transition>

				<UButton
					icon="mdi:arrow-right"
					variant="soft"
					size="md"
					class="mt-4"
					@click="index++"
					:disabled="index === quiz.length - 1"
				/>

				<UButton
					v-if="!score"
					trailing-icon="mdi:arrow-right"
					variant="subtle"
					size="md"
					color="primary"
					class="mt-4"
					@click="handleSubmit"
					:disabled="!quizCompleted || submitting"
					:loading="submitting"
					>Submit</UButton
				>

				<div
					v-else-if="index === quiz.length - 1 && !quizCompleted"
					class="w-16"
				/>
			</div>
			<UProgress
				v-if="!score"
				:max="quiz.length"
				:model-value="index + 1"
				class="w-full mt-4"
				color="info"
			/>
		</div>
		<div
			v-else-if="quiz === null"
			class="text-center text-gray-500 py-8"
		>
			<p>No quiz available for this article.</p>
		</div>
		<div
			v-else
			class="flex items-center justify-center py-8"
		>
			<Loading />
		</div>
	</div>
</template>

<script setup lang="ts">
import type { ArticleQuizAnswer, ArticleQuizQuestionSubmission } from 'types/article';

const props = defineProps<{
	article: Article;
}>();

const { quiz, quizSummary, submitQuiz, score } = useArticle(props.article.id);

const index = ref(0);
const currentQuestion = computed<ArticleQuizQuestionSubmission | null>(() => {
	if (!quiz.value || quiz.value.length === 0) return null;
	return quiz.value[index.value] ?? null;
});

// per-question answer state — parallel arrays keyed by question index. Only one shape is populated
// per question depending on its type, but keeping them separate avoids brittle any-typed unions.
const singlePickAnswers = ref<(number | undefined)[]>([]);
const multiSelectAnswers = ref<(number[] | undefined)[]>([]);
const orderAnswers = ref<(string[] | undefined)[]>([]);

watch(
	quiz,
	(q) => {
		const len = q?.length ?? 0;
		singlePickAnswers.value = Array(len).fill(undefined);
		multiSelectAnswers.value = Array(len).fill(undefined);
		orderAnswers.value = Array(len).fill(undefined);
	},
	{ immediate: true }
);

function singleOptionLabels(q: ArticleQuizQuestionSubmission): string[] {
	if (q.type === 'order') return [];
	if (q.type === 'true_false' && q.options.length === 0) return ['True', 'False'];
	return q.options;
}

const currentSingleOptions = computed(() => {
	const q = currentQuestion.value;
	if (!q) return [] as { label: string; value: number }[];
	return singleOptionLabels(q).map((label, i) => ({ label, value: i }));
});

function onSinglePick(i: number, v: number) {
	singlePickAnswers.value[i] = v;
}

function onMultiSelect(i: number, optionIndex: number, checked: boolean) {
	const set = new Set<number>(multiSelectAnswers.value[i] ?? []);
	if (checked) set.add(optionIndex);
	else set.delete(optionIndex);
	multiSelectAnswers.value[i] = [...set].sort((a, b) => a - b);
}

function onOrderUpdate(i: number, order: string[]) {
	orderAnswers.value[i] = order;
}

const submitting = ref(false);
const handleSubmit = async () => {
	if (!quizCompleted.value || !quiz.value) return;
	submitting.value = true;

	const payload: ArticleQuizAnswer[] = quiz.value.map((q, i) => {
		const question = q.question;
		if (q.type === 'multi_select') {
			const indices = multiSelectAnswers.value[i] ?? [];
			return {
				question,
				indices,
				texts: indices.map((idx) => q.options[idx] ?? '')
			};
		}
		if (q.type === 'order') {
			return { question, ordered: orderAnswers.value[i] ?? [] };
		}
		const pick = singlePickAnswers.value[i];
		const labels = singleOptionLabels(q);
		return {
			question,
			index: pick,
			text: pick !== undefined ? (labels[pick] ?? '') : ''
		};
	});

	await submitQuiz(payload);
	submitting.value = false;
};

const quizCompleted = computed(() => {
	if (!quiz.value || !quizSummary.value) return false;
	if (quiz.value.length === 0) return false;
	return quiz.value.every((q, i) => {
		if (q.type === 'multi_select') {
			return (multiSelectAnswers.value[i]?.length ?? 0) >= 1;
		}
		if (q.type === 'order') {
			return (orderAnswers.value[i]?.length ?? 0) === q.items.length;
		}
		return typeof singlePickAnswers.value[i] === 'number';
	});
});

const currentResult = computed(() => {
	if (!score.value || !currentQuestion.value) return null;
	return score.value.results[index.value] || null;
});

function multiSelectResultClass(i: number, result: any): Record<string, boolean> {
	const correctIdx = Array.isArray(result?.correct_answer_indices)
		? result.correct_answer_indices
		: [];
	const userIdx = Array.isArray(result?.user_answer_indices) ? result.user_answer_indices : [];
	const isCorrect = correctIdx.includes(i);
	const isUserPicked = userIdx.includes(i);
	return {
		'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400':
			isCorrect && isUserPicked,
		'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400':
			isCorrect && !isUserPicked, // user missed a correct one
		'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400': !isCorrect && isUserPicked // user picked a wrong one
	};
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}
</style>
