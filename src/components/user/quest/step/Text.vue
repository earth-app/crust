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
			Paste and copy are disabled for this step - please type your answer yourself.
		</p>

		<div
			v-if="dictationAvailable && !props.disabled"
			class="flex items-center justify-between px-1!"
		>
			<button
				type="button"
				class="flex items-center gap-2 px-3! py-1.5! rounded-full! text-xs! font-medium! transition-colors duration-150"
				:class="
					listening
						? 'bg-red-500 text-white animate-pulse'
						: 'bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 active:bg-primary/30'
				"
				:aria-label="listening ? 'Stop dictation' : 'Dictate your answer'"
				@click="toggleDictation"
			>
				<UIcon
					:name="listening ? 'mdi:microphone-off' : 'mdi:microphone'"
					class="size-4"
				/>
				<span>{{ listening ? 'Listening… tap to stop' : 'Speak your answer' }}</span>
			</button>
			<span
				v-if="liveCaption"
				class="text-xs! text-muted italic truncate max-w-[60%]"
				aria-live="polite"
			>
				"{{ liveCaption }}"
			</span>
		</div>

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
	// host-supplied speech recognizer; falls back to Web SpeechRecognition
	nativeStt?: NativeSttTransport;
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
		description: 'This step requires your own writing - please type your answer directly.',
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

// goes through the v-model ref so length/submitError/resize all stay reactive
function insertText(chunk: string) {
	const next = (text.value + (chunk || '')).slice(0, maxLength.value);
	if (next === text.value) return;
	text.value = next;
}

function replaceText(value: string) {
	text.value = (value || '').slice(0, maxLength.value);
}

function clearText() {
	text.value = '';
}

defineExpose({ insertText, replaceText, clearText, focus: () => textareaEl.value?.focus() });

// dictation: prop-supplied native transport wins, else fall back to Web SpeechRecognition
type Transport = 'native' | 'web' | 'none';
const transport = ref<Transport>('none');
const dictationAvailable = ref(false);
const listening = ref(false);
const liveCaption = ref('');
let sessionCommitted = '';

interface WebRecognitionLike {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	start(): void;
	stop(): void;
	abort(): void;
	onresult: ((e: any) => void) | null;
	onerror: ((e: any) => void) | null;
	onend: ((e: any) => void) | null;
}
let webRecognition: WebRecognitionLike | null = null;

function getWebRecognitionCtor(): { new (): WebRecognitionLike } | null {
	if (!import.meta.client) return null;
	const w = window as unknown as {
		SpeechRecognition?: { new (): WebRecognitionLike };
		webkitSpeechRecognition?: { new (): WebRecognitionLike };
	};
	return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

onMounted(async () => {
	if (!import.meta.client) return;

	if (props.nativeStt) {
		try {
			if (await props.nativeStt.isAvailable()) {
				transport.value = 'native';
				dictationAvailable.value = true;
				return;
			}
		} catch {
			// fall through to web
		}
	}

	if (getWebRecognitionCtor()) {
		transport.value = 'web';
		dictationAvailable.value = true;
	}
});

function commitChunk(rawChunk: string) {
	if (!rawChunk) return;
	const chunk =
		sessionCommitted.length > 0 && !sessionCommitted.endsWith(' ')
			? ` ${rawChunk.trimStart()}`
			: rawChunk;
	sessionCommitted += chunk;
	insertText(chunk);
}

async function startNative() {
	const nativeStt = props.nativeStt;
	if (!nativeStt) return;

	const granted = await nativeStt.requestPermission();
	if (!granted) return; // host already surfaced the rejection

	try {
		await nativeStt.start({
			language: navigator.language || 'en-US',
			onPartial: (partial: string) => {
				liveCaption.value = partial;
			},
			onFinal: (final: string) => {
				const caption = (final || liveCaption.value).trim();
				if (caption) commitChunk(caption);
				liveCaption.value = '';
				listening.value = false;
			}
		});
		listening.value = true;
		sessionCommitted = '';
	} catch (err: any) {
		listening.value = false;
		toast.add({
			title: 'Could not start dictation',
			description: err?.message || 'Try again or use the keyboard.',
			color: 'error',
			duration: 4000
		});
	}
}

async function stopNative() {
	try {
		await props.nativeStt?.stop();
	} catch {
		// already stopped
	}
}

function startWeb() {
	const Ctor = getWebRecognitionCtor();
	if (!Ctor) return;

	const rec: WebRecognitionLike = new Ctor();
	rec.continuous = true;
	rec.interimResults = true;
	rec.lang = navigator.language || 'en-US';

	rec.onresult = (event: any) => {
		let interim = '';
		let newlyFinal = '';
		for (let i = 0; i < event.results.length; i++) {
			const result = event.results[i];
			const transcript = result[0]?.transcript ?? '';
			if (result.isFinal) {
				if (!sessionCommitted.includes(transcript)) newlyFinal += transcript;
			} else {
				interim += transcript;
			}
		}
		if (newlyFinal) commitChunk(newlyFinal);
		liveCaption.value = interim.trim();
	};

	rec.onerror = (err: any) => {
		const error = err?.error;
		if (error && error !== 'no-speech' && error !== 'aborted') {
			toast.add({
				title: 'Dictation error',
				description: String(error),
				color: 'error',
				duration: 4000
			});
		}
		stopWeb();
	};

	rec.onend = () => {
		listening.value = false;
		liveCaption.value = '';
	};

	try {
		rec.start();
		webRecognition = rec;
		listening.value = true;
		sessionCommitted = '';
	} catch (err: any) {
		toast.add({
			title: 'Could not start dictation',
			description: err?.message || 'Try again or use the keyboard.',
			color: 'error',
			duration: 4000
		});
	}
}

function stopWeb() {
	if (webRecognition) {
		try {
			webRecognition.stop();
		} catch {
			// already stopped
		}
		webRecognition = null;
	}
	listening.value = false;
	liveCaption.value = '';
}

function toggleDictation() {
	if (listening.value) {
		if (transport.value === 'native') void stopNative();
		else stopWeb();
		return;
	}
	if (transport.value === 'native') void startNative();
	else startWeb();
}

onBeforeUnmount(() => {
	if (transport.value === 'native') {
		void stopNative();
	} else {
		stopWeb();
	}
});

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
			// text stays in place - host unmounts the component on success
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
