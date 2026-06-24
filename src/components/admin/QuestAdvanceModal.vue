<template>
	<UModal
		:open="open"
		:dismissible="!busy"
		title="Advance Quest Step"
		@update:open="(v: boolean) => !v && emit('update:open', false)"
	>
		<template #content>
			<div class="p-6 flex flex-col gap-3 max-w-lg">
				<p class="text-sm text-muted">
					Submit step <span class="font-mono">#{{ stepIndex + 1 }}</span> on behalf of
					<span class="font-mono">@{{ username }}</span
					>. The step delay is waived and mobile checks are bypassed; AI-validated steps still
					require genuine passing media.
				</p>

				<!-- alternate picker when the current step is an alt-group -->
				<UFormField
					v-if="alts.length > 1"
					label="Alternate"
				>
					<USelect
						v-model="altIndex"
						:items="altItems"
						:disabled="busy"
					/>
				</UFormField>

				<div class="flex items-center gap-2">
					<UIcon
						:name="getStepIcon(stepType)"
						class="size-5"
					/>
					<span class="font-medium">{{ prettyType(stepType) }}</span>
				</div>

				<div
					v-if="isDisabled"
					class="text-sm text-warning rounded border border-warning/40 bg-warning/10 p-3"
				>
					This step type cannot be advanced by an admin — it must be completed by the user in-app
					(quiz scores and read-time counters are tracked server-side).
				</div>

				<template v-else>
					<!-- event steps -->
					<template v-if="isEventType">
						<UFormField label="Event ID (optional)">
							<UInput
								v-model="eventId"
								placeholder="event id"
								:disabled="busy"
							/>
						</UFormField>
						<UFormField
							v-if="stepType === 'submit_event_image'"
							label="Score (optional)"
						>
							<UInput
								v-model.number="score"
								type="number"
								:disabled="busy"
							/>
						</UFormField>
					</template>

					<!-- distance -->
					<UFormField
						v-else-if="stepType === 'distance_covered'"
						label="Distance (meters)"
					>
						<UInput
							v-model.number="distance"
							type="number"
							:disabled="busy"
						/>
					</UFormField>

					<!-- barcode -->
					<template v-else-if="stepType === 'scan_barcode'">
						<UFormField label="Scan value">
							<UInput
								v-model="barcodeValue"
								placeholder="e.g. 9780131103627"
								:disabled="busy"
							/>
						</UFormField>
						<UFormField label="Capacitor format">
							<UInput
								v-model.number="barcodeFormat"
								type="number"
								:disabled="busy"
							/>
						</UFormField>
					</template>

					<!-- free text -->
					<UFormField
						v-else-if="stepType === 'describe_text' || stepType === 'respond_to_prompt'"
						label="Text"
					>
						<UTextarea
							v-model="text"
							:rows="4"
							placeholder="Response text"
							:disabled="busy"
						/>
					</UFormField>

					<!-- media upload (photos / drawings / audio) -->
					<UFormField
						v-else-if="isUploadType"
						:label="stepType === 'transcribe_audio' ? 'Audio file' : 'Image file'"
					>
						<input
							type="file"
							:accept="stepType === 'transcribe_audio' ? 'audio/*' : 'image/*'"
							:disabled="busy"
							class="text-sm"
							@change="onFile"
						/>
						<p class="text-xs text-muted mt-1">
							Cloud validation (classification / scoring) must still pass.
						</p>
					</UFormField>

					<!-- match_terms / order_items — no payload -->
					<p
						v-else
						class="text-sm text-muted"
					>
						This step requires no submission data.
					</p>
				</template>

				<div class="flex gap-2 justify-end mt-1">
					<UButton
						variant="ghost"
						color="neutral"
						:disabled="busy"
						@click="emit('update:open', false)"
						>Cancel</UButton
					>
					<UButton
						color="primary"
						icon="mdi:fast-forward"
						:loading="busy"
						:disabled="busy || isDisabled || !canSubmit"
						@click="submit"
						>Advance Step</UButton
					>
				</div>
			</div>
		</template>
	</UModal>
</template>

<script setup lang="ts">
const props = defineProps<{
	open: boolean;
	userId: string;
	username: string;
	stepIndex: number;
	stepDef?: QuestStep | QuestStep[];
}>();

const emit = defineEmits<{
	(event: 'update:open', value: boolean): void;
	(event: 'advanced'): void;
}>();

const authStore = useAuthStore();
const toast = useToast();
const { getStepIcon } = useQuests();

const DISABLED_TYPES = ['article_quiz', 'article_read_time', 'activity_read_time'];
const EVENT_TYPES = ['attend_event', 'submit_event_image'];
const UPLOAD_TYPES = [
	'take_photo_location',
	'take_photo_classification',
	'take_photo_caption',
	'take_photo_objects',
	'take_photo_validation',
	'take_photo_list',
	'draw_picture',
	'transcribe_audio'
];

const alts = computed<QuestStep[]>(() =>
	props.stepDef ? (Array.isArray(props.stepDef) ? props.stepDef : [props.stepDef]) : []
);
const altItems = computed(() =>
	alts.value.map((s, i) => ({ label: `${i + 1}. ${prettyType(s.type)}`, value: i }))
);
const altIndex = ref(0);

// reset transient inputs whenever the modal (re)opens
watch(
	() => props.open,
	(v) => {
		if (v) {
			altIndex.value = 0;
			eventId.value = '';
			score.value = null;
			distance.value = null;
			barcodeValue.value = '';
			barcodeFormat.value = 0;
			text.value = '';
			dataUrl.value = '';
		}
	}
);

const stepType = computed(() => alts.value[altIndex.value]?.type ?? 'attend_event');
const isAltStep = computed(() => Array.isArray(props.stepDef));

const isDisabled = computed(() => DISABLED_TYPES.includes(stepType.value));
const isEventType = computed(() => EVENT_TYPES.includes(stepType.value));
const isUploadType = computed(() => UPLOAD_TYPES.includes(stepType.value));

const eventId = ref('');
const score = ref<number | null>(null);
const distance = ref<number | null>(null);
const barcodeValue = ref('');
const barcodeFormat = ref(0);
const text = ref('');
const dataUrl = ref('');
const busy = ref(false);

const canSubmit = computed(() => {
	if (stepType.value === 'scan_barcode') return barcodeValue.value.trim().length > 0;
	if (stepType.value === 'describe_text') return text.value.trim().length > 0;
	if (isUploadType.value) return dataUrl.value.length > 0;
	if (stepType.value === 'distance_covered') return typeof distance.value === 'number';
	return true;
});

function prettyType(type: string): string {
	return type
		.split('_')
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}

function onFile(e: Event) {
	const file = (e.target as HTMLInputElement).files?.[0];
	if (!file) return;
	const reader = new FileReader();
	reader.onload = () => (dataUrl.value = String(reader.result || ''));
	reader.readAsDataURL(file);
}

async function submit() {
	busy.value = true;
	try {
		const response: Record<string, any> = {
			type: stepType.value,
			index: props.stepIndex
		};
		if (isAltStep.value) response.altIndex = altIndex.value;

		if (isEventType.value) {
			if (eventId.value.trim()) response.eventId = eventId.value.trim();
			response.timestamp = Date.now();
			if (stepType.value === 'submit_event_image' && typeof score.value === 'number')
				response.score = score.value;
		} else if (stepType.value === 'distance_covered') {
			response.distance = distance.value ?? 0;
		} else if (stepType.value === 'scan_barcode') {
			response.data = barcodeValue.value.trim();
			response.format = barcodeFormat.value || 0;
		} else if (stepType.value === 'describe_text' || stepType.value === 'respond_to_prompt') {
			if (text.value.trim()) response.text = text.value.trim();
		} else if (isUploadType.value) {
			response.dataUrl = dataUrl.value;
		}

		const res = await makeServerRequest<{
			message: string;
			completed: boolean;
			validated: boolean;
		}>(null, `/api/admin/quest/${props.userId}/advance`, authStore.sessionToken, {
			method: 'POST',
			body: { response }
		});

		if (res.success) {
			toast.add({
				title: res.data?.completed ? 'Quest Completed' : 'Step Advanced',
				description: `Step #${props.stepIndex + 1} submitted for @${props.username}`,
				icon: 'mdi:fast-forward',
				color: 'success',
				duration: 3000
			});
			emit('advanced');
			emit('update:open', false);
		} else {
			toast.add({
				title: 'Advance Failed',
				description: res.message || 'Cloud rejected the submission.',
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 5000
			});
		}
	} finally {
		busy.value = false;
	}
}
</script>
