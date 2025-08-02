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
		<!-- Icon Islands -->
		<UIcon
			v-for="island in islands"
			:key="island.name"
			:name="island.icon"
			class="absolute hidden md:inline-block md:size-8 lg:size-12 z-10 shadow-2xl shadow-gray-950 duration-300 motion-preset-fade-lg"
			:style="{ transform: `translate(${island.x}vw, ${island.y}vh)` }"
		/>
		<div class="grid grid-cols-1 xl:grid-cols-2 items-start w-2/3 mt-6 px-4 gap-y-8">
			<!-- Skeleton Loading Cards -->
			<InfoCardSkeleton
				v-if="!dataLoaded"
				v-for="n in 6"
				:key="`skeleton-${n}`"
			/>
			<!-- First Wikipedia Entry -->
			<InfoCard
				v-if="wikipediaEntries[0] && dataLoaded"
				icon="mdi:wikipedia"
				:link="`https://en.wikipedia.org/wiki/${wikipediaEntries[0].titles.canonical}`"
				:title="capitalizeFully(wikipediaEntries[0].title)"
				:description="trimString(wikipediaEntries[0].description, 50)"
				:content="wikipediaEntries[0].extract"
				:image="wikipediaEntries[0].originalimage?.source"
			/>
			<!-- First Two YouTube Videos -->
			<InfoCard
				v-for="video in youtubeVideos.slice(0, 2)"
				v-if="dataLoaded"
				:key="video.id"
				icon="mdi:youtube"
				:youtube-id="video.id"
				:title="`YT: ${trimString(video.title, 35)}`"
				:description="trimString(video.uploaded_at, 25)"
			/>
			<!-- Rest -->
			<InfoCard
				v-for="wikipedia in wikipediaEntries.slice(1)"
				v-if="dataLoaded"
				:key="wikipedia.titles.canonical"
				icon="mdi:wikipedia"
				:link="`https://en.wikipedia.org/wiki/${wikipedia.titles.canonical}`"
				:title="capitalizeFully(wikipedia.title)"
				:description="trimString(wikipedia.description, 50)"
				:content="wikipedia.extract"
				:image="wikipedia.originalimage?.source"
			/>
			<InfoCard
				v-for="video in youtubeVideos.slice(2)"
				v-if="dataLoaded"
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
const dataLoaded = ref(false);

const { user } = useAuth();

const islands = computed(() => {
	if (props.activity.fields['island_icons']) {
		const icons = props.activity.fields['island_icons'].split(',');
		const size = icons.length;
		return Array.from({ length: size }, (_, i) => {
			const id = icons[i] ?? '';
			if (!id) return null;

			return {
				name: capitalizeFully(id),
				icon: `cib:${id.toLowerCase()}`,
				x: i % 2 == 0 ? Math.random() * 5 + 33 : Math.random() * -5 - 37,
				y: i * 6 - 60
			};
		}).filter((island) => island !== null);
	}

	return [];
});

const wikipediaEntries = ref<WikipediaSummary[]>([]);
const youtubeVideos = ref<YouTubeVideo[]>([]);

let wikipediaLoaded = false;
let youtubeLoaded = false;

const checkDataLoaded = () => {
	if (wikipediaLoaded && youtubeLoaded) {
		dataLoaded.value = true;
	}
};

onMounted(() => {
	if (props.activity.fields['wikipedia_id']) {
		const ids = props.activity.fields['wikipedia_id'].split(',');
		let wikipediaPromises = [];
		for (const id of ids) {
			const promise = getActivityWikipediaSummary(id).then((res) => {
				if (res.success && res.data) {
					wikipediaEntries.value.push(res.data);
				}
			});
			wikipediaPromises.push(promise);
		}
		Promise.all(wikipediaPromises).then(() => {
			wikipediaLoaded = true;
			checkDataLoaded();
		});
	} else {
		wikipediaLoaded = true;
		checkDataLoaded();
	}

	getActivityYouTubeSearch(`what is ${props.activity.name}`).then((res) => {
		if (res.success && res.data) {
			youtubeVideos.value = res.data;
		}
		youtubeLoaded = true;
		checkDataLoaded();
	});
});
</script>
