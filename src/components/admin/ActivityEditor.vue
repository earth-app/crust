<template>
	<div class="container mx-auto px-4 pb-8">
		<UButton
			v-if="!props.activity"
			color="secondary"
			class="text-white font-semibold"
			@click="generateActivity"
			:loading="generating"
			:disabled="generating"
		>
			Generate Activity...
		</UButton>
		<div class="my-4 flex flex-col gap-4">
			<h1>Settings</h1>
			<UInput
				v-model="activityName"
				placeholder="Activity Name"
				label="Activity Name"
				@keyup.enter="(event: Event) => (activityName = (event.target as HTMLInputElement).value)"
			/>
			<UTextarea
				v-model="activityDescription"
				placeholder="Activity Description"
				label="Activity Description"
				:ui="{ base: 'h-36' }"
				@keyup.enter="
					(event: Event) => (activityDescription = (event.target as HTMLInputElement).value)
				"
			/>
			<h1>Activity Types (up to 5)</h1>
			<div class="flex gap-4 *:w-44">
				<USelect
					v-model="activityType1"
					:items="typeItems"
				/>
				<USelect
					v-model="activityType2"
					:items="typeItems"
				/>
				<USelect
					v-model="activityType3"
					:items="typeItems"
				/>
			</div>
			<div class="flex gap-6 *:w-68">
				<USelect
					v-model="activityType4"
					:items="typeItems"
				/>
				<USelect
					v-model="activityType5"
					:items="typeItems"
				/>
			</div>
			<h1>Activity Aliases (separated by commas)</h1>
			<UInput
				v-model="activityAliases"
				placeholder="Activity Aliases"
				label="Activity Aliases"
				@keyup.enter="
					(event: Event) => (activityAliases = (event.target as HTMLInputElement).value)
				"
			/>
			<h1>Activity Fields</h1>
			<div class="flex flex-col items-center max-h-44 overflow-y-auto justify-around gap-y-2">
				<div
					v-for="(value, key) in activityFields"
					:key="key"
					class="flex items-center gap-2"
				>
					<UInput
						:model-value="key"
						placeholder="Field name"
						label="Field Name"
						@update:model-value="(newKey: string) => updateFieldKey(key, newKey)"
						@keyup.enter="
							(event: Event) => updateFieldKey(key, (event.target as HTMLInputElement).value)
						"
					/>
					<UInput
						v-model="activityFields[key]"
						:placeholder="`Value for ${key}`"
						:label="`Field Value`"
						@keyup.enter="
							(event: Event) => (activityFields[key] = (event.target as HTMLInputElement).value)
						"
					/>
					<UIcon
						name="material-symbols:delete-outline"
						class="size-6 text-red-500 cursor-pointer hover:scale-105 transition-transform duration-300"
						@click="deleteField(key)"
					/>
				</div>
				<div class="flex items-center gap-2 mt-2">
					<UInput
						v-model="newFieldKey"
						placeholder="Field name"
						label="New Field Name"
						@keyup.enter="addField"
					/>
					<UInput
						v-model="newFieldValue"
						placeholder="Field value"
						label="New Field Value"
						@keyup.enter="addField"
					/>
					<UButton
						color="secondary"
						@click="addField"
						:disabled="!newFieldKey.trim()"
					>
						Add Field
					</UButton>
				</div>
			</div>
		</div>
		<UButton
			color="primary"
			@click="
				if (props.activity) {
					updateActivity();
				} else {
					createActivity();
				}
			"
			:loading="loading"
			:disabled="loading"
		>
			{{ props.activity ? 'Update Activity' : 'Create Activity' }}
		</UButton>
		<UButton
			v-if="props.activity"
			color="error"
			class="ml-4"
			@click="removeActivity"
			:disabled="loading"
		>
			Delete Activity
		</UButton>
	</div>
</template>

<script setup lang="ts">
import { com } from '@earth-app/ocean';
import {
	deleteActivity,
	draftActivity,
	editActivity,
	newActivity
} from '~/compostables/useActivity';
import type { Activity } from '~/shared/types/activity';

const props = defineProps<{
	title?: string;
	description?: string;
	activity?: Partial<Activity>;
}>();

const activity = ref<Partial<Activity> | null>(props.activity || null);
const toast = useToast();

const activityName = ref<string>(props.activity?.name || '');
const activityId = computed(() => activityName.value.trim().toLowerCase().replace(/\s+/g, '_'));
const activityDescription = ref<string>(props.activity?.description || '');
const activityType1 = ref<typeof com.earthapp.activity.ActivityType.prototype.name | undefined>(
	props.activity?.types?.at(0)
);
const activityType2 = ref<typeof com.earthapp.activity.ActivityType.prototype.name | undefined>(
	props.activity?.types?.at(1)
);
const activityType3 = ref<typeof com.earthapp.activity.ActivityType.prototype.name | undefined>(
	props.activity?.types?.at(2)
);
const activityType4 = ref<typeof com.earthapp.activity.ActivityType.prototype.name | undefined>(
	props.activity?.types?.at(3)
);
const activityType5 = ref<typeof com.earthapp.activity.ActivityType.prototype.name | undefined>(
	props.activity?.types?.at(4)
);
const activityAliases = ref<string>(props.activity?.aliases?.join(',') || '');

const activityFields = ref<Record<string, string>>(props.activity?.fields || {});
if (Array.isArray(activity.value?.fields)) {
	activityFields.value = {};
	activity.value.fields = {};
}

// New field management
const newFieldKey = ref<string>('');
const newFieldValue = ref<string>('');

const typeItems = com.earthapp.activity.ActivityType.values().map((type) => type.name.toString());

watch(
	() => props.activity,
	(newActivity) => {
		if (newActivity) {
			activity.value = newActivity;
			activityName.value = newActivity.name || '';
			activityDescription.value = newActivity.description || '';
			activityType1.value = newActivity.types?.[0];
			activityType2.value = newActivity.types?.[1];
			activityType3.value = newActivity.types?.[2];
			activityType4.value = newActivity.types?.[3];
			activityType5.value = newActivity.types?.[4];
			activityAliases.value = newActivity.aliases?.join(',')?.replace(/\s+/g, '_') || '';
			activityFields.value = newActivity.fields || {};
			newFieldKey.value = '';
			newFieldValue.value = '';
		} else {
			// Reset form when no activity is selected
			activity.value = null;
			activityName.value = '';
			activityDescription.value = '';
			activityType1.value = undefined;
			activityType2.value = undefined;
			activityType3.value = undefined;
			activityType4.value = undefined;
			activityType5.value = undefined;
			activityAliases.value = '';
			activityFields.value = {};
			newFieldKey.value = '';
			newFieldValue.value = '';
		}
	},
	{ immediate: true }
);

// Field management functions
function addField() {
	const trimmedKey = newFieldKey.value.trim();

	if (!trimmedKey) {
		toast.add({
			title: 'Error',
			description: 'Field name cannot be empty.',
			color: 'error',
			duration: 3000
		});
		return;
	}

	if (Array.isArray(activityFields.value)) {
		activityFields.value = {};
	}

	if (activityFields.value.hasOwnProperty(trimmedKey)) {
		toast.add({
			title: 'Error',
			description: `Field "${trimmedKey}" already exists.`,
			icon: 'mdi:alert-circle',
			color: 'error',
			duration: 3000
		});
		return;
	}

	activityFields.value[trimmedKey] = newFieldValue.value.trim();
	newFieldKey.value = '';
	newFieldValue.value = '';
}

function deleteField(key: string) {
	delete activityFields.value[key];
}

function updateFieldKey(oldKey: string, newKey: string) {
	const trimmedNewKey = newKey.trim();

	// Don't update if the key is empty or hasn't changed
	if (!trimmedNewKey || trimmedNewKey === oldKey) {
		return;
	}

	// Check if the new key already exists
	if (activityFields.value.hasOwnProperty(trimmedNewKey)) {
		toast.add({
			title: 'Error',
			description: `Field "${trimmedNewKey}" already exists.`,
			color: 'error',
			duration: 3000
		});
		return;
	}

	const value = activityFields.value[oldKey] || '';
	delete activityFields.value[oldKey];
	activityFields.value[trimmedNewKey] = value;
}

const generating = ref(false);
async function generateActivity() {
	if (!activityName.value) {
		toast.add({
			title: 'Error',
			description: 'Please enter an activity name before generating.',
			color: 'error',
			duration: 3000
		});
		return;
	}

	generating.value = true;
	const res = await draftActivity(activityId.value);
	if (res.success && res.data) {
		activityName.value = res.data.name;
		activityDescription.value = res.data.description;

		const types = res.data.types;
		if (types.length > 0) activityType1.value = types[0] || undefined;
		if (types.length > 1) activityType2.value = types[1] || undefined;
		if (types.length > 2) activityType3.value = types[2] || undefined;
		if (types.length > 3) activityType4.value = types[3] || undefined;
		if (types.length > 4) activityType5.value = types[4] || undefined;

		activityAliases.value = res.data.aliases.join(',');

		generating.value = false;
		newFieldKey.value = '';
		newFieldValue.value = '';
		toast.add({
			title: 'Activity Generated',
			description: `Activity "${activityName.value}" has been generated successfully.`,
			color: 'success',
			duration: 3000
		});
	} else {
		toast.add({
			title: 'Error',
			description: 'Failed to generate activity. Please try again.',
			color: 'error',
			duration: 3000
		});
	}
	generating.value = false;
}

const loading = ref(false);
async function createActivity() {
	loading.value = true;

	const res = await newActivity({
		id: activityId.value,
		name: activityName.value,
		description: activityDescription.value,
		types: [
			activityType1.value,
			activityType2.value,
			activityType3.value,
			activityType4.value,
			activityType5.value
		].filter(Boolean) as (typeof com.earthapp.activity.ActivityType.prototype.name)[],
		aliases: activityAliases.value
			.split(',')
			.map((alias) => alias.trim().replace(/\s+/g, '_'))
			.filter(Boolean),
		fields: activityFields.value
	});

	if (res.success && res.data) {
		activity.value = res.data;
		loading.value = false;

		refreshNuxtData('activities'); // Refresh activities list if needed

		toast.add({
			title: 'Activity Created',
			description: `Activity "${activity.value.name}" has been created successfully.`,
			color: 'success',
			duration: 3000
		});
	} else {
		toast.add({
			title: 'Error',
			description: 'Failed to create activity. Please check the details and try again.',
			color: 'error',
			duration: 3000
		});
	}

	loading.value = false;
}

async function updateActivity() {
	loading.value = true;

	// Add validation and safer property access
	if (!activity.value?.id) {
		toast.add({
			title: 'Error',
			description: 'No activity ID found for update.',
			color: 'error',
			duration: 3000
		});
		loading.value = false;
		return;
	}

	const res = await editActivity({
		id: activity.value.id,
		name: activityName.value || activity.value.name || '',
		description: activityDescription.value || activity.value.description || '',
		types: [
			activityType1.value || activity.value.types?.[0],
			activityType2.value || activity.value.types?.[1],
			activityType3.value || activity.value.types?.[2],
			activityType4.value || activity.value.types?.[3],
			activityType5.value || activity.value.types?.[4]
		].filter(Boolean) as (typeof com.earthapp.activity.ActivityType.prototype.name)[],
		aliases:
			activityAliases.value
				.split(',')
				.map((alias) => alias.trim().replace(/\s+/g, '_'))
				.filter(Boolean) ||
			activity.value.aliases ||
			[],
		fields: activityFields.value || activity.value.fields || {}
	});

	loading.value = false;
	if (res.success && res.data) {
		activity.value = res.data;
		activityName.value = res.data.name;
		activityDescription.value = res.data.description;
		activityType1.value = res.data.types?.[0];
		activityType2.value = res.data.types?.[1];
		activityType3.value = res.data.types?.[2];
		activityType4.value = res.data.types?.[3];
		activityType5.value = res.data.types?.[4];
		activityAliases.value = res.data.aliases.join(',');
		activityFields.value = res.data.fields || {};

		if (Array.isArray(activityFields.value)) {
			activityFields.value = {};
		}

		refreshNuxtData('activities'); // Refresh activities list if needed

		toast.add({
			title: 'Activity Updated',
			description: `Activity "${activity.value.name}" has been updated successfully.`,
			icon: activityFields.value['icon'] || 'mdi:earth',
			color: 'success',
			duration: 3000
		});
	} else {
		toast.add({
			title: 'Error',
			description: 'Failed to update activity. Please check the details and try again.',
			color: 'error',
			duration: 3000
		});
	}
}

async function removeActivity() {
	loading.value = true;
	if (!activity.value?.id) {
		toast.add({
			title: 'Error',
			description: 'No activity ID found for deletion.',
			color: 'error',
			duration: 3000
		});
		loading.value = false;
		return;
	}

	const res = await deleteActivity(activity.value.id!);
	loading.value = false;
	if (res.success) {
		activity.value = null;
		activityName.value = '';
		activityDescription.value = '';
		activityType1.value = undefined;
		activityType2.value = undefined;
		activityType3.value = undefined;
		activityType4.value = undefined;
		activityType5.value = undefined;
		activityAliases.value = '';
		activityFields.value = {};

		toast.add({
			title: 'Activity Deleted',
			description: 'The activity has been deleted successfully.',
			icon: 'material-symbols:delete-outline',
			color: 'success',
			duration: 3000
		});
	} else {
		toast.add({
			title: 'Error',
			description: 'Failed to delete activity. Please try again.',
			color: 'error',
			duration: 3000
		});
	}

	loading.value = false;
}
</script>
