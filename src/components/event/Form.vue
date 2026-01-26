<template>
	<UForm
		:state="state"
		class="space-y-4"
		@submit="handleSubmit"
	>
		<div
			v-if="error"
			class="p-4 bg-red-100 border border-red-400 text-red-700 rounded"
		>
			{{ error }}
		</div>

		<UFormField
			label="Name"
			name="name"
			class="min-w-60 w-3/5"
			help="Maximum 50 characters"
			required
		>
			<UInput
				v-model="state.name"
				placeholder="Enter event name"
				class="w-full"
				:disabled="loading"
				:maxlength="50"
			/>
		</UFormField>

		<UFormField
			label="Description"
			name="description"
			class="w-4/5"
			help="Maximum 3000 characters"
		>
			<UTextarea
				v-model="state.description"
				placeholder="Enter site description"
				class="w-full"
				:rows="3"
				:disabled="loading"
				:maxlength="3000"
			/>
		</UFormField>

		<UFormField
			label="Type"
			name="type"
			class="w-1/5"
			help="Select the type of event"
			required
		>
			<USelect
				icon="mdi:calendar-text"
				v-model="state.type"
				:items="[
					{ label: 'In Person', icon: 'mdi:account-group', value: 'IN_PERSON' },
					{ label: 'Online', icon: 'mdi:web', value: 'ONLINE' },
					{ label: 'Hybrid', icon: 'mdi:laptop-account', value: 'HYBRID' }
				]"
				class="w-full"
				:disabled="loading"
			/>
		</UFormField>

		<UFormField
			label="Activities"
			name="activities"
			class="w-4/5"
			help="Select activities for this event to improve recommendations"
		>
			<ActivitySelector
				v-model="state.activities"
				class="w-full"
				:include-activity-types="true"
			/>
		</UFormField>

		<EventLocation
			v-if="state.type !== 'ONLINE'"
			v-model="state.location"
			:fields="state.fields"
			@update:fields="state.fields = $event"
		/>

		<EventThumbnailEditor
			:thumbnail-url-prop="thumbnail || undefined"
			@update:thumbnail="thumbnailUrlFromEditor = $event"
			@update:thumbnailFile="thumbnailFile = $event"
		/>

		<UFormField
			label="Additional Event Details"
			name="fields"
			class="w-4/5"
			help="Configure additional event settings"
		>
			<div class="space-y-4 border rounded-md p-4">
				<UFormField
					v-if="state.type !== 'ONLINE'"
					label="Address"
					name="address"
					help="Auto-populated from location selection (max 255 characters)"
				>
					<UInput
						:modelValue="state.fields?.['address'] || ''"
						disabled
						placeholder="Select a location above to populate"
						:maxlength="255"
						class="w-1/2"
					/>
				</UFormField>

				<!-- Link -->
				<UFormField
					label="Event Link"
					name="link"
					help="Optional URL for event information or registration"
				>
					<UInput
						v-model="eventLink"
						placeholder="https://example.com/event"
						type="url"
						@update:modelValue="updateField('link', $event)"
						:color="eventLinkValid === false ? 'error' : undefined"
						class="w-1/2"
					/>
					<template
						#error
						v-if="eventLinkValid === false"
					>
						<span class="text-sm text-red-500">Please enter a valid URL</span>
					</template>
				</UFormField>

				<UFormField
					label="Additional Information"
					name="info"
					help="Extra details about the event (max 1000 characters)"
				>
					<UTextarea
						v-model="eventInfo"
						placeholder="Enter additional event information..."
						:rows="3"
						:maxlength="1000"
						@update:modelValue="updateField('info', $event)"
						class="w-2/3"
					/>
				</UFormField>

				<UFormField
					label="Max In-Person Attendees"
					name="max_in_person"
					:help="`Maximum in-person attendees (limit: ${maxEventAttendees.toLocaleString()})`"
				>
					<UInput
						v-model.number="maxInPerson"
						type="number"
						:min="0"
						:max="maxEventAttendees"
						placeholder="Enter maximum in-person attendees"
						@update:modelValue="updateField('max_in_person', $event)"
						:color="maxInPersonValid === false ? 'error' : undefined"
					/>
					<template
						#error
						v-if="maxInPersonValid === false"
					>
						<span class="text-sm text-red-500"
							>Cannot exceed your account limit of {{ maxEventAttendees.toLocaleString() }}</span
						>
					</template>
				</UFormField>

				<UFormField
					label="Max Online Attendees"
					name="max_online"
					:help="`Maximum online attendees (limit: ${maxEventAttendees.toLocaleString()})`"
				>
					<UInput
						v-model.number="maxOnline"
						type="number"
						:min="0"
						:max="maxEventAttendees"
						placeholder="Enter maximum online attendees"
						@update:modelValue="updateField('max_online', $event)"
						:color="maxOnlineValid === false ? 'error' : undefined"
					/>
					<template
						#error
						v-if="maxOnlineValid === false"
					>
						<span class="text-sm text-red-500"
							>Cannot exceed your account limit of {{ maxEventAttendees.toLocaleString() }}</span
						>
					</template>
				</UFormField>

				<UFormField
					label="Event Icon"
					name="icon"
					help="Optional custom icon name for this event"
				>
					<UInput
						v-model="eventIcon"
						placeholder="e.g., mdi:calendar-star"
						:icon="eventIcon || 'mdi:calendar'"
						@update:modelValue="updateField('icon', $event)"
					/>
				</UFormField>
			</div>
		</UFormField>

		<div class="flex gap-2 justify-end pt-4">
			<UButton
				type="submit"
				icon="mdi:content-save"
				:loading="loading"
				:disabled="loading"
			>
				{{ mode === 'create' ? 'Create Event' : 'Save Event Settings' }}
			</UButton>
		</div>
	</UForm>
</template>

<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';
import type { Event, EventActivity, EventData } from '~/shared/types/event';

const props = defineProps<{
	mode: 'create' | 'edit';
	event?: (Partial<EventData> & { id?: string }) | (Partial<Event> & { id?: string });
}>();

const emit = defineEmits<{
	submitted: [];
}>();

const { createEvent } = useEvents();
const { thumbnail, updateEvent, uploadThumbnail, deleteThumbnail } = useEvent(
	props.event?.id || ''
);
const { user } = useAuth();

const toast = useToast();

const loading = ref(false);
const error = ref('');

const thumbnailFile = ref<File | null>(null);
const thumbnailUrlFromEditor = ref<string>('');

const state = reactive<EventData>({
	name: props.event?.name || '',
	description: props.event?.description || '',
	type: props.event?.type || 'IN_PERSON',
	activities: (() => {
		try {
			if (!Array.isArray(props.event?.activities)) return [];

			return props.event.activities
				.map((activity: EventActivity | string) => {
					try {
						if (typeof activity === 'string') {
							// Legacy string format or already a string ID/type
							return activity;
						} else if (
							'type' in activity &&
							activity.type === 'activity_type' &&
							'value' in activity
						) {
							// Activity type
							return activity.value;
						} else if ('id' in activity) {
							// Actual activity
							return activity.id;
						}
					} catch (e) {
						console.warn('Error processing activity:', activity, e);
					}
					// Fallback - return nothing for unknown formats
					return null;
				})
				.filter((id): id is string => id !== null && id !== '');
		} catch (e) {
			console.error('Error initializing activities:', e);
			return [];
		}
	})(),
	location: {
		latitude: props.event?.location?.latitude || 0,
		longitude: props.event?.location?.longitude || 0
	},
	date: props.event?.date || Date.now(),
	end_date: props.event?.end_date || Date.now() + 3600000, // Default to 1 hour later
	visibility: props.event?.visibility || 'PUBLIC',
	fields: props.event?.fields || {}
});

// Field validation
const eventLink = ref(state.fields?.['link'] || '');
const eventLinkValid = ref<boolean | null>(null);

const eventInfo = ref(state.fields?.['info'] || '');

const maxInPerson = ref(state.fields?.['max_in_person'] || 0);
const maxInPersonValid = ref<boolean | null>(null);

const maxOnline = ref(state.fields?.['max_online'] || 0);
const maxOnlineValid = ref<boolean | null>(null);

const eventIcon = ref(state.fields?.['icon'] || '');

// Get max event attendees from user account
const maxEventAttendees = computed(() => {
	if (!user.value) return 1000;

	switch (user.value.account?.account_type) {
		case 'PRO':
		case 'WRITER':
			return 5000;
		case 'ORGANIZER':
			return 1_000_000;
		case 'ADMINISTRATOR':
			return Infinity;
		default:
			return 1000;
	}
});

// Validate link
watch(eventLink, (newValue) => {
	if (!newValue || newValue.trim() === '') {
		eventLinkValid.value = null;
		return;
	}

	try {
		new URL(newValue);
		eventLinkValid.value = true;
	} catch {
		eventLinkValid.value = false;
	}
});

// Validate max in person
watch(maxInPerson, (newValue) => {
	if (!newValue || newValue === 0) {
		maxInPersonValid.value = null;
		return;
	}

	maxInPersonValid.value = newValue <= maxEventAttendees.value;
});

// Validate max online
watch(maxOnline, (newValue) => {
	if (!newValue || newValue === 0) {
		maxOnlineValid.value = null;
		return;
	}

	maxOnlineValid.value = newValue <= maxEventAttendees.value;
});

function updateField(key: string, value: any) {
	if (!state.fields) {
		state.fields = {};
	}

	// Only set non-empty values
	if (value !== undefined && value !== null && value !== '') {
		state.fields[key] = value;
	} else {
		delete state.fields[key];
	}
}

async function handleSubmit(event: FormSubmitEvent<EventData>) {
	loading.value = true;
	error.value = '';

	// Validate before submitting
	if (eventLinkValid.value === false) {
		error.value = 'Please enter a valid URL for the event link';
		loading.value = false;
		toast.add({
			title: 'Validation Error',
			description: error.value,
			icon: 'mdi:alert-circle',
			color: 'error'
		});
		return;
	}

	if (maxInPersonValid.value === false || maxOnlineValid.value === false) {
		error.value = 'Attendee limits cannot exceed your account maximum';
		loading.value = false;
		toast.add({
			title: 'Validation Error',
			description: error.value,
			icon: 'mdi:alert-circle',
			color: 'error'
		});
		return;
	}

	try {
		if (props.mode === 'create') {
			await createEvent(event.data);
		} else {
			await updateEvent(event.data);
		}

		if (thumbnailFile.value) {
			const uploadRes = await uploadThumbnail(thumbnailFile.value);
			if (!uploadRes.success) {
				throw new Error(uploadRes.message || 'Failed to upload thumbnail');
			}
		} else if (thumbnailUrlFromEditor.value === '' && thumbnail.value) {
			const deleteRes = await deleteThumbnail();
			if (!deleteRes.success) {
				throw new Error(deleteRes.message || 'Failed to delete thumbnail');
			}
		}

		toast.add({
			title: props.mode === 'create' ? 'Event Created' : 'Event Updated',
			description: `${event.data.name} has been ${props.mode === 'create' ? 'created' : 'saved'} successfully.`,
			icon: 'material-symbols:settings',
			color: 'info'
		});

		emit('submitted');
	} catch (err: any) {
		error.value = err.message || 'An error occurred while saving settings';

		toast.add({
			title: 'Error',
			description: error.value,
			icon: 'mdi:alert-circle',
			color: 'error'
		});
	} finally {
		loading.value = false;
	}
}
</script>
