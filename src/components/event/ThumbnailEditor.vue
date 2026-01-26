<template>
	<div class="w-4/5">
		<UFormField
			label="Thumbnail"
			name="thumbnail_url"
			help="Drag and drop or upload a thumbnail"
		>
			<div class="space-y-2">
				<UInput
					v-model="thumbnailUrl"
					placeholder="https://example.com/image.jpg or upload below"
					:disabled="loading || !!thumbnailFile || thumbnailUrl.startsWith('blob:')"
					class="min-w-100"
				/>

				<UFileUpload
					v-model="thumbnailFile"
					accept="image/*"
					label="Upload Thumbnail"
					class="min-w-100 min-h-50"
					:disabled="loading"
				/>

				<div
					v-if="thumbnailPreview || (thumbnailUrl && !thumbnailFile)"
					class="relative inline-block"
				>
					<img
						:src="thumbnailPreview || thumbnailUrl"
						alt="Thumbnail preview"
						class="max-w-xs max-h-48 rounded border"
					/>
					<UButton
						icon="mdi:close"
						color="error"
						size="xs"
						class="absolute top-2 right-2"
						@click="clearThumbnail"
					>
						Remove
					</UButton>
				</div>
			</div>
		</UFormField>
	</div>
</template>

<script setup lang="ts">
const props = defineProps<{
	thumbnailUrlProp?: string;
}>();

const loading = ref(false);
const thumbnailUrl = ref<string>(props.thumbnailUrlProp || '');
const thumbnailFile = ref<File | null>(null);
const thumbnailPreview = ref<string | null>(null);

const emit = defineEmits<{
	(event: 'update:thumbnail', value: string): void;
	(event: 'update:thumbnailFile', value: File | null): void;
}>();

// Watch for file changes and create blob preview
watch(thumbnailFile, (newFile, oldFile) => {
	// Clean up old blob URL
	if (thumbnailPreview.value && thumbnailPreview.value.startsWith('blob:')) {
		URL.revokeObjectURL(thumbnailPreview.value);
	}

	if (newFile) {
		// Create new blob URL for preview
		thumbnailPreview.value = URL.createObjectURL(newFile);
		emit('update:thumbnailFile', newFile);
		emit('update:thumbnail', thumbnailPreview.value);
	} else {
		thumbnailPreview.value = null;
		emit('update:thumbnailFile', null);
		emit('update:thumbnail', '');
	}
});

// Watch for URL changes from prop
watch(
	() => props.thumbnailUrlProp,
	(newUrl) => {
		if (newUrl && !thumbnailFile.value) {
			thumbnailUrl.value = newUrl;
		}
	}
);

const clearThumbnail = () => {
	// Clean up blob URL
	if (thumbnailPreview.value && thumbnailPreview.value.startsWith('blob:')) {
		URL.revokeObjectURL(thumbnailPreview.value);
	}

	thumbnailFile.value = null;
	thumbnailPreview.value = null;
	thumbnailUrl.value = '';

	emit('update:thumbnailFile', null);
	emit('update:thumbnail', '');
};

// Cleanup on unmount
onBeforeUnmount(() => {
	if (thumbnailPreview.value && thumbnailPreview.value.startsWith('blob:')) {
		URL.revokeObjectURL(thumbnailPreview.value);
	}
});

defineExpose({
	thumbnailUrl,
	thumbnailFile,
	thumbnailPreview
});
</script>
