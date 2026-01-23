<template>
	<div class="flex flex-col items-center w-full pt-8">
		<div class="flex items-start justify-center w-full px-4">
			<UButton
				v-if="!thumbnail && event.can_edit"
				icon="mdi:image-refresh"
				class="mx-4"
				:loading="genLoading"
				@click="genThumbnail"
				>Generate Thumbnail</UButton
			>
			<div class="flex flex-col h-full mx-4">
				<NuxtImg
					:src="thumbnail || '/cloud.png'"
					alt="Event Thumbnail"
					format="webp"
					class="h-full rounded-lg shadow-md object-cover hover:scale-105 transition-transform duration-500 hover:cursor-pointer"
					@click="thumbnail && openPreview()"
				/>
				<UserCard
					:user="event.host"
					class="my-4"
				/>
			</div>

			<EventCard
				:event="event"
				no-link
				full
				class="h-full"
			/>
		</div>
	</div>
	<UModal
		title="Event Thumbnail"
		name="image-viewer"
		v-model:open="previewOpen"
		:width="1080"
		:height="720"
	>
		<template #content>
			<NuxtImg
				:src="thumbnail || '/cloud.png'"
				alt="Event Thumbnail"
				format="webp"
				class="max-h-screen max-w-screen rounded-lg shadow-md object-contain"
			/>
		</template>
	</UModal>
</template>

<script setup lang="ts">
import type { Event } from '~/shared/types/event';

const props = defineProps<{
	event: Event;
}>();

const toast = useToast();
const { thumbnail, fetchThumbnail, generateThumbnail } = useEvent(props.event.id);

onMounted(() => {
	if (!thumbnail.value) {
		fetchThumbnail();
	}
});

const genLoading = ref(false);
async function genThumbnail() {
	if (genLoading.value) return;
	if (thumbnail.value) {
		toast.add({
			title: 'Thumbnail Already Exists',
			description: 'This event already has a thumbnail generated.',
			icon: 'mdi:image-off',
			color: 'info',
			duration: 5000
		});
		return;
	}

	genLoading.value = true;
	const res = await generateThumbnail();
	if (res.success) {
		toast.add({
			title: 'Thumbnail Generated',
			description: 'The event thumbnail has been successfully generated.',
			icon: 'mdi:image-check',
			color: 'success',
			duration: 5000
		});
	} else {
		toast.add({
			title: 'Error Generating Thumbnail',
			description: res.message || 'An unknown error occurred while generating the thumbnail.',
			icon: 'mdi:image-off',
			color: 'error',
			duration: 5000
		});
	}

	genLoading.value = false;
}

const previewOpen = ref(false);
function openPreview() {
	previewOpen.value = true;
}
</script>
