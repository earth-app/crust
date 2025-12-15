<template>
	<div class="flex flex-col w-full items-center justify-center mt-4">
		<UIcon
			v-if="activity.fields['icon']"
			:name="activity.fields['icon']"
			size="6rem"
			class="my-2"
		/>
		<div class="flex flex-col sm:flex-row items-center justify-center">
			<h1 class="text-4xl sm:text-5xl font-bold">{{ activity.name }}</h1>
			<UButton
				v-if="user && user.account.account_type === 'ADMINISTRATOR'"
				color="primary"
				class="ml-4 mt-2"
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
		<h3 class="text-md sm:text-lg md:text-xl min-w-75 w-3/5 mt-8">{{ activity.description }}</h3>
		<!-- Icon Islands -->
		<UIcon
			v-for="island in islands"
			:key="island.name"
			:name="island.icon"
			class="absolute top-0 hidden md:inline-block md:size-8 lg:size-12 z-10duration-300 motion-preset-fade-lg"
			:style="{ transform: `translate(${island.x}vw, ${island.y}vh)` }"
		/>
		<div
			class="grid grid-cols-1 xl:grid-cols-2 justify-items-center items-start w-2/3 min-w-100 xl:min-w-260 mt-6 sm:px-4 gap-y-8"
		>
			<!-- Skeleton Loading Cards -->
			<InfoCardSkeleton
				v-if="cards.length === 0"
				v-for="n in 6"
				:key="`skeleton-${n}`"
			/>

			<!-- Card Data Entries -->
			<InfoCard
				v-for="(card, index) in cards"
				class="z-20"
				:key="`card-${index}`"
				:icon="card.icon"
				:external="true"
				:title="card.title"
				:description="card.description"
				:content="card.content"
				:link="card.link"
				:image="card.image"
				:youtube-id="card.youtubeId"
				:video="card.video"
				:footer="card.footer"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { Activity } from '~/shared/types/activity';
import { capitalizeFully } from '~/shared/util';
import ActivityEditorModal from '../admin/ActivityEditorModal.vue';

const props = defineProps<{
	activity: Activity;
}>();

const { user } = useAuth();

const islands = ref<{ name: string; icon: string; x: number; y: number }[]>([]);

async function loadIslandsForActivity(activity: Activity) {
	if (activity.fields['island_icons']) {
		const icons = activity.fields['island_icons'].split(',');
		const size = icons.length;
		islands.value.push(
			...Array.from({ length: size }, (_, i) => {
				const id = icons[i] ?? '';
				if (!id) return null;

				return {
					name: capitalizeFully(id),
					icon: id.includes(':') ? id.toLowerCase() : `cib:${id.toLowerCase()}`,
					x: i % 2 == 0 ? Math.random() * 5 + 33 : Math.random() * -5 - 37,
					y: i * 6 + 30
				};
			}).filter((island) => island !== null)
		);
	}

	getActivityIconSearches([activity.name, ...(activity.aliases || [])]).then((icons) => {
		let i = 0;
		for (const icon of Object.values(icons).flat()) {
			islands.value.push({
				name: capitalizeFully(icon),
				icon: icon,
				x: i % 2 == 0 ? Math.random() * 5 + 33 : Math.random() * -5 - 37,
				y: i * 6 + 30
			});
			i++;
		}
	});
}

const editing = ref(false);
const cards = ref<
	{
		title: string;
		icon: string;
		description?: string;
		content?: string;
		link?: string;
		image?: string;
		video?: string;
		youtubeId?: string;
		footer?: string;
	}[]
>([]);

const loadRequestId = ref(0);
async function loadCardsForActivity(activity: Activity) {
	if (!activity) return;

	// Create a new request token; used to ignore late async responses
	const reqId = ++loadRequestId.value;
	cards.value = [];

	// Track unique items across sources
	const seen = new Set<string>();

	const safePush = (items: (typeof cards.value)[number] | (typeof cards.value)[number][]) => {
		if (loadRequestId.value !== reqId) return; // stale load, ignore
		const arr = Array.isArray(items) ? items : [items];
		for (const item of arr) {
			const key = item.youtubeId
				? `yt:${item.youtubeId}`
				: item.link
					? `link:${item.link}`
					: `t:${item.title}`;
			if (seen.has(key)) continue;
			seen.add(key);

			const lower = Math.min(4, cards.value.length);
			const upper = cards.value.length;
			const randomPlace = lower + Math.floor(Math.random() * (upper - lower + 1));
			cards.value.splice(randomPlace, 0, item);
		}
	};

	const ytQueries = [`what is ${activity.name}`, `how to ${activity.name}`];
	const ytPromises = ytQueries.map((q) =>
		getActivityYouTubeSearch(q)
			.then((res) => {
				if (res.success && res.data) {
					safePush(
						res.data.map((video) => ({
							title: video.title,
							icon: 'cib:youtube',
							description: video.uploaded_at,
							link: `https://www.youtube.com/watch?v=${video.id}`,
							youtubeId: video.id
						}))
					);
				}
			})
			.catch(() => {
				// ignore individual source failures
			})
	);
	await Promise.allSettled(ytPromises);

	// Wikipedia searches (name + aliases)
	try {
		const terms = [activity.name, ...(activity.aliases || [])];
		await getActivityWikipediaSearches(terms, (_, entry) => {
			const key = `wp:${entry.pageid}`;
			if (seen.has(key)) return;
			seen.add(key);
			safePush({
				title: entry.title,
				icon: 'cib:wikipedia',
				description: entry.description,
				content: entry.extract,
				link: `https://en.wikipedia.org/wiki/${entry.titles.canonical}`,
				image: entry.originalimage?.source,
				footer: entry.summarySnippet
			});
		});
	} catch (e) {
		// ignore
	}

	// Pixabay image searches (name + aliases)
	try {
		const terms = [activity.name, ...(activity.aliases || [])];
		await getActivityPixabayImages(terms, (_, images) => {
			safePush(
				images.map((image) => ({
					title: capitalizeFully(activity.name),
					icon: 'mdi:image',
					description: `Photo by ${image.user} on Pixabay`,
					link: image.pageURL,
					image: image.webformatURL
				}))
			);
		});
	} catch (e) {
		// ignore
	}

	// Pixabay video searches (name + aliases)
	try {
		const terms = [activity.name, ...(activity.aliases || [])];
		await getActivityPixabayVideos(terms, (_, videos) => {
			safePush(
				videos.map((video) => ({
					title: capitalizeFully(activity.name),
					icon: 'mdi:video',
					description: `Video by ${video.user} on Pixabay`,
					video: video.videos.medium.url
				}))
			);
		});
	} catch (e) {
		// ignore
	}
}

// Reload when the activity changes (name or aliases)
watch(
	() => [props.activity?.name, props.activity?.aliases?.join(',') || ''],
	() => {
		loadCardsForActivity(props.activity);
		loadIslandsForActivity(props.activity);
	},
	{ immediate: true }
);
</script>
