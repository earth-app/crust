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
			<div
				data-testid="hero-ctas"
				class="flex flex-col items-center justify-center flex-wrap sm:flex-row my-3 gap-x-2 gap-y-2 max-w-md"
			>
				<UButton
					icon="mdi:account-arrow-right"
					color="success"
					variant="soft"
					@click="welcomeTour"
					>Take the Tour</UButton
				>
				<UButton
					v-if="user === null"
					icon="mdi:login-variant"
					color="error"
					variant="soft"
					@click="$router.push('/login')"
					>Login</UButton
				>
				<UButton
					v-if="user === null"
					icon="mdi:account-plus"
					color="info"
					variant="soft"
					@click="$router.push('/signup')"
					>Sign Up</UButton
				>
				<UButton
					v-if="user"
					icon="mdi:sword-cross"
					color="neutral"
					variant="soft"
					@click="$router.push('/profile/quests')"
				>
					My Quests
				</UButton>
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
					icon="material-symbols:rule"
					color="secondary"
					variant="soft"
					@click="$router.push('/terms-of-service')"
					>Terms of Service</UButton
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
					<LazyActivityCard
						v-for="activity in user.activities"
						:key="activity.id"
						:activity="activity"
						hydrate-on-visible
					/>
				</InfoCardGroup>

				<InfoCardGroup
					:title="user ? `Today's Content` : 'Discover Content'"
					:description="user ? 'Topics you might enjoy' : 'Explore interests from around the world'"
					icon="material-symbols:apps"
					class="w-11/12"
				>
					<LazyActivityCard
						v-for="activity in activities.items"
						:key="activity.id"
						:activity="activity"
						class="motion-preset-fade-md"
						hydrate-on-visible
					/>
					<InfoCardSkeleton
						v-for="n in activities.remaining"
						:key="`home-activity-skel-${n}`"
					/>
				</InfoCardGroup>
				<InfoCardGroup
					:title="user ? `A Fun Prompt` : 'Get Inspired'"
					description="Writing prompts to spark your creativity"
					icon="mdi:lightbulb-on-outline"
					class="w-11/12 mt-4"
				>
					<LazyPromptCard
						v-for="prompt in prompts.items"
						:key="prompt.id"
						:prompt="prompt"
						class="motion-preset-fade-md"
						hydrate-on-visible
					/>
					<InfoCardSkeleton
						v-for="n in prompts.remaining"
						:key="`home-prompt-skel-${n}`"
					/>
				</InfoCardGroup>
				<InfoCardGroup
					title="A Good Read"
					description="Articles you might find interesting"
					icon="mdi:book-multiple-variant"
					class="w-11/12 mt-4"
				>
					<LazyArticleCard
						v-for="article in articles.items"
						:key="article.id"
						:article="article"
						class="motion-preset-fade-md"
						hydrate-on-visible
					/>
					<InfoCardSkeleton
						v-for="n in articles.remaining"
						:key="`home-article-skel-${n}`"
					/>
				</InfoCardGroup>
				<InfoCardGroup
					title="Join The Community"
					description="Sign up for events to personalize your experience"
					icon="mdi:account-group-outline"
					class="w-11/12 mt-4"
				>
					<LazyEventCard
						v-for="event in events.items"
						:key="event.id"
						:event="event"
						class="motion-preset-fade-md"
						hydrate-on-visible
					/>
					<InfoCardSkeleton
						v-for="n in events.remaining"
						:key="`home-event-skel-${n}`"
					/>
				</InfoCardGroup>
			</div>
		</ClientOnly>
	</div>
</template>

<script setup lang="ts">
import type { Event } from 'types/event';

const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Home');

const { user, avatar128 } = useAuth();

const toast = useToast();
const tours = useSiteTour();
const { visitedSite, markVisited } = useVisitedSite();

const prompts = useIncrementalList<Prompt>({ staggerMs: 100, initialExpectedCount: 3 });
const activities = useIncrementalList<Activity>({ staggerMs: 100, initialExpectedCount: 5 });
const articles = useIncrementalList<Article>({ staggerMs: 100, initialExpectedCount: 4 });
const events = useIncrementalList<Event>({ staggerMs: 100, initialExpectedCount: 5 });

function reportError(label: string, message?: string) {
	console.error(`Failed to load ${label}:`, message);
	toast.add({
		title: `Error Fetching ${label}`,
		description: message || 'An unknown error occurred.',
		icon: 'mdi:alert-circle-outline',
		color: 'error',
		duration: 5000
	});
}

onMounted(async () => {
	if (!user.value && !visitedSite.value) {
		welcomeTour();
	}
	markVisited();

	const { fetchRandom: fetchRandomPrompts } = usePrompts();
	const { fetchRandom: fetchRandomActivities } = useActivities();
	const { fetchRandom: fetchRandomArticles } = useArticles();
	const { fetchRandom: fetchRandomEvents } = useEvents();

	void prompts.load(async () => {
		const res = await fetchRandomPrompts(5);
		if (valid(res)) return res.data;
		reportError('Prompts', res.message);
		return null;
	});

	void activities.load(async () => {
		const res = await fetchRandomActivities(10);
		if (valid(res)) return res.data;
		reportError('Activities', res.message);
		return null;
	});

	void articles.load(async () => {
		const res = await fetchRandomArticles(8);
		if (valid(res)) return res.data;
		reportError('Articles', res.message);
		return null;
	});

	void events.load(async () => {
		const res = await fetchRandomEvents(10);
		if (valid(res)) return res.data;
		reportError('Events', res.message);
		return null;
	});
});

function welcomeTour() {
	tours.startTour('welcome');
}
</script>
