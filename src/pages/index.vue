<template>
	<div class="w-full flex justify-center">
		<div class="relative size-32 sm:size-40 md:size-48 my-28">
			<EarthCircle />
		</div>
	</div>
	<div class="w-full flex flex-col items-center justify-center">
		<h1
			id="title"
			class="text-3xl"
		>
			The Earth App
		</h1>
		<ClientOnly>
			<p
				v-if="!user"
				class="text-lg text-center px-8 mt-3 motion-preset-fade-lg"
			>
				Find Your Novelty, Try New Things, Discover the World
			</p>
			<div
				v-else
				class="flex items-center justify-center mt-3 motion-preset-fade-lg"
			>
				<UAvatar
					:src="avatar128"
					class="size-8 mr-2 border border-white/50 light:border-black/50 shadow-lg shadow-black/50"
				/>
				<p class="text-lg font-semibold">Welcome, @{{ user.username }}</p>
			</div>
			<div class="flex flex-col sm:flex-row my-3 gap-x-2 gap-y-2">
				<UButton
					icon="mdi:account-arrow-right"
					color="success"
					variant="soft"
					@click="welcomeTour"
					>Take the Tour</UButton
				>
				<UButton
					v-if="user && user.is_admin"
					icon="mdi:cog-outline"
					color="error"
					variant="soft"
					@click="$router.push('/admin')"
					>Admin Panel</UButton
				>
				<UButton
					icon="mdi:book-open-variant"
					color="primary"
					variant="soft"
					@click="$router.push('/about')"
					>About Us</UButton
				>
				<UButton
					icon="material-symbols:settings-account-box"
					color="warning"
					variant="soft"
					@click="$router.push('/privacy-policy')"
					>Privacy Policy</UButton
				>
			</div>
			<div
				class="flex flex-col items-center justify-center w-full motion-opacity-in-0 motion-duration-1500"
			>
				<InfoCardGroup
					v-if="user"
					title="Your Activities"
					description="Continue to explore your interests"
					icon="mdi:star"
					class="w-11/12"
				>
					<ActivityCard
						v-for="activity in user.activities"
						:key="activity.id"
						:activity="activity"
					/>
				</InfoCardGroup>

				<InfoCardGroup
					:title="user ? `Today's Content` : 'Discover Content'"
					:description="user ? 'Topics you might enjoy' : 'Explore interests from around the world'"
					icon="material-symbols:apps"
					class="w-11/12"
				>
					<template v-if="loadingActivities">
						<InfoCardSkeleton
							v-for="i in 5"
							:key="`skeleton-activity-${i}`"
						/>
					</template>
					<template v-else>
						<ActivityCard
							v-for="activity in randomActivities"
							:key="activity.id"
							:activity="activity"
						/>
					</template>
				</InfoCardGroup>
				<InfoCardGroup
					:title="user ? `A Fun Prompt` : 'Get Inspired'"
					description="Writing prompts to spark your creativity"
					icon="mdi:lightbulb-on-outline"
					class="w-11/12 mt-4"
				>
					<template v-if="loadingPrompts">
						<InfoCardSkeleton
							v-for="i in 3"
							:key="`skeleton-prompt-${i}`"
						/>
					</template>
					<template v-else>
						<PromptCard
							v-for="prompt in randomPrompts"
							:key="prompt.id"
							:prompt="prompt"
						/>
					</template>
				</InfoCardGroup>
				<InfoCardGroup
					title="A Good Read"
					description="Articles you might find interesting"
					icon="mdi:book-multiple-variant"
					class="w-11/12 mt-4"
				>
					<template v-if="loadingArticles">
						<InfoCardSkeleton
							v-for="i in 4"
							:key="`skeleton-article-${i}`"
						/>
					</template>
					<template v-else>
						<ArticleCard
							v-for="article in randomArticles"
							:key="article.id"
							:article="article"
						/>
					</template>
				</InfoCardGroup>
				<InfoCardGroup
					title="Join The Community"
					description="Sign up for events to personalize your experience"
					icon="mdi:account-group-outline"
					class="w-11/12 mt-4"
				>
					<template v-if="loadingEvents">
						<InfoCardSkeleton
							v-for="i in 5"
							:key="`skeleton-event-${i}`"
						/>
					</template>
					<template v-else>
						<EventCard
							v-for="event in randomEvents"
							:key="event.id"
							:event="event"
						/>
					</template>
				</InfoCardGroup>
			</div>
		</ClientOnly>
	</div>
</template>

<script setup lang="ts">
import type { Activity } from '~/shared/types/activity';
import type { Article } from '~/shared/types/article';
import type { Event } from '~/shared/types/event';
import type { Prompt } from '~/shared/types/prompts';

const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Home');

const { user, avatar128 } = useAuth();

const toast = useToast();
const tours = useSiteTour();
const { visitedSite, markVisited } = useVisitedSite();
const randomPrompts = ref<Prompt[]>([]);
const randomActivities = ref<Activity[]>([]);
const randomArticles = ref<Article[]>([]);
const randomEvents = ref<Event[]>([]);

// Loading states for progressive rendering
const loadingPrompts = ref(true);
const loadingActivities = ref(true);
const loadingArticles = ref(true);
const loadingEvents = ref(true);

onMounted(async () => {
	// Start Welcome Tour if anonymous and new
	if (!user.value && !visitedSite.value) {
		welcomeTour();
	}
	markVisited();

	// Fetch content independently for progressive rendering
	const { getRandom: getRandomPrompts } = usePrompts();
	const { getRandom: getRandomActivities } = useActivities();
	const { getRandom: getRandomArticles } = useArticles();
	const { getRandom: getRandomEvents } = useEvents();

	// Fetch prompts
	getRandomPrompts(3).then((resPrompt) => {
		if (resPrompt.success && resPrompt.data) {
			if ('message' in resPrompt.data) {
				randomPrompts.value = [];
				toast.add({
					title: 'Error Fetching Prompts',
					description: resPrompt.data.message || 'An unknown error occurred.',
					icon: 'mdi:alert-circle-outline',
					color: 'error',
					duration: 5000
				});
			} else {
				randomPrompts.value = resPrompt.data;
			}
		}
		loadingPrompts.value = false;
	});

	// Fetch activities
	getRandomActivities(5).then((resActivities) => {
		if (resActivities.success && resActivities.data) {
			if ('message' in resActivities.data) {
				randomActivities.value = [];
				toast.add({
					title: 'Error Fetching Activities',
					description: resActivities.data.message || 'An unknown error occurred.',
					icon: 'mdi:alert-circle-outline',
					color: 'error',
					duration: 5000
				});
			} else {
				randomActivities.value = resActivities.data;
			}
		}
		loadingActivities.value = false;
	});

	// Fetch articles
	getRandomArticles(4).then((resArticles) => {
		if (resArticles.success && resArticles.data) {
			if ('message' in resArticles.data) {
				randomArticles.value = [];
				toast.add({
					title: 'Error Fetching Articles',
					description: resArticles.data.message || 'An unknown error occurred.',
					icon: 'mdi:alert-circle-outline',
					color: 'error',
					duration: 5000
				});
			} else {
				randomArticles.value = resArticles.data;
			}
		}
		loadingArticles.value = false;
	});

	// Fetch events
	getRandomEvents(5).then((resEvents) => {
		if (resEvents.success && resEvents.data) {
			if ('message' in resEvents.data) {
				randomEvents.value = [];
				toast.add({
					title: 'Error Fetching Events',
					description: resEvents.data.message || 'An unknown error occurred.',
					icon: 'mdi:alert-circle-outline',
					color: 'error',
					duration: 5000
				});
			} else {
				randomEvents.value = resEvents.data;
			}
		}
		loadingEvents.value = false;
	});
});

function welcomeTour() {
	tours.startTour('welcome');
}
</script>
