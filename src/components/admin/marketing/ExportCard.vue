<template>
	<div class="flex flex-col items-center gap-2">
		<!-- outer box is what the studio shows; the scale lives on the wrapper, never on the
		exported node, or the clone would inherit it and shrink the asset -->
		<div
			class="overflow-hidden rounded-lg border border-default"
			:style="{ width: `${width * scale}px`, height: `${height * scale}px` }"
		>
			<div :style="{ transform: `scale(${scale})`, transformOrigin: 'top left' }">
				<div
					ref="cardEl"
					class="flex flex-col justify-between overflow-hidden"
					:style="cardStyle"
				>
					<slot />
				</div>
			</div>
		</div>
		<span class="text-xs text-muted">{{ width }} x {{ height }} at {{ percent }}%</span>
	</div>
</template>

<script setup lang="ts">
/**
 * A fixed-size frame whose exported output does not depend on the viewport.
 *
 * The quest and trail previews used to point `ExportBar` at "the largest open `[role=dialog]`", so
 * the asset was a screenshot of the live teleported modal: viewport-sized, carrying modal chrome and
 * a backdrop, at whatever aspect the window happened to be. Nothing could be overlaid on that
 * reliably.
 */
const props = withDefaults(
	defineProps<{
		/** exported pixel size; 1080x1350 is the 4:5 social frame */
		width?: number;
		height?: number;
		/** preview scale inside the studio; has no effect on the export */
		scale?: number;
		background?: string;
	}>(),
	{ width: 1080, height: 1350, scale: 0.32, background: '' }
);

const cardEl = ref<HTMLElement | null>(null);

const percent = computed(() => Math.round(props.scale * 100));

const cardStyle = computed(() => ({
	width: `${props.width}px`,
	height: `${props.height}px`,
	...(props.background ? { background: props.background } : {})
}));

// the studio hands this to ExportBar, so the capture target is the fixed card and never the modal
defineExpose({ el: cardEl });
</script>
