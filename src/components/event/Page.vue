<template>
	<div class="flex flex-col items-center w-full pt-8">
		<div class="flex items-start justify-center w-full px-4">
			<div class="flex flex-col min-h-64 h-full mx-4">
				<NuxtImg
					:src="thumbnail || '/earth-app.png'"
					:title="`${event.name} Thumbnail | Photo by ${thumbnailAuthor || 'Unknown'}`"
					alt="Event Thumbnail"
					format="webp"
					class="h-64 rounded-lg shadow-md object-cover hover:scale-105 transition-transform duration-500 hover:cursor-pointer"
					@click="thumbnail && openPreview()"
				/>
				<UButton
					v-if="!thumbnail && event.can_edit"
					icon="mdi:image-refresh"
					class="mx-4 my-2"
					:loading="genLoading"
					@click="genThumbnail"
					>Generate Thumbnail</UButton
				>
				<LazyUserCard
					id="event-host-card"
					:user="event.host"
					class="my-2"
					hydrate-on-idle
				/>
				<USeparator class="my-2" />
				<div class="flex flex-col justify-center px-2">
					<NuxtLink
						v-if="event.fields?.link"
						:to="event.fields.link"
						target="_blank"
						class="text-blue-600 hover:underline border-blue-600 inline-flex items-center w-fit"
					>
						<UIcon
							name="mdi:link-variant"
							class="inline-block mr-1"
						/>
						{{ event.fields.link }}
					</NuxtLink>
					<UButton
						v-if="event.fields?.info"
						variant="soft"
						color="neutral"
						class="w-fit mt-2"
						@click="openInfo"
					>
						<UIcon
							name="mdi:information-outline"
							class="inline-block mr-1"
						/>
						About Event
					</UButton>
					<UModal
						v-if="event.fields?.info"
						v-model:open="infoOpen"
						:title="`About ${event.name}`"
						name="event-info"
					>
						<template #body>
							<div class="prose max-w-none">
								<p class="whitespace-pre-line">{{ event.fields.info }}</p>
							</div>
						</template>
					</UModal>
				</div>
			</div>

			<LazyEventCard
				id="event-profile-card"
				:event="event"
				no-link
				full
				class="h-full"
				hydrate-on-idle
			/>
		</div>
		<USeparator class="my-8" />
		<div
			id="event-submissions"
			class="flex flex-1 items-stretch justify-center my-4 gap-8 h-32"
		>
			<!-- only display up until 3 days after event has ended (expires in KV) -->
			<EventSubmissionPreview
				v-if="(event.end_date || 0) + 1000 * 60 * 60 * 24 * 3 > Date.now()"
				:submissions="submissions || []"
			/>
			<EventSubmissionUpload
				:event-id="event.id"
				@submission="fetchSubmissions"
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
			<div class="flex flex-col items-center justify-center p-4">
				<NuxtImg
					:src="thumbnail || '/cloud.png'"
					alt="Event Thumbnail"
					format="webp"
					class="max-h-screen max-w-screen rounded-lg shadow-md object-contain"
				/>
				<h2 class="text-center font-semibold">
					{{ thumbnailAuthor ? `Photo by ${thumbnailAuthor}` : '' }}
				</h2>
			</div>
		</template>
	</UModal>
	<ClientOnly>
		<SiteTour
			:steps="eventTour"
			name="Event Tour"
			tour-id="event-profile"
		/>
	</ClientOnly>
</template>

<script setup lang="ts">
import type { Event } from 'types/event';

const props = defineProps<{
	event: Event;
}>();

const toast = useToast();
const {
	thumbnail,
	thumbnailAuthor,
	fetchThumbnail,
	generateThumbnail,
	submissions,
	fetchSubmissions
} = useEvent(props.event.id);

onMounted(() => {
	if (!thumbnail.value) {
		fetchThumbnail();
	}

	if (!submissions.value) {
		fetchSubmissions();
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

const infoOpen = ref(false);
function openInfo() {
	if (!props.event.fields?.info) return;
	infoOpen.value = true;
}

// event tour

const eventTour: SiteTourStep[] = [
	{
		id: 'event-profile-card',
		title: 'Event Overview',
		description:
			'Everything you need at a glance: name, date, location, sign-up status, attendee count, and a description. The Sign Up button appears here if registration is open.',
		footer: 'Live status banners show ongoing, starting soon, or concluded events.',
		icon: 'mdi:calendar-star',
		highlightPadding: 12
	},
	{
		id: 'event-host-card',
		title: 'Meet the Host',
		description:
			"This card shows who's running the event. Click the host's name or avatar to visit their profile, see their other events, and add them as a friend.",
		footer: 'Pro tip: hosts often share extra context on their profile bio.',
		icon: 'mdi:account-tie-outline'
	},
	{
		id: 'event-submissions',
		title: 'Event Submissions & Gallery',
		description:
			'During and shortly after the event, attendees can upload photos to share their experience. Submissions earn Impact Points and can be featured in the public gallery.',
		footer: 'Submissions are open from the event start through 3 days after it ends.',
		icon: 'mdi:image-multiple-outline'
	}
];
</script>
