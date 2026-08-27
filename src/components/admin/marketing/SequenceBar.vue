<template>
	<div class="flex flex-col gap-2 rounded-lg border border-default p-3">
		<div class="flex items-center gap-2 text-sm font-semibold text-muted">
			<UIcon
				name="mdi:filmstrip"
				class="size-4"
			/>
			<span>Sequence</span>
			<span class="font-normal">{{ label }}</span>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<USelect
				v-model="sequenceName"
				:items="sequenceItems"
				size="sm"
				class="min-w-44"
				:ui="{ content: 'z-9999' }"
				:disabled="exporting"
				aria-label="Sequence"
			/>
			<USelect
				v-model="format"
				:items="formatItems"
				size="sm"
				class="min-w-24"
				:ui="{ content: 'z-9999' }"
				:disabled="exporting"
				aria-label="Frame Format"
			/>
			<USelect
				v-model="resolution"
				:items="resolutionItems"
				size="sm"
				class="min-w-36"
				:ui="{ content: 'z-9999' }"
				:disabled="exporting"
				aria-label="Frame Resolution"
			/>
			<UButton
				icon="mdi:filmstrip-box-multiple"
				color="primary"
				size="sm"
				:loading="exporting"
				:disabled="exporting || !active"
				@click="run"
			>
				{{ exporting ? `Frame ${frame}/${frameTotal}` : `Export ${stepCount} Frames` }}
			</UButton>
		</div>

		<ol
			v-if="active"
			class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted"
		>
			<li
				v-for="(step, i) in active.steps"
				:key="step.label"
				:class="exporting && frame === i + 1 ? 'font-semibold text-primary' : ''"
			>
				{{ i + 1 }}. {{ step.label }}
			</li>
		</ol>

		<UProgress
			v-if="exporting"
			:model-value="Math.round(progress * 100)"
			size="sm"
		/>
	</div>
</template>

<script setup lang="ts">
import {
	EXPORT_FORMATS,
	measureNodeSize,
	NATURAL_RESOLUTION_PRESETS,
	naturalExportDimensions,
	STATIC_EXPORT_FORMATS,
	useMarketingExport,
	type SequenceStep
} from './useMarketingExport';

export type MarketingSequence = {
	name: string;
	description?: string;
	steps: SequenceStep[];
};

const props = withDefaults(
	defineProps<{
		sequences: MarketingSequence[];
		filename?: string;
		label?: string;
		target?: HTMLElement | null;
		getTarget?: () => HTMLElement | null;
		/** extra settle time per frame; raise it for surfaces that animate in */
		settleMs?: number;
	}>(),
	{ filename: 'marketing-sequence', label: '', settleMs: undefined }
);

const toast = useToast();
const { exporting, exportSequence, progress, frame, frameTotal } = useMarketingExport();

const sequenceName = ref(props.sequences[0]?.name ?? '');
const sequenceItems = computed(() =>
	props.sequences.map((s) => ({ label: s.name, value: s.name }))
);
const active = computed(
	() => props.sequences.find((s) => s.name === sequenceName.value) ?? props.sequences[0] ?? null
);
const stepCount = computed(() => active.value?.steps.length ?? 0);

const format = ref<'png' | 'jpg' | 'svg'>('png');
const formatItems = STATIC_EXPORT_FORMATS.map((f) => ({
	label: EXPORT_FORMATS[f].label,
	value: f,
	icon: EXPORT_FORMATS[f].icon
}));

const resolution = ref<number>(0);
const resolutionItems = NATURAL_RESOLUTION_PRESETS.map((p) => ({
	label: p.label,
	value: p.target ?? 0
}));

// keep the selection valid when a studio swaps its sequence list
watch(
	() => props.sequences.map((s) => s.name).join('|'),
	() => {
		if (!props.sequences.some((s) => s.name === sequenceName.value)) {
			sequenceName.value = props.sequences[0]?.name ?? '';
		}
	}
);

async function run() {
	const sequence = active.value;
	if (!sequence) return;

	const node = props.target ?? props.getTarget?.() ?? null;
	const { pixelRatio } = naturalExportDimensions(measureNodeSize(node), resolution.value || null);

	const res = await exportSequence({
		steps: sequence.steps,
		node,
		format: format.value,
		filename: `${props.filename}-${sequence.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
		pixelRatio,
		settleMs: props.settleMs
	});

	if (res.success) {
		toast.add({
			title: 'Sequence Ready',
			description: `${res.data?.frames ?? stepCount.value} numbered frames saved.`,
			icon: 'mdi:check-circle-outline',
			color: 'success'
		});
	} else {
		toast.add({
			title: 'Sequence Failed',
			description: res.error || 'Please try again.',
			icon: 'mdi:alert-circle-outline',
			color: 'error'
		});
	}
}
</script>
