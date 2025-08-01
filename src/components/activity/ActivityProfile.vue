<template>
	<div class="flex flex-col w-full items-center justify-center mt-4">
		<UIcon
			v-if="activityIcons[activity.id as keyof typeof activityIcons]"
			:name="activityIcons[activity.id as keyof typeof activityIcons]"
			size="6rem"
			class="my-2"
		/>
		<div class="flex items-center justify-center">
			<h1 class="text-5xl font-bold">{{ activity.name }}</h1>
			<UButton
				v-if="user && user.account.account_type === 'ADMINISTRATOR'"
				color="primary"
				class="ml-4"
				@click="editing = true"
			>
				Edit Activity
			</UButton>
			<ActivityEditorModal
				v-if="user && user.account.account_type === 'ADMINISTRATOR'"
				:activity="activity"
				v-model:open="editing"
			/>
		</div>
		<h3 class="text-xl w-3/5 mt-8">{{ activity.description }}</h3>
		<div class="grid grid-cols-1 xl:grid-cols-2 items-start w-2/3 mt-6 px-4 gap-y-8">
			<!-- First Wikipedia Entry -->
			<ActivityInfoCard
				v-if="wikipediaEntries[0]"
				icon="mdi:wikipedia"
				:link="`https://en.wikipedia.org/wiki/${wikipediaEntries[0].titles.canonical}`"
				:title="capitalizeFully(wikipediaEntries[0].title)"
				:description="trimString(wikipediaEntries[0].description, 50)"
				:content="wikipediaEntries[0].extract"
				:image="wikipediaEntries[0].originalimage?.source"
			/>
			<!-- First Two YouTube Videos -->
			<ActivityInfoCard
				v-for="video in youtubeVideos.slice(0, 2)"
				:key="video.id"
				icon="mdi:youtube"
				:youtube-id="video.id"
				:title="`YT: ${trimString(video.title, 35)}`"
				:description="trimString(video.uploaded_at, 25)"
			/>
			<!-- Rest -->
			<ActivityInfoCard
				v-for="wikipedia in wikipediaEntries.slice(1)"
				:key="wikipedia.titles.canonical"
				icon="mdi:wikipedia"
				:link="`https://en.wikipedia.org/wiki/${wikipedia.titles.canonical}`"
				:title="capitalizeFully(wikipedia.title)"
				:description="trimString(wikipedia.description, 50)"
				:content="wikipedia.extract"
				:image="wikipedia.originalimage?.source"
			/>
			<ActivityInfoCard
				v-for="video in youtubeVideos.slice(2)"
				:key="video.id"
				icon="mdi:youtube"
				:youtube-id="video.id"
				:title="`YT: ${trimString(video.title, 35)}`"
				:description="trimString(video.uploaded_at, 25)"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import {
	activityIcons,
	getActivityWikipediaSummary,
	getActivityYouTubeSearch
} from '~/compostables/useActivity';
import { useAuth } from '~/compostables/useUser';
import type { Activity, WikipediaSummary, YouTubeVideo } from '~/shared/types/activity';
import ActivityEditorModal from '../admin/ActivityEditorModal.vue';
import { capitalizeFully, trimString } from '~/shared/util';

const props = defineProps<{
	activity: Activity;
}>();

const editing = ref(false);

const { user } = useAuth();

const wikipediaEntries = ref<WikipediaSummary[]>([]);
const youtubeVideos = ref<YouTubeVideo[]>([]);
onMounted(() => {
	if (props.activity.fields['wikipedia_id']) {
		const ids = props.activity.fields['wikipedia_id'].split(',');
		for (const id of ids) {
			getActivityWikipediaSummary(id).then((res) => {
				if (res.success && res.data) {
					wikipediaEntries.value.push(res.data);
				}
			});
		}
	}

	getActivityYouTubeSearch(`what is ${props.activity.name}`).then((res) => {
		if (res.success && res.data) {
			youtubeVideos.value = res.data;
		}
	});
});
</script>
