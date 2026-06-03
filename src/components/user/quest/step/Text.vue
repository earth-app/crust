<template>
	<div class="flex flex-col w-full! gap-3! select-none!">
		<textarea
			ref="textareaEl"
			v-model="text"
			:disabled="props.disabled || submitting"
			:maxlength="maxLength"
			placeholder="Type your answer here..."
			class="w-full! min-h-32! max-h-[60vh]! p-3! rounded-xl! border-2! text-sm! font-medium! transition-all duration-150 resize-none overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50!"
			@paste.prevent="onClipboardBlocked('paste')"
			@copy.prevent="onClipboardBlocked('copy')"
			@cut.prevent="onClipboardBlocked('cut')"
			@contextmenu.prevent
			@drop.prevent="onClipboardBlocked('drop')"
		/>
		<p class="text-xs! text-muted px-1!">
			Paste and copy are disabled for this step — please type your answer yourself.
		</p>

		<div
			class="flex items-center justify-between text-xs! px-1!"
			:class="charCountClass"
		>
			<span v-if="length < minLength"> At least {{ minLength }} characters required. </span>
			<span v-else-if="length > maxLength"> Over by {{ length - maxLength }} character(s). </span>
			<span v-else>Looks good.</span>
			<span class="tabular-nums">{{ length }} / {{ maxLength }}</span>
		</div>

		<UAlert
			v-if="submitError"
			color="error"
			variant="soft"
			icon="i-lucide-triangle-alert"
			:description="submitError"
			class="w-full"
		/>

		<button
			class="mt-2! px-5! py-2! rounded-xl! font-semibold! text-sm! transition-all! flex items-center justify-center gap-2!"
			:class="
				canSubmit
					? 'bg-success text-neutral-900 active:scale-95 cursor-pointer'
					: 'bg-success/30 text-neutral-600 cursor-not-allowed'
			"
			:disabled="!canSubmit"
			@click="onSubmit"
		>
			<UIcon
				v-if="submitting"
				name="i-lucide-loader-circle"
				class="size-4 animate-spin"
			/>
			<span>{{ submitting ? 'Validating…' : 'Submit' }}</span>
		</button>
	</div>
</template>

<script setup lang="ts">
interface Props {
	step?: QuestStep & {
		index: number;
		altIndex?: number;
	};
	disabled?: boolean;
	submit?: boolean;
	serverRequest?: typeof makeServerRequest;
}

const props = withDefaults(defineProps<Props>(), { submit: true });

const emit = defineEmits<{
	submitted: [];
	capture: [text: string];
}>();

// hard window enforced by cloud; UI mirrors it so the user never types into a
// state the server would reject for length alone.
const TEXT_FLOOR = 50;
const TEXT_CEILING = 2048;
const clampLen = (n: number) => Math.min(TEXT_CEILING, Math.max(TEXT_FLOOR, Math.floor(n)));

const minLength = computed(() => {
	const raw = props.step?.parameters?.[2];
	return typeof raw === 'number' && Number.isFinite(raw) ? clampLen(raw) : 200;
});
const maxLength = computed(() => {
	const raw = props.step?.parameters?.[3];
	const candidate = typeof raw === 'number' && Number.isFinite(raw) ? clampLen(raw) : TEXT_CEILING;
	// guarantee max >= min so the input never collapses to an unsatisfiable range
	return Math.max(minLength.value, candidate);
});

const text = ref('');
const submitting = ref(false);
const submitError = ref('');

const toast = useToast();
let lastClipboardToastAt = 0;
function onClipboardBlocked(action: 'paste' | 'copy' | 'cut' | 'drop') {
	// throttle to once every 1.5s so a stuck cmd-V doesn't spam toasts
	const now = Date.now();
	if (now - lastClipboardToastAt < 1500) return;
	lastClipboardToastAt = now;
	const verb =
		action === 'paste'
			? 'Pasting'
			: action === 'copy'
				? 'Copying'
				: action === 'cut'
					? 'Cutting'
					: 'Dropping text';
	toast.add({
		title: `${verb} is Disabled`,
		description: 'This step requires your own writing — please type your answer directly.',
		icon: 'mdi:content-paste-off',
		color: 'warning',
		duration: 3000
	});
}

const length = computed(() => text.value.trim().length);
const inRange = computed(() => length.value >= minLength.value && length.value <= maxLength.value);
const canSubmit = computed(() => !props.disabled && !submitting.value && inRange.value);

const charCountClass = computed(() => {
	if (length.value < minLength.value) return 'text-neutral-500';
	if (length.value > maxLength.value) return 'text-red-400';
	return 'text-success';
});

// auto-grow: reset to auto, then snap to scrollHeight so the box matches content
const textareaEl = ref<HTMLTextAreaElement | null>(null);
function resize() {
	const el = textareaEl.value;
	if (!el) return;
	el.style.height = 'auto';
	el.style.height = `${el.scrollHeight}px`;
}
watch(text, () => {
	submitError.value = '';
	nextTick(resize);
});
onMounted(resize);

const { user } = useAuth(props.serverRequest || makeServerRequest);
const userId = computed(() => user.value?.id);
const { updateQuest } = useUser(userId, props.serverRequest || makeServerRequest);
const { lat, lng } = useQuestGeolocation();

async function onSubmit() {
	if (!canSubmit.value) return;
	const trimmed = text.value.trim();

	// always surface the trimmed text in case a host wants it (matches the older capture contract)
	emit('capture', trimmed);

	if (props.submit === false) {
		emit('submitted');
		return;
	}

	if (!props.step) {
		submitError.value = 'Missing step context.';
		return;
	}

	if (!userId.value) {
		submitError.value = 'Your account is still loading. Please try again in a moment.';
		return;
	}

	submitError.value = '';
	submitting.value = true;
	try {
		const res = await updateQuest(
			{
				type: props.step.type,
				index: props.step.index,
				...(props.step.altIndex !== undefined ? { altIndex: props.step.altIndex } : {}),
				text: trimmed
			},
			lat.value,
			lng.value
		);
		if (res.validated) {
			await new Promise((r) => setTimeout(r, 600));
			emit('submitted');
			// text stays in place — host unmounts the component on success
		} else {
			submitError.value = res.message || 'We could not validate your response. Please try again.';
		}
	} catch (e: any) {
		submitError.value =
			e?.data?.message || e?.statusMessage || e?.message || 'Submission failed. Please try again.';
	} finally {
		submitting.value = false;
	}
}
</script>
