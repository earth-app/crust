<template>
	<div class="flex items-center gap-2">
		<UIcon
			name="mdi:download-circle-outline"
			class="size-5 text-primary shrink-0"
		/>
		<USelect
			v-model="format"
			:items="formatItems"
			size="sm"
			class="min-w-28"
			:disabled="exporting"
			aria-label="Export Format"
		/>
		<UButton
			icon="mdi:tray-arrow-down"
			color="primary"
			size="sm"
			:loading="exporting"
			:disabled="exporting"
			@click="run"
			>{{ exporting ? 'Exporting…' : 'Export' }}</UButton
		>
	</div>
</template>

<script setup lang="ts">
import type { ExportFormat } from './useMarketingExport';
import { availableExportFormats, EXPORT_FORMATS, useMarketingExport } from './useMarketingExport';

const props = withDefaults(
	defineProps<{
		target?: HTMLElement | null;
		getTarget?: () => HTMLElement | null;
		animated?: boolean;
		canvasSelector?: string;
		filename?: string;
		label?: string;
	}>(),
	{ animated: false, canvasSelector: 'canvas', filename: 'marketing-asset' }
);

const toast = useToast();
const { exporting, exportAsset } = useMarketingExport();

const format = ref<ExportFormat>('png');

const formatItems = computed(() =>
	availableExportFormats(props.animated).map((f) => ({
		label: EXPORT_FORMATS[f].label,
		value: f,
		icon: EXPORT_FORMATS[f].icon
	}))
);

// keep the selection valid when the animated flag flips gif/apng in or out
watch(
	() => props.animated,
	(animated) => {
		if (!animated && EXPORT_FORMATS[format.value].animated) format.value = 'png';
	}
);

async function run() {
	const node = props.target ?? props.getTarget?.() ?? null;
	const res = await exportAsset({
		format: format.value,
		node,
		canvasSelector: props.canvasSelector,
		filename: props.filename
	});

	if (res.success) {
		toast.add({
			title: 'Export Ready',
			description: `Saved as ${EXPORT_FORMATS[format.value].label}.`,
			icon: 'mdi:check-circle-outline',
			color: 'success'
		});
	} else {
		toast.add({
			title: 'Export Failed',
			description: res.error || 'Please try again.',
			icon: 'mdi:alert-circle-outline',
			color: 'error'
		});
	}
}
</script>
