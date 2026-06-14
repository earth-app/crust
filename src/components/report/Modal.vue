<template>
	<UModal
		v-model:open="open"
		title="Report Content"
		description="Reports are reviewed by our moderation team. Anonymous reports are allowed."
	>
		<template #body>
			<div class="flex flex-col gap-4 p-2">
				<USelect
					v-model="reason"
					:items="reasonItems"
					placeholder="Select a reason"
					class="w-full"
				/>
				<UTextarea
					v-model="description"
					:maxlength="1024"
					:rows="4"
					placeholder="Additional details (optional)"
					class="w-full"
				/>
				<p class="text-xs text-muted text-right">{{ description.length }}/1024</p>
				<div class="flex justify-end gap-2">
					<UButton
						color="neutral"
						variant="ghost"
						:disabled="loading"
						@click="close"
						>Cancel</UButton
					>
					<UButton
						color="error"
						icon="mdi:flag-outline"
						:loading="loading"
						:disabled="loading || !reason"
						@click="submit"
						>Submit Report</UButton
					>
				</div>
			</div>
		</template>
	</UModal>
</template>

<script setup lang="ts">
import type { ContentType, ReportReason } from 'types/report';
import { REPORT_REASONS } from 'types/report';

const props = defineProps<{
	contentType: ContentType;
	contentId: string;
	parentId?: string;
}>();

const { submitReport } = useReport();

const open = ref(false);
const reason = ref<ReportReason | undefined>(undefined);
const description = ref('');
const loading = ref(false);

const reasonItems = REPORT_REASONS.map((r) => ({ label: r.label, value: r.value }));

async function submit() {
	if (!reason.value || loading.value) return;
	loading.value = true;
	try {
		const res = await submitReport(props.contentType, props.contentId, {
			parentId: props.parentId,
			reason: reason.value,
			description: description.value
		});
		if (res.success) {
			reason.value = undefined;
			description.value = '';
			open.value = false;
		}
	} finally {
		loading.value = false;
	}
}

export interface ReportModalRef {
	open: () => void;
	close: () => void;
}

defineExpose<ReportModalRef>({
	open: () => {
		open.value = true;
	},
	close: () => {
		open.value = false;
	}
});

function close() {
	open.value = false;
}
</script>
