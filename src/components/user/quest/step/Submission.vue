<template>
	<div
		v-if="step"
		class="flex flex-col items-center p-4! min-h-160 w-full"
	>
		<div class="flex flex-col items-center mt-4! text-center gap-1!">
			<UIcon
				:name="step.icon"
				class="size-16"
			/>
			<h2 class="text-lg! font-semibold! opacity-90!">{{ step.description }}</h2>
			<h3
				v-if="step.reward"
				class="text-sm! text-neutral-500"
			>
				+{{ step.reward }} Bonus Points
			</h3>
		</div>

		<h2
			v-if="!step.isCurrentQuest && !step.completed"
			class="text-sm! text-neutral-500 mb-2!"
		>
			Start this quest to unlock the step interface.
		</h2>
		<h2
			v-else-if="!step.isUnlocked && !step.completed"
			class="text-sm! text-neutral-500 mb-2!"
		>
			Complete previous steps to unlock this step.
		</h2>

		<div class="flex flex-col items-center justify-center mt-6! w-full gap-4!">
			<UAlert
				v-if="tutorialHint && !step.completed && !stepMobileOnly && !hintDismissed"
				color="primary"
				variant="subtle"
				icon="mdi:school-outline"
				title="First-quest tip"
				:description="tutorialHint"
				:close="true"
				class="mb-1 w-full"
				@close="hintDismissed = true"
			/>
			<div
				v-if="step.completed"
				class="flex flex-col items-center py-8! w-full"
			>
				<div class="flex flex-col items-center my-2!">
					<UIcon
						name="i-lucide-circle-check"
						class="size-14 text-success"
					/>
					<span class="text-base! font-medium">Already completed</span>
					<span class="text-sm! opacity-90">{{ completedAt }}</span>
				</div>

				<!-- migrated stub: original submission data is gone because the quest definition changed.
				     hide media/score/prompt rendering for migrated entries since none of those fields are reliable. -->
				<div
					v-if="progress?.migrated"
					class="flex items-center gap-3 mt-3 mb-2 px-4 py-3 rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/40 max-w-md"
				>
					<UIcon
						name="i-lucide-info"
						class="size-5 text-amber-600 shrink-0"
					/>
					<span class="text-xs! opacity-90">{{ migratedMessage }}</span>
				</div>

				<div
					v-else-if="progress"
					class="flex m-2 mb-6"
				>
					<img
						v-if="progress.data && (category === 'photo' || category === 'draw_picture')"
						:src="progress.data"
						alt="Submitted image"
						class="mt-3 max-w-full max-h-72! rounded-lg! object-contain border border-neutral-200 dark:border-neutral-700"
					/>
					<audio
						v-else-if="progress.data && category === 'audio'"
						:src="progress.data"
						controls
						class="mt-3 w-full max-w-sm!"
					/>
					<div
						v-else-if="category === 'article_quiz' && step.type === 'article_quiz' && stepArticle"
						class="flex flex-col items-center gap-3 py-4 px-6 border border-neutral-200 dark:border-neutral-700 rounded-lg"
					>
						<ArticleCard :article="stepArticle" />
					</div>
				</div>

				<Score
					v-if="!progress?.migrated && progress?.score"
					:score="progress.score"
				/>
				<Quote
					v-if="!progress?.migrated && progress?.prompt"
					:text="progress.prompt"
					:avatar="avatar128"
					:username="user?.username"
				/>
			</div>

			<div
				v-else-if="stepMobileOnly"
				class="flex flex-col items-center gap-3 py-8 text-center"
			>
				<UIcon
					name="mdi:cellphone-lock"
					class="size-14 text-info"
				/>
				<span class="text-base! font-medium!">Mobile App Only</span>
				<span class="text-sm! opacity-70 max-w-sm!">
					This step can only be completed in The Earth App mobile app. Complete an alternative step
					if one is available.
				</span>
			</div>

			<template v-else-if="category === 'photo'">
				<UserQuestStepCapture
					v-if="!submitting && !succeeded"
					:disabled="!step.isCurrentQuest || !step.isUnlocked"
					@capture="submitPhoto"
					@photo-taken="submitError = ''"
					@photo-rejected="submitError = ''"
				/>

				<div
					v-else-if="submitting"
					class="flex flex-col items-center gap-3 py-8!"
				>
					<UIcon
						name="i-lucide-upload"
						class="size-10 animate-bounce text-primary"
					/>
					<span class="text-sm opacity-70">{{ submittingMessage }}</span>
				</div>

				<div
					v-else-if="succeeded"
					class="flex flex-col items-center gap-3 py-8!"
				>
					<UIcon
						name="i-lucide-circle-check"
						class="size-14 text-success!"
					/>
					<span class="text-base! font-medium!">Step complete!</span>
				</div>
			</template>

			<template v-else-if="category === 'draw_picture'">
				<UserQuestStepDrawing
					v-if="!submitting && !succeeded"
					:disabled="!step.isCurrentQuest || !step.isUnlocked"
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
					<span class="text-sm! opacity-70">{{ submittingMessage }}</span>
				</div>
				<div
					v-else-if="succeeded"
					class="flex flex-col items-center gap-3 py-8"
				>
					<UIcon
						name="i-lucide-circle-check"
						class="size-14 text-success"
					/>
					<span class="text-base! font-medium">Step complete!</span>
				</div>
			</template>

			<template v-else-if="category === 'audio'">
				<UserQuestStepRecorder
					v-if="!submitting && !succeeded"
					:disabled="!step.isCurrentQuest || !step.isUnlocked"
					:min-length="audioMinLength"
					@capture="submitPhoto"
				/>
				<div
					v-else-if="submitting"
					class="flex flex-col items-center gap-3 py-8!"
				>
					<UIcon
						name="i-lucide-upload"
						class="size-10 animate-bounce text-primary!"
					/>
					<span class="text-sm! opacity-70">{{ submittingMessage }}</span>
				</div>
				<div
					v-else-if="succeeded"
					class="flex flex-col items-center gap-3 py-8"
				>
					<UIcon
						name="i-lucide-circle-check"
						class="size-14 text-success"
					/>
					<span class="text-base! font-medium!">Step complete!</span>
				</div>
			</template>

			<template v-else-if="category === 'describe_text'">
				<UserQuestStepText
					:step="step"
					:quest-id="quest.id"
					:quest-title="quest.title"
					:quest-reward="quest.reward"
					:disabled="!step.isCurrentQuest || !step.isUnlocked"
					:server-request="props.serverRequest || makeServerRequest"
					@submitted="emit('submitted')"
				/>
			</template>

			<template v-else-if="category === 'match_terms'">
				<UserQuestStepMatcher
					:step="step"
					:quest-id="quest.id"
					:quest-title="quest.title"
					:quest-reward="quest.reward"
					:disabled="!step.isCurrentQuest || !step.isUnlocked"
					@submitted="emit('submitted')"
				/>
			</template>

			<template v-else-if="category === 'order_items'">
				<UserQuestStepOrderer
					:step="step"
					:quest-id="quest.id"
					:quest-title="quest.title"
					:quest-reward="quest.reward"
					:disabled="!step.isCurrentQuest || !step.isUnlocked"
					@submitted="emit('submitted')"
				/>
			</template>

			<template v-else-if="readTimeProgress">
				<div class="flex w-full max-w-md flex-col items-center gap-4 py-8">
					<UIcon
						name="i-lucide-book-open-text"
						class="size-10 text-primary"
					/>
					<p class="m-0! text-center text-sm! opacity-80">
						Keep reading to complete this step — your time is tracked automatically.
					</p>
					<div class="flex w-full flex-col gap-1">
						<UProgress
							:model-value="readTimeProgress.accumulated"
							:max="readTimeProgress.target"
							color="primary"
							size="md"
						/>
						<div class="flex justify-between text-xs! opacity-70">
							<span>{{ formatReadTime(readTimeProgress.accumulated) }} read</span>
							<span>{{ formatReadTime(readTimeProgress.target) }} goal</span>
						</div>
					</div>
				</div>
			</template>

			<template v-else>
				<div class="flex flex-col items-center gap-3 py-8 text-center opacity-60">
					<UIcon
						name="i-lucide-info"
						class="size-10"
					/>
					<span class="text-sm!">This step is completed through its dedicated interface.</span>
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
import { extractServerMessage } from 'errors';
import { DateTime } from 'luxon';

const celebration = useQuestCelebration();

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
		isUnlocked: boolean;
	};
	serverRequest?: typeof makeServerRequest;
}>();

const emit = defineEmits<{
	submitted: [];
}>();

const { user, avatar128 } = useAuth(props.serverRequest || makeServerRequest);
const userId = computed(() => user.value?.id);
const { quest: activeQuest } = useUser(userId, props.serverRequest || makeServerRequest);
const { lat, lng, fetchLocation } = useQuestGeolocation();

function formatReadTime(totalSeconds: number): string {
	const s = Math.max(0, Math.round(totalSeconds));
	const m = Math.floor(s / 60);
	const sec = s % 60;
	if (m > 0) return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
	return `${sec}s`;
}

const readTimeProgress = computed(() => {
	if (!props.step.type.endsWith('_read_time')) return null;
	if (!activeQuest.value) return null;
	if (activeQuest.value?.questId !== props.quest.id) return null;
	const entry = activeQuest.value?.activeReadTime?.find(
		(r) =>
			r.stepIndex === props.step.index &&
			(r.altIndex ?? undefined) === (props.step.altIndex ?? undefined)
	);
	if (!entry) return null;
	const target =
		entry.targetSeconds ||
		(typeof props.step.parameters?.[1] === 'number' ? (props.step.parameters[1] as number) : 0);
	if (!target) return null;
	const accumulated = Math.min(entry.accumulatedSeconds, target);
	return { accumulated, target };
});

const submitting = ref(false);
const succeeded = ref(false);
const submitError = ref('');

// quest-author-provided coaching string. trim/whitespace check so empty fields
// from the editor never render an empty box.
const tutorialHint = computed(() => {
	const raw = (props.step as { tutorial_hint?: string }).tutorial_hint;
	return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
});
const hintDismissed = ref(false);

const submittingMessages = [
	'Submitting...',
	'Validating your work...',
	'Checking the map...',
	'Consulting the rulebook...',
	'Reviewing the details...',
	'Counting the rewards...',
	'Polishing the result...',
	'Almost there...'
];
const submittingMessage = ref(submittingMessages[0]);
let submittingInterval: ReturnType<typeof setInterval> | null = null;

watch(submitting, (loading) => {
	if (loading) {
		let i = 0;
		submittingMessage.value = submittingMessages[0];
		submittingInterval = setInterval(() => {
			i = (i + 1) % submittingMessages.length;
			submittingMessage.value = submittingMessages[i];
		}, 1800);
	} else if (submittingInterval) {
		clearInterval(submittingInterval);
		submittingInterval = null;
	}
});

onBeforeUnmount(() => {
	if (submittingInterval) clearInterval(submittingInterval);
});

const stepMobileOnly = computed(
	() => props.step.mobile_only === true || props.quest.mobile_only === true
);

const audioMinLength = computed<number | undefined>(() => {
	const raw = props.step.parameters?.[2];
	return typeof raw === 'number' && raw > 0 ? raw : undefined;
});

const category = computed(() => {
	switch (props.step.type) {
		case 'take_photo_location':
		case 'take_photo_classification':
		case 'take_photo_caption':
		case 'take_photo_objects':
		case 'take_photo_list':
		case 'take_photo_validation':
			return 'photo';
		case 'draw_picture':
			return 'draw_picture';
		case 'transcribe_audio':
			return 'audio';
		case 'match_terms':
			return 'match_terms';
		case 'order_items':
			return 'order_items';
		case 'describe_text':
			return 'describe_text';
		default:
			return props.step.type;
	}
});

onMounted(() => {
	if (props.quest.permissions?.includes('location')) {
		fetchLocation();
	}
});

// wrap the server request so a failed step submit exposes its HTTP status
function createStatusTrackingRequest() {
	const base = props.serverRequest || makeServerRequest;
	const state = { failed: false, status: null as number | null };
	async function request<T>(
		key: string | null,
		suburl: string,
		token: string | null | undefined = null,
		options: any = {}
	) {
		const res = await base<T>(key, suburl, token, options);
		state.failed = !res.success;
		state.status = res.success ? null : ((res as { status?: number }).status ?? null);
		return res;
	}
	return { request, state };
}

// descriptive, reassuring failure copy keyed off the HTTP status
function describeSubmitFailure(
	res: { message: string },
	state: { failed: boolean; status: number | null },
	validationFallback: string
): string {
	// server (5xx) or transport (no response) failure: reassure the user nothing was lost
	if (state.failed && (state.status === null || state.status >= 500)) {
		const code = state.status;
		return `The server had a problem saving this step${
			code ? ` (error ${code})` : ''
		}. Your progress wasn't lost - please try again in a moment.`;
	}

	// 4xx client errors + HTTP-200 validation misses: surface the server's short reason
	return extractServerMessage(res.message, validationFallback);
}

async function submitPhoto(file: File) {
	// guard against duplicate dispatch if the user double-clicks before we set submitting
	if (submitting.value) return;
	submitting.value = true;
	submitError.value = '';

	const tracker = createStatusTrackingRequest();
	const { updateQuest } = useUser(userId, tracker.request);

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
			if (res.completed) {
				celebration.triggerCelebration({
					questId: props.quest.id,
					questTitle: props.quest.title,
					points: props.quest.reward ?? 0
				});
			}
			await new Promise((r) => setTimeout(r, 900));
			emit('submitted');
		} else {
			submitError.value = describeSubmitFailure(
				res,
				tracker.state,
				'Validation failed. Please retake the photo.'
			);
		}
	} catch (e: any) {
		submitError.value = extractServerMessage(e, 'Submission failed. Please try again.');
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

const migratedMessage = computed(() => {
	const m = progress.value?.migrated;
	if (!m) return null;
	const at = DateTime.fromMillis(m.at).toLocaleString(DateTime.DATE_MED);
	const reasonText: Record<string, string> = {
		type_changed: `This step's requirements changed on ${at}; the original submission is no longer available.`,
		params_changed: `This step was adjusted on ${at}; the original submission is no longer available.`,
		step_removed: `This step was removed from the quest on ${at}.`,
		alt_removed: `This alternative was removed from the quest on ${at}.`,
		quest_deleted: `This quest is no longer available.`
	};
	return reasonText[m.reason] ?? `This step was migrated on ${at}.`;
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
