<template>
	<div
		v-if="step"
		class="flex flex-col items-center p-4 min-h-160 w-full"
	>
		<div class="flex flex-col items-center mt-4 text-center gap-1">
			<UIcon
				:name="step.icon"
				class="size-16"
			/>
			<h2 class="text-lg font-semibold opacity-90">{{ step.description }}</h2>
			<h3
				v-if="step.reward"
				class="text-sm text-neutral-500"
			>
				+{{ step.reward }} Bonus Points
			</h3>
		</div>

		<h2
			v-if="!step.isCurrentQuest && !step.completed"
			class="text-sm text-neutral-500 mb-2"
		>
			Start this quest to unlock the step interface.
		</h2>
		<h2
			v-else-if="!step.isCurrentStep && !step.completed"
			class="text-sm text-neutral-500 mb-2"
		>
			Complete previous steps to unlock this step.
		</h2>

		<div class="flex flex-col items-center justify-center mt-6 w-full gap-4">
			<div
				v-if="step.completed"
				class="flex flex-col items-center py-8 w-full"
			>
				<div class="flex flex-col items-center my-2">
					<UIcon
						name="i-lucide-circle-check"
						class="size-14 text-success"
					/>
					<span class="text-base font-medium">Already completed</span>
					<span class="text-sm opacity-90">{{ completedAt }}</span>
				</div>

				<div
					v-if="progress"
					class="flex m-2 mb-6"
				>
					<img
						v-if="progress.data && (category === 'photo' || category === 'draw_picture')"
						:src="progress.data"
						alt="Submitted image"
						class="mt-3 max-w-full max-h-72 rounded-lg object-contain border border-neutral-200 dark:border-neutral-700"
					/>
					<audio
						v-else-if="progress.data && category === 'audio'"
						:src="progress.data"
						controls
						class="mt-3 w-full max-w-sm"
					/>
					<ArticleCard
						v-else-if="step.type === 'article_quiz' && stepArticle"
						:article="stepArticle"
					/>
				</div>

				<Score
					v-if="progress?.score"
					:score="progress.score"
				/>
				<Quote
					v-if="progress?.prompt"
					:text="progress.prompt"
				/>
			</div>

			<template v-else-if="category === 'photo'">
				<UserQuestStepCapture
					v-if="!submitting && !succeeded"
					:disabled="!step.isCurrentQuest || !step.isCurrentStep"
					@capture="submitPhoto"
					@photo-taken="submitError = ''"
					@photo-rejected="submitError = ''"
				/>

				<div
					v-else-if="submitting"
					class="flex flex-col items-center gap-3 py-8"
				>
					<UIcon
						name="i-lucide-upload"
						class="size-10 animate-bounce text-primary"
					/>
					<span class="text-sm opacity-70">Validating submission…</span>
				</div>

				<div
					v-else-if="succeeded"
					class="flex flex-col items-center gap-3 py-8"
				>
					<UIcon
						name="i-lucide-circle-check"
						class="size-14 text-success"
					/>
					<span class="text-base font-medium">Step complete!</span>
				</div>
			</template>

			<template v-else-if="category === 'draw_picture'">
				<UserQuestStepDrawing
					v-if="!submitting && !succeeded"
					:disabled="!step.isCurrentQuest || !step.isCurrentStep"
					@capture="submitPhoto"
					@close="emit('submitted')"
				/>
				<div
					v-else-if="submitting"
					class="flex flex-col items-center gap-3 py-8"
				>
					<UIcon
						name="i-lucide-upload"
						class="size-10 animate-bounce text-primary"
					/>
					<span class="text-sm opacity-70">Validating drawing…</span>
				</div>
				<div
					v-else-if="succeeded"
					class="flex flex-col items-center gap-3 py-8"
				>
					<UIcon
						name="i-lucide-circle-check"
						class="size-14 text-success"
					/>
					<span class="text-base font-medium">Step complete!</span>
				</div>
			</template>

			<template v-else-if="category === 'audio'">
				<UserQuestStepRecorder
					v-if="!submitting && !succeeded"
					:disabled="!step.isCurrentQuest || !step.isCurrentStep"
					@capture="submitPhoto"
				/>
				<div
					v-else-if="submitting"
					class="flex flex-col items-center gap-3 py-8"
				>
					<UIcon
						name="i-lucide-upload"
						class="size-10 animate-bounce text-primary"
					/>
					<span class="text-sm opacity-70">Validating recording…</span>
				</div>
				<div
					v-else-if="succeeded"
					class="flex flex-col items-center gap-3 py-8"
				>
					<UIcon
						name="i-lucide-circle-check"
						class="size-14 text-success"
					/>
					<span class="text-base font-medium">Step complete!</span>
				</div>
			</template>

			<template v-else-if="category === 'match_terms'">
				<UserQuestStepMatcher
					:step="step"
					:disabled="!step.isCurrentQuest || !step.isCurrentStep"
					@submitted="emit('submitted')"
				/>
			</template>

			<template v-else-if="category === 'order_items'">
				<UserQuestStepOrderer
					:step="step"
					:disabled="!step.isCurrentQuest || !step.isCurrentStep"
					@submitted="emit('submitted')"
				/>
			</template>

			<template v-else>
				<div class="flex flex-col items-center gap-3 py-8 text-center opacity-60">
					<UIcon
						name="i-lucide-info"
						class="size-10"
					/>
					<span class="text-sm">This step is completed through its dedicated interface.</span>
				</div>
			</template>

			<UAlert
				v-if="submitError"
				color="error"
				variant="soft"
				icon="i-lucide-triangle-alert"
				:description="submitError"
				class="w-full mt-2"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { DateTime } from 'luxon';

const props = defineProps<{
	quest: Quest;
	progress?: (QuestProgressEntry | QuestProgressEntry[])[];
	step: QuestStep & {
		icon: string;
		completed: boolean;
		completedAt?: number;
		index: number;
		altIndex?: number;
		isCurrentQuest: boolean;
		isCurrentStep: boolean;
	};
}>();

const emit = defineEmits<{
	submitted: [];
}>();

const { user } = useAuth();
const { updateQuest } = useUser(user.value?.id || '');
const { lat, lng, fetchLocation } = useGeolocation();

const submitting = ref(false);
const succeeded = ref(false);
const submitError = ref('');

const category = computed(() => {
	switch (props.step.type) {
		case 'take_photo_location':
		case 'take_photo_classification':
		case 'take_photo_caption':
		case 'take_photo_objects':
			return 'photo';
		case 'draw_picture':
			return 'draw_picture';
		case 'transcribe_audio':
			return 'audio';
		case 'match_terms':
			return 'match_terms';
		case 'order_items':
			return 'order_items';
		default:
			return props.step.type;
	}
});

onMounted(() => {
	if (props.quest.permissions.includes('location')) {
		fetchLocation();
	}
});

async function submitPhoto(file: File) {
	submitting.value = true;
	submitError.value = '';

	try {
		const dataUrl = await fileToDataUrl(file);

		const res = await updateQuest(
			{
				type: props.step.type,
				index: props.step.index,
				...(props.step.altIndex !== undefined ? { altIndex: props.step.altIndex } : {}),
				dataUrl
			},
			lat.value,
			lng.value
		);

		if (res.validated) {
			succeeded.value = true;
			await new Promise((r) => setTimeout(r, 900));
			emit('submitted');
		} else {
			submitError.value = res.message || 'Validation failed. Please retake the photo.';
		}
	} catch (e: any) {
		submitError.value =
			e?.data?.message || e?.statusMessage || e?.message || 'Submission failed. Please try again.';
	} finally {
		submitting.value = false;
	}
}

function fileToDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

// completed step variables

const progress = computed(() => {
	if (!props.progress) return null;
	const prog = props.progress[props.step.index];
	if (!prog) return null;
	if (Array.isArray(prog)) {
		const altProg = prog.find((p) => p.altIndex === props.step.altIndex);
		return altProg || null;
	} else {
		return prog;
	}
});
const completedAt = computed(() => {
	if (!props.step.completedAt) return null;
	return DateTime.fromMillis(props.step.completedAt).toLocaleString(DateTime.DATETIME_SHORT);
});

const stepArticle = computed(() => {
	if (props.step.type !== 'article_quiz') return null;
	const prog = props.progress?.[props.step.index];
	if (!prog) return null;

	let scoreKey = '';
	if (Array.isArray(prog)) {
		const altProg = prog.find((p) => p.altIndex === props.step.altIndex);
		scoreKey = altProg?.scoreKey || '';
	} else {
		scoreKey = prog.scoreKey || '';
	}

	if (!scoreKey) return null;

	const [_, __, ___, articleId] = scoreKey.split(':');
	if (!articleId) return null;

	const { article, fetch } = useArticle(articleId);
	fetch();

	return article.value;
});
</script>
