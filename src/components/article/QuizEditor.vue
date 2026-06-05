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
				class="flex-1 min-w-60"
				:minlength="5"
				:maxlength="256"
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
						{
							label: 'Multiple Choice',
							value: 'multiple_choice',
							icon: 'mdi:format-list-bulleted'
						},
						{
							label: 'Multi-Select',
							value: 'multi_select',
							icon: 'mdi:checkbox-multiple-marked-outline'
						},
						{ label: 'Order', value: 'order', icon: 'mdi:sort' }
					]"
					class="min-w-40"
				/>

				<div
					v-if="q.type === 'multiple_choice'"
					class="flex flex-col"
				>
					<div
						v-for="(_, j) in q.options"
						class="flex w-full"
						:key="j"
					>
						<UInput
							v-model="q.options[j]"
							:placeholder="`Option ${j + 1}`"
							class="flex-1 w-5/6 mb-2"
							:minlength="1"
							:maxlength="64"
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

				<div
					v-else-if="q.type === 'multi_select'"
					class="flex flex-col"
				>
					<p class="text-xs opacity-70 mb-1">
						Mark every option that's correct. The reader scores 1 point only if their picks match
						the set exactly.
					</p>
					<div
						v-for="(_, j) in q.options"
						class="flex w-full"
						:key="j"
					>
						<UInput
							v-model="q.options[j]"
							:placeholder="`Option ${j + 1}`"
							class="flex-1 w-5/6 mb-2"
							:minlength="1"
							:maxlength="64"
							:disabled="props.disabled"
							@input="onMultiSelectOptionInput(i)"
						/>
						<UButton
							:color="isMultiSelectCorrect(q, j) ? 'success' : 'primary'"
							variant="soft"
							class="ml-2 mb-2"
							:icon="
								isMultiSelectCorrect(q, j) ? 'mdi:checkbox-marked' : 'mdi:checkbox-blank-outline'
							"
							:disabled="props.disabled"
							@click="toggleMultiSelectAnswer(i, j)"
						>
							{{ isMultiSelectCorrect(q, j) ? 'Correct' : 'Mark Correct' }}
						</UButton>
						<UButton
							v-if="q.options.length > 3"
							color="error"
							variant="soft"
							icon="mdi:delete-outline"
							class="ml-2 mb-2"
							@click="removeMultiSelectOption(i, j)"
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
					v-else-if="q.type === 'order'"
					class="flex flex-col"
				>
					<p class="text-xs opacity-70 mb-1">
						List items in their correct order. The reader sees them shuffled and earns 1 point only
						if they reproduce this exact sequence.
					</p>
					<div
						v-for="(_, j) in q.items"
						class="flex w-full items-center"
						:key="j"
					>
						<span class="text-xs opacity-70 w-6 text-right mr-2 tabular-nums">{{ j + 1 }}.</span>
						<UInput
							v-model="q.items[j]"
							:placeholder="`Item ${j + 1}`"
							class="flex-1 w-5/6 mb-2"
							:minlength="1"
							:maxlength="64"
							:disabled="props.disabled"
							@input="emitQuestionUpdate(i)"
						/>
						<UButton
							color="neutral"
							variant="ghost"
							icon="mdi:arrow-up"
							class="ml-1 mb-2"
							:disabled="props.disabled || j === 0"
							@click="moveOrderItem(i, j, -1)"
						/>
						<UButton
							color="neutral"
							variant="ghost"
							icon="mdi:arrow-down"
							class="mb-2"
							:disabled="props.disabled || j === q.items.length - 1"
							@click="moveOrderItem(i, j, 1)"
						/>
						<UButton
							v-if="q.items.length > 3"
							color="error"
							variant="soft"
							icon="mdi:delete-outline"
							class="ml-2 mb-2"
							@click="removeOrderItem(i, j)"
							:disabled="props.disabled"
						/>
					</div>
					<UButton
						v-if="q.items.length < 6"
						color="secondary"
						variant="subtle"
						icon="mdi:plus"
						@click="addOrderItem(i)"
						class="mb-2"
						:disabled="props.disabled"
						>Add Item...</UButton
					>
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

	if (question.type === 'multi_select') {
		const opts = (question.options ?? []).map((o) => o || '').slice(0, 6);
		while (opts.length < 3) opts.push('');
		const incoming = Array.isArray(question.correct_answers) ? question.correct_answers : [];
		const correctAnswers = incoming.filter((a) => opts.includes(a));
		return {
			type: 'multi_select',
			question: question.question || '',
			options: opts,
			correct_answers: correctAnswers
		};
	}

	if (question.type === 'order') {
		const incomingItems = (question.items ?? []).map((s) => s || '').slice(0, 6);
		while (incomingItems.length < 3) incomingItems.push('');
		return {
			type: 'order',
			question: question.question || '',
			items: incomingItems
		};
	}

	const options = (question.options ?? []).map((option) => option || '').slice(0, 6);
	while (options.length < 2) options.push('');

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
	const q = questions[index];
	if (!q) return;
	// normalizeQuestion rebuilds the per-branch shape from whatever leftover
	// fields the previous type carried, so just swap in the normalized version
	questions.splice(index, 1, normalizeQuestion(q));
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
	const q = questions[questionIndex];
	if (!q || (q.type !== 'multiple_choice' && q.type !== 'multi_select')) return;

	if (q.options.length >= 6) return;
	q.options.push('');
	emitQuestionUpdate(questionIndex);
}

function removeOption(questionIndex: number, optionIndex: number) {
	const q = questions[questionIndex];
	if (!q || q.type !== 'multiple_choice') return;

	if (q.options.length <= 2) return;
	const removed = q.options[optionIndex];
	q.options.splice(optionIndex, 1);

	if (removed === q.correct_answer) q.correct_answer = '';

	emitQuestionUpdate(questionIndex);
}

// multi_select helpers
function isMultiSelectCorrect(q: ArticleQuizQuestionSubmission, optionIndex: number): boolean {
	if (q.type !== 'multi_select') return false;
	const opt = q.options[optionIndex];
	if (!opt) return false;
	return q.correct_answers.includes(opt);
}

function toggleMultiSelectAnswer(questionIndex: number, optionIndex: number) {
	const q = questions[questionIndex];
	if (!q || q.type !== 'multi_select') return;
	const opt = q.options[optionIndex];
	if (!opt) return;
	const set = new Set(q.correct_answers);
	if (set.has(opt)) set.delete(opt);
	else set.add(opt);
	// preserve option order in the saved correct_answers
	q.correct_answers = q.options.filter((o) => set.has(o));
	emitQuestionUpdate(questionIndex);
}

function onMultiSelectOptionInput(questionIndex: number) {
	const q = questions[questionIndex];
	if (!q || q.type !== 'multi_select') return;
	// drop any "correct" entry that no longer matches an option text after edit
	q.correct_answers = q.correct_answers.filter((a) => q.options.includes(a));
	emitQuestionUpdate(questionIndex);
}

function removeMultiSelectOption(questionIndex: number, optionIndex: number) {
	const q = questions[questionIndex];
	if (!q || q.type !== 'multi_select') return;
	if (q.options.length <= 3) return;
	const removed = q.options[optionIndex];
	q.options.splice(optionIndex, 1);
	q.correct_answers = q.correct_answers.filter((a) => a !== removed);
	emitQuestionUpdate(questionIndex);
}

// order helpers
function addOrderItem(questionIndex: number) {
	const q = questions[questionIndex];
	if (!q || q.type !== 'order') return;
	if (q.items.length >= 6) return;
	q.items.push('');
	emitQuestionUpdate(questionIndex);
}

function removeOrderItem(questionIndex: number, itemIndex: number) {
	const q = questions[questionIndex];
	if (!q || q.type !== 'order') return;
	if (q.items.length <= 3) return;
	q.items.splice(itemIndex, 1);
	emitQuestionUpdate(questionIndex);
}

function moveOrderItem(questionIndex: number, itemIndex: number, dir: -1 | 1) {
	const q = questions[questionIndex];
	if (!q || q.type !== 'order') return;
	const target = itemIndex + dir;
	if (target < 0 || target >= q.items.length) return;
	const tmp = q.items[itemIndex]!;
	q.items[itemIndex] = q.items[target]!;
	q.items[target] = tmp;
	emitQuestionUpdate(questionIndex);
}

function insertQuestion() {
	questions.push({
		type: 'true_false',
		question: '',
		options: ['True', 'False'],
		correct_answer: 'True'
	});
	emit('add-question', questions[questions.length - 1]!);
}

function removeQuestion(index: number) {
	if (index < 0 || index >= questions.length) return;
	questions.splice(index, 1);
	emit('remove-question', index);
}
</script>
