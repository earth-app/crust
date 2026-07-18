<template>
	<AdminMarketingContentShell
		kind="activity"
		:payload="form"
		:can-generate="true"
		:can-pull="true"
		:display-only="displayOnly"
		present-title="Activity Card"
		@load="applyLoad"
	>
		<div class="grid gap-3 sm:grid-cols-2">
			<UFormField
				label="Name"
				class="sm:col-span-2"
			>
				<UInput
					v-model="form.name"
					placeholder="Rock Climbing"
					class="w-full"
				/>
			</UFormField>
			<UFormField
				label="Description"
				class="sm:col-span-2"
			>
				<UTextarea
					v-model="form.description"
					placeholder="A short, punchy description of the activity."
					:rows="4"
					class="w-full"
				/>
			</UFormField>
			<UFormField label="Types (Comma-Separated)">
				<UInput
					v-model="form.types"
					placeholder="SPORT, OUTDOOR"
					class="w-full"
				/>
			</UFormField>
			<UFormField label="Icon">
				<UInput
					v-model="form.icon"
					placeholder="mdi:carabiner"
					class="w-full"
				/>
			</UFormField>
		</div>

		<template #preview>
			<ActivityCard
				:activity="mock"
				no-link
			/>
		</template>
	</AdminMarketingContentShell>
</template>

<script setup lang="ts">
import type { MarketingScene } from '~/shared/types/marketing';
import { activityFormFromPayload, emptyActivityForm, mockActivity } from '~/shared/utils/marketing';

const props = defineProps<{
	scene?: MarketingScene | null;
	displayOnly?: boolean;
}>();

const form = reactive(emptyActivityForm());
const mock = computed(() => mockActivity(form));

function applyLoad({ payload, mode }: { payload: unknown; mode: 'raw' | 'scene' }) {
	const next =
		mode === 'scene'
			? { ...emptyActivityForm(), ...(payload as object) }
			: activityFormFromPayload(payload);
	Object.assign(form, next);
}

if (props.scene) applyLoad({ payload: props.scene.payload, mode: 'scene' });
</script>
