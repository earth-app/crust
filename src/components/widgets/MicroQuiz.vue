<template>
	<UCard
		variant="soft"
		class="relative min-w-72 max-w-md p-4 shadow-md rounded-xl bg-linear-to-br from-primary/10 via-secondary/5 to-transparent overflow-hidden"
	>
		<div class="flex items-center gap-2 mb-2">
			<UIcon
				name="mdi:lightbulb-on-outline"
				class="size-5 text-primary"
			/>
			<h3 class="text-sm font-semibold uppercase tracking-wide text-muted">Quick Trivia</h3>
		</div>
		<p class="text-base font-medium mb-3">{{ q.question }}</p>
		<div class="flex flex-col gap-2">
			<UButton
				v-for="(option, i) in q.options"
				:key="`opt-${i}`"
				:color="optionColor(i)"
				:variant="optionVariant(i)"
				:disabled="answered"
				block
				class="justify-start text-left"
				@click="select(i)"
			>
				<span class="font-mono mr-2 text-xs opacity-70">{{ letters[i] }}</span>
				{{ option }}
			</UButton>
		</div>
		<p
			v-if="answered"
			class="text-xs mt-3"
			:class="isCorrect ? 'text-success' : 'text-muted'"
		>
			<template v-if="isCorrect">Nice. {{ q.explanation }}</template>
			<template v-else
				>The answer was <strong>{{ q.options[q.answer] }}</strong
				>. {{ q.explanation }}</template
			>
		</p>
		<div class="flex justify-between items-center mt-3">
			<span class="text-xs text-muted">{{ index + 1 }} / {{ questions.length }}</span>
			<UButton
				v-if="answered"
				size="xs"
				color="primary"
				variant="ghost"
				icon="mdi:refresh"
				@click="next"
			>
				Next
			</UButton>
		</div>
		<UiSparkleBurst
			:trigger="sparkleTrigger"
			color="success"
		/>
	</UCard>
</template>

<script setup lang="ts">
interface QuizQuestion {
	question: string;
	options: string[];
	answer: number;
	explanation: string;
}

const props = withDefaults(
	defineProps<{
		questions?: QuizQuestion[];
	}>(),
	{
		questions: () => [
			{
				question: 'Roughly what percent of the planet is covered by ocean?',
				options: ['51%', '71%', '83%'],
				answer: 1,
				explanation: 'about 71% — most of earth is water.'
			},
			{
				question: 'Which gas plants release during photosynthesis?',
				options: ['Carbon dioxide', 'Nitrogen', 'Oxygen'],
				answer: 2,
				explanation: 'they take in CO₂ and release O₂.'
			},
			{
				question: 'The Amazon rainforest is mostly in which country?',
				options: ['Peru', 'Brazil', 'Colombia'],
				answer: 1,
				explanation: 'about 60% of the Amazon sits in Brazil.'
			}
		]
	}
);

const emit = defineEmits<{
	(event: 'correct', index: number): void;
	(event: 'complete'): void;
}>();

const letters = ['A', 'B', 'C', 'D'];
const index = ref(0);
const selected = ref<number | null>(null);
const sparkleTrigger = ref(0);

const q = computed(() => props.questions[index.value]!);
const answered = computed(() => selected.value !== null);
const isCorrect = computed(() => selected.value === q.value.answer);

function optionColor(i: number) {
	if (!answered.value) return 'neutral' as const;
	if (i === q.value.answer) return 'success' as const;
	if (i === selected.value) return 'error' as const;
	return 'neutral' as const;
}

function optionVariant(i: number) {
	if (!answered.value) return 'outline' as const;
	if (i === q.value.answer || i === selected.value) return 'solid' as const;
	return 'ghost' as const;
}

function select(i: number) {
	if (answered.value) return;
	selected.value = i;
	if (i === q.value.answer) {
		sparkleTrigger.value++;
		emit('correct', index.value);
	}
}

function next() {
	if (index.value + 1 >= props.questions.length) {
		emit('complete');
		index.value = 0;
	} else {
		index.value++;
	}
	selected.value = null;
}
</script>
