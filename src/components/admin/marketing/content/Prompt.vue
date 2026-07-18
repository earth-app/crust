<template>
	<AdminMarketingContentShell
		kind="prompt"
		:payload="form"
		:can-generate="true"
		:can-pull="true"
		:display-only="displayOnly"
		present-title="Prompt Card"
		@load="applyLoad"
	>
		<div class="grid gap-3 sm:grid-cols-2">
			<UFormField
				label="Prompt"
				class="sm:col-span-2"
			>
				<UTextarea
					v-model="form.prompt"
					placeholder="What small change did you make for the planet today?"
					:rows="3"
					class="w-full"
				/>
			</UFormField>
			<UFormField label="Owner Username">
				<UInput
					v-model="form.ownerUsername"
					placeholder="earthling"
					class="w-full"
				/>
			</UFormField>
			<UFormField label="Owner Account Type">
				<USelect
					v-model="form.ownerAccountType"
					:items="accountTypeItems"
					class="w-full"
				/>
			</UFormField>
			<UFormField
				label="Response Count"
				class="sm:col-span-2"
			>
				<UInputNumber
					v-model="form.responsesCount"
					:min="0"
					class="w-full"
				/>
			</UFormField>
		</div>

		<div class="flex flex-col gap-2">
			<div class="flex items-center justify-between">
				<span class="text-sm font-semibold text-muted">Sample Responses</span>
				<UButton
					icon="mdi:plus"
					color="secondary"
					variant="soft"
					size="xs"
					@click="form.responses.push('')"
					>Add Response</UButton
				>
			</div>
			<div
				v-for="(_, i) in form.responses"
				:key="`response-${i}`"
				class="flex items-center gap-2"
			>
				<UInput
					v-model="form.responses[i]"
					placeholder="A sample response"
					class="w-full"
				/>
				<UButton
					icon="mdi:delete-outline"
					color="error"
					variant="ghost"
					size="xs"
					@click="form.responses.splice(i, 1)"
				/>
			</div>
		</div>

		<template #preview>
			<div class="flex flex-col">
				<PromptCard
					:prompt="mock"
					no-link
				/>
				<PromptResponse
					v-for="response in responses"
					:key="response.id"
					:response="response"
				/>
			</div>
		</template>
	</AdminMarketingContentShell>
</template>

<script setup lang="ts">
import type { MarketingScene } from '~/shared/types/marketing';
import {
	emptyPromptForm,
	MARKETING_ACCOUNT_TYPES,
	mockPrompt,
	mockPromptResponses,
	promptFormFromPayload
} from '~/shared/utils/marketing';

const props = defineProps<{
	scene?: MarketingScene | null;
	displayOnly?: boolean;
}>();

const form = reactive(emptyPromptForm());
const mock = computed(() => mockPrompt(form));
const responses = computed(() => mockPromptResponses(form));

const accountTypeItems = MARKETING_ACCOUNT_TYPES.map((value) => ({
	label: toTitleCase(value),
	value
}));

function applyLoad({ payload, mode }: { payload: unknown; mode: 'raw' | 'scene' }) {
	const next =
		mode === 'scene'
			? { ...emptyPromptForm(), ...(payload as object) }
			: promptFormFromPayload(payload);
	Object.assign(form, next);
	if (!Array.isArray(form.responses)) form.responses = [];
}

if (props.scene) applyLoad({ payload: props.scene.payload, mode: 'scene' });
</script>
