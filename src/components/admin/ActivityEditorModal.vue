<template>
	<UModal
		:title="title || `Create New Activity`"
		:description="description"
		:close="{
			color: 'primary',
			variant: 'solid',
			icon: 'i-heroicons-x-mark-solid'
		}"
		:ui="{ content: content || 'min-w-1/3' }"
		v-model:open="open"
	>
		<slot />

		<template #body>
			<div class="flex flex-col gap-4 w-full">
				<AdminActivityEditor
					:activity="activity"
					@create:activity="open = false"
					@update:activity="open = false"
					@delete:activity="open = false"
				/>
			</div>
		</template>
	</UModal>
</template>

<script setup lang="ts">
import type { Activity } from '../shared/types/activity';

defineProps<{
	title?: string;
	description?: string;
	content?: string;
	activity?: Partial<Activity>;
}>();

const open = ref(false);
</script>
