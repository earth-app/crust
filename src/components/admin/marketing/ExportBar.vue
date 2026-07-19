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
			:ui="{ content: 'z-9999' }"
			:disabled="exporting"
			aria-label="Export Format"
		/>
		<USelect
			v-if="showDuration"
			v-model="durationSec"
			:items="durationItems"
			size="sm"
			class="min-w-20"
			:ui="{ content: 'z-9999' }"
			:disabled="exporting"
			aria-label="Animation Length"
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
import {
	availableExportFormats,
	DEFAULT_DURATION_MS,
	defaultExportFormat,
	EXPORT_FORMATS,
	isAnimatedFormat,
	useMarketingExport
} from './useMarketingExport';

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

const format = ref<ExportFormat>(defaultExportFormat(props.animated));

// animated assets default to GIF (motion) with gif/apng listed first
const formatItems = computed(() =>
	availableExportFormats(props.animated).map((f) => ({
		label: EXPORT_FORMATS[f].label,
		value: f,
		icon: EXPORT_FORMATS[f].icon
	}))
);

// length control only matters for a frame-captured animated export
const showDuration = computed(() => isAnimatedFormat(format.value));
const durationSec = ref(Math.round(DEFAULT_DURATION_MS / 1000));
const durationItems = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ label: `${n}s`, value: n }));

// when the animated flag flips, reset to that mode's default (gif when animated, png otherwise)
watch(
	() => props.animated,
	(animated) => {
		format.value = defaultExportFormat(animated);
	}
);

async function run() {
	const node = props.target ?? props.getTarget?.() ?? null;
	const res = await exportAsset({
		format: format.value,
		node,
		canvasSelector: props.canvasSelector,
		filename: props.filename,
		durationMs: durationSec.value * 1000
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
