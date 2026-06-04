<template>
	<UiSketchCanvas
		:disabled="props.disabled"
		:canvas-size="800"
		persist-key="quest-step-drawing"
		confirm-label="Confirm"
		@capture="onCapture"
	/>
</template>

<script setup lang="ts">
const props = defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{ capture: [file: File]; close: [] }>();

function onCapture(file: File) {
	emit('capture', file);
}
</script>
