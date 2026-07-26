<template>
	<UModal
		:title="title || `Create New Activity`"
		:description="description"
		:close="{
			color: 'primary',
			variant: 'solid',
			icon: 'i-heroicons-x-mark-solid'
		}"
		:ui="{ content: content || 'min-w-3/5' }"
		v-model:open="open"
	>
		<slot />

		<template #body>
			<div class="flex flex-col gap-4 w-full">
				<AdminActivityEditor
					:activity="activity"
					:mode="mode"
					@create:activity="close"
					@update:activity="close"
					@delete:activity="close"
					@approve:activity="onApprove"
				/>
			</div>
		</template>
	</UModal>
</template>

<script setup lang="ts">
defineProps<{
	title?: string;
	description?: string;
	content?: string;
	activity?: Partial<Activity>;
	mode?: 'catalog' | 'staged';
}>();

const emit = defineEmits<{
	(event: 'approve:activity', value: Partial<Activity> | null): void;
}>();

// v-model:open, so callers can drive it without a ref+defineExpose dance
const open = defineModel<boolean>('open', { default: false });

function close() {
	open.value = false;
}

// the editor's payload used to be dropped here, which made approve-with-edits look
// like it saved and silently discard every change
function onApprove(value: Partial<Activity> | null) {
	emit('approve:activity', value);
	close();
}
</script>
