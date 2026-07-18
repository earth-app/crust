<template>
	<AdminMarketingContentShell
		kind="event"
		:payload="form"
		:can-generate="true"
		:can-pull="true"
		:display-only="displayOnly"
		present-title="Event Card"
		@load="applyLoad"
	>
		<div class="grid gap-3 sm:grid-cols-2">
			<UFormField
				label="Name"
				class="sm:col-span-2"
			>
				<UInput
					v-model="form.name"
					placeholder="Riverside Cleanup"
					class="w-full"
				/>
			</UFormField>
			<UFormField
				label="Description"
				class="sm:col-span-2"
			>
				<UTextarea
					v-model="form.description"
					placeholder="What is the event about?"
					:rows="4"
					class="w-full"
				/>
			</UFormField>
			<UFormField label="Type">
				<USelect
					v-model="form.type"
					:items="typeItems"
					class="w-full"
				/>
			</UFormField>
			<UFormField label="Activities (Comma-Separated)">
				<UInput
					v-model="form.activities"
					placeholder="Hiking, Gardening"
					class="w-full"
				/>
			</UFormField>
			<UFormField label="Attendee Count">
				<UInputNumber
					v-model="form.attendeeCount"
					:min="0"
					class="w-full"
				/>
			</UFormField>
			<UFormField label="Host Username">
				<UInput
					v-model="form.hostUsername"
					placeholder="earthling"
					class="w-full"
				/>
			</UFormField>
			<UFormField label="Host Account Type">
				<USelect
					v-model="form.hostAccountType"
					:items="accountTypeItems"
					class="w-full"
				/>
			</UFormField>
		</div>

		<template #preview>
			<EventCard
				:event="mock"
				no-link
			/>
		</template>
	</AdminMarketingContentShell>
</template>

<script setup lang="ts">
import type { MarketingScene } from '~/shared/types/marketing';
import {
	emptyEventForm,
	eventFormFromPayload,
	MARKETING_ACCOUNT_TYPES,
	MARKETING_EVENT_TYPES,
	mockEvent
} from '~/shared/utils/marketing';

const props = defineProps<{
	scene?: MarketingScene | null;
	displayOnly?: boolean;
}>();

const form = reactive(emptyEventForm());
const mock = computed(() => mockEvent(form));

const typeItems = MARKETING_EVENT_TYPES.map((value) => ({
	label: toTitleCase(value.replace(/_/g, ' ')),
	value
}));
const accountTypeItems = MARKETING_ACCOUNT_TYPES.map((value) => ({
	label: toTitleCase(value),
	value
}));

function applyLoad({ payload, mode }: { payload: unknown; mode: 'raw' | 'scene' }) {
	const next =
		mode === 'scene'
			? { ...emptyEventForm(), ...(payload as object) }
			: eventFormFromPayload(payload);
	Object.assign(form, next);
}

if (props.scene) applyLoad({ payload: props.scene.payload, mode: 'scene' });
</script>
