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
			<ClientOnly v-if="user">
				<div class="w-11/12 max-w-2xl mt-4">
					<OnboardingWelcomeChecklist @open-persona="personaOpen = true" />
				</div>
				<OnboardingPersonaPicker v-model="personaOpen" />
			</ClientOnly>

			<!-- First-paint pitch: shown only to fully-anonymous visitors so we don't
				ever waste real estate on returning users. Three explainer cards land
				below the hero CTAs to answer the only question a new visitor cares
				about: "what is this app actually for?" -->
			<div
				v-if="user === null"
				class="w-full max-w-5xl px-4 mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4"
			>
				<div
					class="rounded-xl p-5 bg-elevated border border-default flex flex-col items-start gap-2 motion-preset-fade-md"
				>
					<UIcon
						name="mdi:run"
						class="size-7 text-info"
					/>
					<h2 class="text-lg font-semibold">Pick What you Love</h2>
					<p class="text-sm text-muted">
						Choose activities — running, gardening, photography, anything — and the rest of the app
						tailors itself to you.
					</p>
				</div>
				<div
					class="rounded-xl p-5 bg-elevated border border-default flex flex-col items-start gap-2 motion-preset-fade-md motion-delay-100"
				>
					<UIcon
						name="mdi:map-marker-path"
						class="size-7 text-warning"
					/>
					<h2 class="text-lg font-semibold">Go on a Quest</h2>
					<p class="text-sm text-muted">
						Each activity has structured quests with steps, rewards, and a satisfying finish. Earn
						Impact Points along the way.
					</p>
				</div>
				<div
					class="rounded-xl p-5 bg-elevated border border-default flex flex-col items-start gap-2 motion-preset-fade-md motion-delay-200"
				>
					<UIcon
						name="mdi:account-multiple-outline"
						class="size-7 text-success"
					/>
					<h2 class="text-lg font-semibold">Meet Your People</h2>
					<p class="text-sm text-muted">
						Articles, prompts, and events bring you together with humans who care about the same
						stuff you do.
					</p>
				</div>
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
					special
				>
					<LazyActivityCard
						v-for="activity in user.activities"
						:key="activity.id"
						:activity="activity"
						hydrate-on-visible
					/>
				</InfoCardGroup>

				<div
					ref="activitiesSentinel"
					class="w-11/12"
				>
					<InfoCardGroup
						:title="user ? `Today's Content` : 'Discover Content'"
						:description="
							user ? 'Topics you might enjoy' : 'Explore interests from around the world'
						"
						icon="material-symbols:apps"
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
				</div>
				<div
					ref="promptsSentinel"
					class="w-11/12 mt-4"
				>
					<InfoCardGroup
						:title="user ? `A Fun Prompt` : 'Get Inspired'"
						description="Writing prompts to spark your creativity"
						icon="mdi:lightbulb-on-outline"
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
				</div>
				<div
					ref="articlesSentinel"
					class="w-11/12 mt-4"
				>
					<InfoCardGroup
						title="A Good Read"
						description="Articles you might find interesting"
						icon="mdi:book-multiple-variant"
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
				</div>
				<div
					ref="eventsSentinel"
					class="w-11/12 mt-4"
				>
					<InfoCardGroup
						title="Join The Community"
						description="Sign up for events to personalize your experience"
						icon="mdi:account-group-outline"
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
			</div>
		</ClientOnly>
	</div>
</template>

<script setup lang="ts">
import type { Event } from 'types/event';

const { setTitleSuffix } = useTitleSuffix();
setTitleSuffix('Home');

const { user, avatar128 } = useAuth();
const personaOpen = ref(false);

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

const activitiesSentinel = ref<HTMLElement | null>(null);
const promptsSentinel = ref<HTMLElement | null>(null);
const articlesSentinel = ref<HTMLElement | null>(null);
const eventsSentinel = ref<HTMLElement | null>(null);

const loadedActivities = ref(false);
const loadedPrompts = ref(false);
const loadedArticles = ref(false);
const loadedEvents = ref(false);

function loadActivities() {
	if (loadedActivities.value) return;
	loadedActivities.value = true;
	const { fetchRandom } = useActivities();
	void activities.load(async () => {
		const res = await fetchRandom(10);
		if (valid(res)) return res.data;
		reportError('Activities', res.message);
		return null;
	});
}

function loadPrompts() {
	if (loadedPrompts.value) return;
	loadedPrompts.value = true;
	const { fetchRandom } = usePrompts();
	void prompts.load(async () => {
		const res = await fetchRandom(5);
		if (valid(res)) return res.data;
		reportError('Prompts', res.message);
		return null;
	});
}

function loadArticles() {
	if (loadedArticles.value) return;
	loadedArticles.value = true;
	const { fetchRandom } = useArticles();
	void articles.load(async () => {
		const res = await fetchRandom(8);
		if (valid(res)) return res.data;
		reportError('Articles', res.message);
		return null;
	});
}

function loadEvents() {
	if (loadedEvents.value) return;
	loadedEvents.value = true;
	const { fetchRandom } = useEvents();
	void events.load(async () => {
		const res = await fetchRandom(10);
		if (valid(res)) return res.data;
		reportError('Events', res.message);
		return null;
	});
}

if (import.meta.client) {
	const observe = (target: Ref<HTMLElement | null>, load: () => void) => {
		const { stop } = useIntersectionObserver(
			target,
			(entries) => {
				if (entries[0]?.isIntersecting) {
					stop();
					load();
				}
			},
			{ rootMargin: '300px' }
		);
	};

	onMounted(() => {
		observe(activitiesSentinel, loadActivities);
		observe(promptsSentinel, loadPrompts);
		observe(articlesSentinel, loadArticles);
		observe(eventsSentinel, loadEvents);
	});
}

onMounted(() => {
	if (!user.value && !visitedSite.value) {
		welcomeTour();
	}
	markVisited();
});

function welcomeTour() {
	tours.startTour('welcome');
}
</script>
