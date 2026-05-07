<template>
	<div class="flex flex-col">
		<div
			v-for="(q, i) in questions"
			:key="i"
			class="flex items-start gap-2 mb-6"
		>
			<span class="text-base font-semibold mr-2">#{{ i + 1 }}</span>

			<UInput
				v-model="q.question"
				placeholder="Question"
				class="flex-1"
				:disabled="props.disabled"
				@input="emit('update-question', { index: i, question: q })"
			/>

			<div class="flex items-center mx-2 gap-4">
				<USelect
					v-model="q.type"
					:disabled="props.disabled"
					@change="onQuestionTypeChange(i)"
					:items="[
						{ label: 'True/False', value: 'true_false', icon: 'mdi:check' },
						{ label: 'Multiple Choice', value: 'multiple_choice', icon: 'mdi:format-list-bulleted' }
					]"
				/>

				<div
					v-if="q.type === 'multiple_choice'"
					class="flex flex-col"
				>
					<div
						v-for="(option, j) in q.options"
						class="flex w-full"
						:key="j"
					>
						<UInput
							v-model="q.options[j]"
							:placeholder="`Option ${j + 1}`"
							class="flex-1 w-5/6 mb-2"
							:disabled="props.disabled"
							@input="onOptionInput(i, j)"
						/>

						<UButton
							:color="getCorrectAnswerIndex(q) === j ? 'success' : 'primary'"
							variant="soft"
							class="ml-2 mb-2"
							:icon="
								getCorrectAnswerIndex(q) === j
									? 'mdi:check-circle'
									: 'mdi:checkbox-blank-circle-outline'
							"
							:disabled="props.disabled"
							@click="setMultipleChoiceCorrectAnswer(i, j)"
						>
							{{ getCorrectAnswerIndex(q) === j ? 'Correct' : 'Set Correct' }}
						</UButton>

						<UButton
							v-if="q.options.length > 2"
							color="error"
							variant="soft"
							icon="mdi:delete-outline"
							class="ml-2 mb-2"
							@click="
								() => {
									removeOption(i, j);
								}
							"
							:disabled="props.disabled"
						/>
					</div>

					<UButton
						v-if="q.options.length < 6"
						color="secondary"
						variant="subtle"
						icon="mdi:plus"
						@click="addOption(i)"
						class="mb-2"
						:disabled="props.disabled"
						>Add Option...</UButton
					>
				</div>

				<div
					v-else-if="q.type === 'true_false'"
					class="flex"
				>
					<span class="mr-2 text-sm opacity-70">Correct Answer:</span>
					<USwitch
						v-model="q.correct_answer"
						:checked-value="'True'"
						checked-icon="mdi:letter-t"
						:unchecked-value="'False'"
						unchecked-icon="mdi:letter-f"
						:disabled="props.disabled"
						@change="emitQuestionUpdate(i)"
					/>
				</div>
			</div>

			<UButton
				color="error"
				variant="subtle"
				icon="mdi:close"
				@click="removeQuestion(i)"
				class="mx-2"
				:disabled="props.disabled"
			/>
		</div>
	</div>

	<UButton
		color="primary"
		variant="subtle"
		icon="mdi:plus"
		@click="insertQuestion"
		:disabled="props.disabled || questions.length >= 10"
	/>
</template>

<script setup lang="ts">
import type { ArticleQuizQuestionSubmission } from 'types/article';

const props = defineProps<{
	disabled?: boolean;
}>();

const questions = reactive<ArticleQuizQuestionSubmission[]>([]);

const emit = defineEmits<{
	(event: 'add-question', question: ArticleQuizQuestionSubmission): void;
	(
		event: 'update-question',
		payload: { index: number; question: ArticleQuizQuestionSubmission }
	): void;
	(event: 'remove-question', index: number): void;
}>();

defineExpose({
	questions,
	getQuestions() {
		return questions.map((q) => normalizeQuestion(q));
	},
	setQuestions(newQuestions: ArticleQuizQuestionSubmission[]) {
		questions.splice(0, questions.length, ...newQuestions.map((q) => normalizeQuestion(q)));
	}
});

function normalizeQuestion(question: ArticleQuizQuestionSubmission): ArticleQuizQuestionSubmission {
	if (question.type === 'true_false') {
		return {
			type: 'true_false',
			question: question.question || '',
			options: ['True', 'False'],
			correct_answer: question.correct_answer === 'True' ? 'True' : 'False'
		};
	}

	const options = (question.options || []).map((option) => option || '').slice(0, 6);
	while (options.length < 2) {
		options.push('');
	}

	const correctAnswer = options.includes(question.correct_answer) ? question.correct_answer : '';

	return {
		type: 'multiple_choice',
		question: question.question || '',
		options,
		correct_answer: correctAnswer
	};
}

function emitQuestionUpdate(index: number) {
	const question = questions[index];
	if (!question) return;
	emit('update-question', { index, question: normalizeQuestion(question) });
}

function onQuestionTypeChange(index: number) {
	const question = questions[index];
	if (!question) return;

	if (question.type === 'true_false') {
		question.options = ['True', 'False'];
		question.correct_answer = question.correct_answer === 'True' ? 'True' : 'False';
	} else {
		const existingOptions = question.options.map((option) => option || '').slice(0, 6);
		while (existingOptions.length < 2) {
			existingOptions.push('');
		}
		question.options = existingOptions;
		if (!question.options.includes(question.correct_answer)) {
			question.correct_answer = '';
		}
	}

	emitQuestionUpdate(index);
}

function getCorrectAnswerIndex(question: ArticleQuizQuestionSubmission): number {
	if (question.type !== 'multiple_choice') return -1;
	return question.options.findIndex((option) => option === question.correct_answer);
}

function setMultipleChoiceCorrectAnswer(questionIndex: number, optionIndex: number) {
	const question = questions[questionIndex];
	if (!question || question.type !== 'multiple_choice') return;

	const option = question.options[optionIndex];
	if (option === undefined) return;

	question.correct_answer = option;
	emitQuestionUpdate(questionIndex);
}

function onOptionInput(questionIndex: number, optionIndex: number) {
	const question = questions[questionIndex];
	if (!question || question.type !== 'multiple_choice') return;

	const option = question.options[optionIndex] || '';
	const currentCorrectAnswerIndex = getCorrectAnswerIndex(question);

	if (currentCorrectAnswerIndex === optionIndex) {
		question.correct_answer = option;
	}

	emitQuestionUpdate(questionIndex);
}

function addOption(questionIndex: number) {
	const question = questions[questionIndex];
	if (!question || question.type !== 'multiple_choice') return;

	const options = [...(question.options as string[])];
	if (options.length >= 6) return;
	options.push('');
	question.options = options as any;
	emitQuestionUpdate(questionIndex);
}

function removeOption(questionIndex: number, optionIndex: number) {
	const question = questions[questionIndex];
	if (!question || question.type !== 'multiple_choice') return;

	if (question.options.length <= 2) return;
	const removed = question.options[optionIndex];
	question.options.splice(optionIndex, 1);

	if (removed === question.correct_answer) {
		question.correct_answer = '';
	}

	emitQuestionUpdate(questionIndex);
}

function insertQuestion() {
	questions.push({
		type: 'true_false',
		question: '',
		options: ['True', 'False'],
		correct_answer: 'False'
	});
	emit('add-question', questions[questions.length - 1]!);
}

function removeQuestion(index: number) {
	if (index < 0 || index >= questions.length) return;
	questions.splice(index, 1);
	emit('remove-question', index);
}
</script>
