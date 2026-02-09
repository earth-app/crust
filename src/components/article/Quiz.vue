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
			<div class="flex items-center justify-between w-full">
				<UButton
					icon="mdi:arrow-left"
					variant="soft"
					size="md"
					@click="index--"
					:disabled="index === 0"
				/>

				<Transition
					name="fade"
					mode="out-in"
				>
					<div
						:key="index"
						class="flex flex-col items-center p-4 w-full ml-4"
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

						<URadioGroup
							v-model="userAnswers[index]"
							:items="currentOptions"
							:disabled="score !== null"
							color="info"
							class="self-start w-full"
						/>

						<div
							v-if="score"
							class="flex flex-col justify-center space-y-2 w-full self-start min-h-55"
						>
							<USeparator />
							<div
								v-for="(option, i) in currentQuestion.options"
								:key="i"
								class="flex items-center justify-between p-2 rounded"
								:class="{
									'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400':
										i === currentResult?.correct_answer_index,
									'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400':
										i === userAnswers[index] &&
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
									v-else-if="i === userAnswers[index] && !currentResult?.correct"
									name="mdi:close-circle"
									class="text-red-500"
								/>
							</div>
						</div>
					</div>
				</Transition>

				<UButton
					v-if="score || !quizCompleted"
					icon="mdi:arrow-right"
					variant="soft"
					size="md"
					@click="index++"
					:disabled="index === quiz.length - 1"
				/>

				<UButton
					v-else-if="!score"
					trailing-icon="mdi:arrow-right"
					variant="subtle"
					size="md"
					color="primary"
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
import type { Article } from '~/shared/types/article';

const props = defineProps<{
	article: Article;
}>();

const { quiz, quizSummary, submitQuiz, score } = useArticle(props.article.id);

const index = ref(0);
const currentQuestion = computed(() => {
	if (!quiz.value || quiz.value.length === 0) return null;
	return quiz.value[index.value] || null;
});
const currentOptions = computed(() => {
	if (!currentQuestion.value) return [];

	const options = currentQuestion.value.options;

	if (options.length === 0 && currentQuestion.value.type === 'true_false') {
		return [
			{ text: 'True', value: 0 },
			{ text: 'False', value: 1 }
		];
	}

	return options.map((option, i) => ({
		label: option,
		value: i
	}));
});

const submitting = ref(false);
const handleSubmit = async () => {
	if (!quizCompleted.value) return;

	submitting.value = true;
	await submitQuiz(userAnswers.value);
	submitting.value = false;
};

const userAnswers = ref<number[]>([]);
const quizCompleted = computed(() => {
	return (
		quiz.value !== null &&
		quiz.value !== undefined &&
		Array.isArray(quiz.value) &&
		quiz.value.length > 0 &&
		quizSummary.value !== null &&
		userAnswers.value.length === quizSummary.value.total
	);
});

const currentResult = computed(() => {
	if (!score.value || !currentQuestion.value) return null;

	return score.value.results[index.value] || null;
});
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
