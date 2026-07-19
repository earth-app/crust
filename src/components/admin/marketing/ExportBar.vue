<template>
	<div class="flex flex-col gap-2">
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
			<USelect
				v-model="resolutionScale"
				:items="resolutionItems"
				size="sm"
				class="min-w-36"
				:ui="{ content: 'z-9999' }"
				:disabled="exporting"
				aria-label="Export Resolution"
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

		<div
			v-if="exporting"
			class="flex flex-col gap-1"
			aria-live="polite"
		>
			<div class="flex items-center justify-between gap-2 text-xs text-muted">
				<span class="flex items-center gap-1 min-w-0">
					<UIcon
						:name="phaseIcon"
						class="size-3.5 shrink-0"
						:class="phase !== 'done' ? 'motion-safe:animate-spin' : ''"
					/>
					<span class="truncate">{{ phaseLabel }}</span>
					<span
						v-if="phase === 'capturing' && frameTotal > 0"
						class="tabular-nums opacity-80"
						>· Frame {{ frame }}/{{ frameTotal }}</span
					>
				</span>
				<span class="tabular-nums shrink-0">
					{{ percent }}%<span v-if="etaLabel"> · {{ etaLabel }}</span>
				</span>
			</div>
			<div class="h-1.5 w-full overflow-hidden rounded-full bg-elevated">
				<div
					class="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
					:style="{ width: `${percent}%` }"
				/>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { ExportFormat } from './useMarketingExport';
import {
	availableExportFormats,
	DEFAULT_DURATION_MS,
	DEFAULT_RESOLUTION_SCALE,
	defaultExportFormat,
	EXPORT_FORMATS,
	isAnimatedFormat,
	RESOLUTION_BASE_WIDTH,
	RESOLUTION_PRESETS,
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
		// a self-rendering source (e.g. the garden canvas) that produces a crisp static blob
		staticOverride?: (format: 'svg' | 'png' | 'jpg', pixelRatio: number) => Promise<Blob> | Blob;
	}>(),
	{ animated: false, canvasSelector: 'canvas', filename: 'marketing-asset' }
);

const toast = useToast();
const { exporting, exportAsset, progress, phase, frame, frameTotal } = useMarketingExport();

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
// up to 15s now that the capture cap covers it (15s * 12fps = 180 frames)
const durationItems = [2, 3, 4, 5, 6, 8, 10, 12, 15].map((n) => ({ label: `${n}s`, value: n }));

// output resolution: original by default, scalable up to a 3K poster
const resolutionScale = ref<number>(DEFAULT_RESOLUTION_SCALE);
const resolutionItems = RESOLUTION_PRESETS.map((p) => ({ label: p.label, value: p.scale }));

// when the animated flag flips, reset to that mode's default (gif when animated, png otherwise)
watch(
	() => props.animated,
	(animated) => {
		format.value = defaultExportFormat(animated);
	}
);

// #region progress + eta

const PHASE_META: Record<string, { label: string; icon: string }> = {
	idle: { label: 'Preparing', icon: 'mdi:progress-clock' },
	capturing: { label: 'Capturing Frames', icon: 'mdi:camera-burst' },
	encoding: { label: 'Encoding', icon: 'mdi:cog-outline' },
	rendering: { label: 'Rendering', icon: 'mdi:cog-outline' },
	done: { label: 'Finishing Up', icon: 'mdi:check-circle-outline' }
};

const percent = computed(() => Math.round(Math.min(1, Math.max(0, progress.value)) * 100));
const phaseLabel = computed(() => PHASE_META[phase.value]?.label ?? 'Working');
const phaseIcon = computed(() => PHASE_META[phase.value]?.icon ?? 'mdi:progress-clock');

// eta is plain arithmetic over real elapsed vs progress; a light ticker refreshes the label
const startedAt = ref(0);
const nowTick = ref(0);
let etaTimer: ReturnType<typeof setInterval> | null = null;

const etaMs = computed(() => {
	const p = progress.value;
	if (!exporting.value || p <= 0.02 || p >= 1) return null;
	const elapsed = nowTick.value - startedAt.value;
	if (elapsed <= 0) return null;
	return (elapsed * (1 - p)) / p;
});

const etaLabel = computed(() => {
	const ms = etaMs.value;
	if (ms == null) return '';
	if (ms < 1000) return 'almost done';
	return `~${Math.ceil(ms / 1000)}s left`;
});

function startEtaClock() {
	startedAt.value = Date.now();
	nowTick.value = Date.now();
	stopEtaClock();
	etaTimer = setInterval(() => {
		nowTick.value = Date.now();
	}, 250);
}

function stopEtaClock() {
	if (etaTimer) {
		clearInterval(etaTimer);
		etaTimer = null;
	}
}

onBeforeUnmount(stopEtaClock);

// #endregion

async function run() {
	const node = props.target ?? props.getTarget?.() ?? null;
	startEtaClock();
	try {
		const res = await exportAsset({
			format: format.value,
			node,
			canvasSelector: props.canvasSelector,
			filename: props.filename,
			durationMs: durationSec.value * 1000,
			// resolution: pixelRatio drives static (svg/png/jpg); maxDimension the animated frames
			pixelRatio: resolutionScale.value,
			maxDimension: Math.round(RESOLUTION_BASE_WIDTH * resolutionScale.value),
			staticOverride: props.staticOverride
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
	} finally {
		stopEtaClock();
	}
}
</script>
