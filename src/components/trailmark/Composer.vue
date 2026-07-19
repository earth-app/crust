<template>
	<div class="flex flex-col gap-3 p-4 rounded-xl border border-primary/25 bg-primary/5">
		<div class="flex items-center gap-2">
			<UIcon
				:name="promptId ? 'mdi:comment-quote-outline' : 'mdi:message-plus-outline'"
				class="size-5 text-primary"
			/>
			<h3 class="font-semibold text-base">
				{{ promptId ? 'Answer From Where You Are' : 'Leave a Note' }}
			</h3>
		</div>
		<p class="text-sm opacity-75">
			{{
				promptId
					? "Answer today's prompt from outside. Your note is left at this spot and shared under the prompt. Notes are gently checked before they post."
					: 'Leave something kind for the next person who passes this spot. Notes are gently checked before they post.'
			}}
		</p>

		<UTextarea
			v-model="note"
			:rows="3"
			:maxlength="maxNote"
			autoresize
			placeholder="You made it here. Take a breath and look up."
		/>
		<div class="flex justify-end text-xs opacity-60">{{ note.length }} / {{ maxNote }}</div>

		<UInput
			v-model="place"
			icon="mdi:map-marker-outline"
			:maxlength="80"
			placeholder="Name this spot (Optional)"
		/>

		<div class="flex items-center gap-2 text-xs">
			<UIcon
				:name="locationReady ? 'mdi:crosshairs-gps' : 'mdi:crosshairs-question'"
				class="size-4"
				:class="locationReady ? 'text-success' : 'opacity-60'"
			/>
			<span
				v-if="locationReady"
				class="text-success"
				>Location Ready</span
			>
			<span
				v-else-if="locationError"
				class="text-error"
				>{{ locationError }}</span
			>
			<span
				v-else
				class="opacity-60"
				>Detecting Your Location...</span
			>
			<UButton
				variant="link"
				size="xs"
				color="primary"
				class="ml-auto"
				@click="fetchLocation"
				>Use My Location</UButton
			>
		</div>

		<UButton
			color="primary"
			block
			icon="mdi:send-variant-outline"
			:loading="busy"
			:disabled="!canPost"
			@click="post"
			>Post Note</UButton
		>
	</div>
</template>

<script setup lang="ts">
const props = defineProps<{
	// when set, the note is also surfaced under this prompt as a 'from outside' answer
	promptId?: string;
}>();

const emit = defineEmits<{
	created: [id: string];
}>();

const { leaveNote, maxNote } = useTrailmarks();
const { lat, lng, error: locationError, fetchLocation } = useQuestGeolocation();
const toast = useToast();

const note = ref('');
const place = ref('');
const busy = ref(false);

const locationReady = computed(() => lat.value !== null && lng.value !== null);
const canPost = computed(() => !busy.value && !!note.value.trim() && locationReady.value);

async function post() {
	if (!canPost.value) return;
	busy.value = true;
	try {
		const res = await leaveNote({
			geo: {
				lat: lat.value as number,
				lng: lng.value as number,
				...(place.value.trim() ? { place_label: place.value.trim() } : {})
			},
			note: note.value,
			...(props.promptId ? { prompt_id: props.promptId } : {})
		});

		if (res.success && res.data) {
			toast.add({
				title: 'Note Posted',
				description: 'Thanks for leaving a little light behind you.',
				icon: 'mdi:message-check-outline',
				color: 'success',
				duration: 3000
			});
			note.value = '';
			place.value = '';
			emit('created', res.data.id);
		} else {
			toast.add({
				title: 'Could Not Post',
				description: res.error,
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 4000
			});
		}
	} finally {
		busy.value = false;
	}
}

onMounted(() => {
	fetchLocation();
});
</script>
