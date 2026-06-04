<template>
	<a
		href="#main-content"
		class="sr-only focus:not-sr-only focus:absolute focus:z-60 focus:top-2 focus:left-2 focus:px-3 focus:py-2 focus:bg-primary focus:text-white focus:rounded-md focus:shadow-lg"
		>Skip to main content</a
	>
	<OfflineBanner />
	<NavBar />
	<main
		id="main-content"
		tabindex="-1"
		class="min-h-[90vh] w-full focus:outline-none"
	>
		<slot />
	</main>
	<LazyFooter hydrate-on-visible />

	<ClientOnly>
		<SiteTour
			:steps="welcomeTour"
			name="Welcome Tour"
			tour-id="welcome"
			:pulse="true"
		/>
		<UserEmailGate />
		<LazyCommandPalette />
		<UserQuestCompletionOverlay
			v-model:open="celebration.open.value"
			:quest-title="celebration.payload.value.questTitle"
			:points="celebration.payload.value.points"
		>
			<template #actions="{ close }">
				<UButton
					color="primary"
					trailing-icon="mdi:arrow-right"
					@click="close"
				>
					Keep Exploring
				</UButton>
			</template>
		</UserQuestCompletionOverlay>
	</ClientOnly>
</template>

<script setup lang="ts">
const route = useRoute();
const router = useRouter();
const { user, fetchUser } = useAuth();
const celebration = useQuestCelebration();

onMounted(async () => {
	if (route.query.force_refresh) {
		await fetchUser(true);

		const query = { ...route.query };
		delete query.force_refresh;

		await navigateTo(
			{
				path: route.path,
				query,
				hash: route.hash
			},
			{ replace: true }
		);
	}
});

const welcomeTour = computed<SiteTourStep[]>(() => [
	{
		id: 'title',
		title: 'Welcome to The Earth App',
		description:
			'A new kind of social experience: discover hobbies, dive into articles, answer thoughtful prompts, and meet people with similar interests.\n\nThis short tour will walk you through the highlights - feel free to skip it at any time with Esc or the X button.',
		footer: 'Press Next, or use ← / → on your keyboard to step through.',
		icon: 'mdi:earth',
		placement: 'center',
		dim: true,
		highlightPadding: 16
	},
	{
		id: 'navbar',
		title: 'Your Navigation Bar',
		description:
			'The navigation bar is your home base. Jump between Activities, Articles, Prompts, Events, and your Profile from anywhere on the site.',
		footer: 'It stays pinned to the top while you explore.',
		icon: 'mdi:compass-outline'
	},
	{
		url: '/activities',
		id: 'activities',
		title: 'Activities - Find What You Love',
		description:
			'Activities are hobbies, sports, and interests you can explore. Each activity has curated guides, resources, and even quests you can complete to level up.',
		footer: 'Tip: pick a few activities on your profile to get personalized recommendations.',
		icon: 'mdi:run',
		prerendered: true,
		waitFor: 'activities',
		highlightPadding: 12
	},
	{
		url: '/articles',
		id: 'navbar',
		title: 'Articles - Read & Learn',
		description:
			'Bite-sized articles tailored to your interests. Read about science, culture, sustainability, and more - then take a quick quiz to lock in what you learned.\n\nWriters: articles stay live for 2 weeks before auto-archive - publish now while readers are looking.',
		footer:
			'Articles personalize over time as you engage. Creating an account makes the recommendations even sharper.',
		icon: 'mdi:book-open-page-variant-outline',
		prerendered: true
	},
	{
		url: '/prompts',
		id: 'prompts-title',
		title: 'Prompts - Get Creative',
		description:
			"Daily creative prompts to spark your imagination. Share a short response, browse what others wrote, and discover new perspectives from the community.\n\nHeads up: prompts vanish after 2 days - if you've got something to say, say it now.",
		footer: 'Your answers can be public, friends-only, or private - your call.',
		icon: 'mdi:lightbulb-on-outline',
		prerendered: true
	},
	{
		url: '/signup',
		id: 'signup',
		title: 'Create Your Account',
		description:
			'Sign up to unlock personalized recommendations, earn badges and Impact Points, complete quests, and connect with friends across the Earth App.',
		footer: "It's free and only takes a minute.",
		anonymous: true,
		icon: 'mdi:account-plus-outline',
		dim: true,
		prerendered: true,
		cta: {
			label: 'Sign Up Now',
			icon: 'mdi:account-plus',
			color: 'success',
			advance: false,
			closeOnSuccess: true,
			handler: () => router.push('/signup')
		}
	},
	{
		url: '/profile',
		id: 'activities',
		title: 'Your Profile',
		description:
			'Your profile is the heart of your Earth App experience. The activities you pick here power your recommendations across the entire app - articles, prompts, and events.',
		footer: 'Pick at least 3 activities to get great recommendations from day one.',
		anonymous: false,
		icon: 'mdi:account-circle-outline',
		prerendered: true,
		waitFor: 'activities'
	},
	{
		id: 'avatar',
		title: 'Your Avatar',
		description:
			'Your avatar is generated from the activities you choose - no boring placeholder! Regenerate it any time, or unlock decorative cosmetics with Impact Points.',
		footer: 'Click "Regenerate Avatar" below your current avatar to roll a new one.',
		anonymous: false,
		icon: 'mdi:face-man-shimmer-outline'
	},
	{
		id: 'cosmetics',
		title: 'Avatar Cosmetics',
		description:
			'Spend Impact Points on cosmetic frames, accents, and effects to make your avatar uniquely yours. New cosmetics rotate in regularly - keep an eye out.',
		footer: 'Cosmetics are purely visual. They never affect what you can do on the app.',
		anonymous: false,
		icon: 'mdi:palette-outline'
	},
	{
		id: 'bio',
		title: 'Your Bio',
		description:
			"A great bio helps others discover what you're passionate about. Keep it short, honest, and a little fun - emojis are encouraged.",
		footer: 'You can edit this any time. Click directly on the text to edit it inline.',
		anonymous: false,
		icon: 'mdi:account-edit-outline'
	},
	{
		id: 'visibility',
		title: 'Account Visibility',
		description:
			'Choose how visible your profile is: Private (only you & friends), Unlisted (hidden from search but accessible by link), or Public (everyone can see).\n\nYou can change this anytime, and individual fields have their own privacy controls.',
		footer: 'Privacy is granular - even within a public profile, you can hide individual fields.',
		anonymous: false,
		icon: 'mdi:shield-account-outline'
	},
	{
		id: 'notifications',
		title: 'Notifications',
		description:
			'The bell icon in the navigation bar shows new replies, friend activity, quest progress, and important account events. Click it to see the full list.',
		footer: 'You can fine-tune which notifications you receive in your account settings.',
		anonymous: false,
		icon: 'mdi:bell-outline',
		highlightPadding: 6
	},
	{
		id: 'badges',
		title: 'Badges',
		description:
			'Badges celebrate your milestones - first article read, first quest completed, streaks, mastery achievements, and more. They show on your public profile.',
		footer: 'Some badges have a "Mastery" path that goes way deeper if you commit.',
		anonymous: false,
		icon: 'mdi:shield-star-outline'
	},
	{
		id: 'quests',
		title: 'Quests',
		description:
			'Quests are guided journeys that turn an activity into a structured adventure with steps, rewards, and a satisfying finish. Start with one tied to an activity you already love.',
		footer: 'You can only have one active quest at a time - choose wisely!',
		anonymous: false,
		icon: 'mdi:map-marker-path'
	},
	{
		url: `/profile/@${user.value?.username}`,
		id: 'navbar',
		title: 'Your Public Profile',
		description:
			"This is what other Earth App users see when they visit your profile. Your activities, bio, badges, and shared content all live here.\n\nFields you've marked private won't show to the public.",
		footer: 'Pro tip: a complete profile gets far more friend requests and replies.',
		anonymous: false,
		icon: 'mdi:account-eye-outline',
		prerendered: true,
		waitFor: 'navbar'
	},
	{
		id: 'points-history',
		title: 'Impact Points',
		description:
			'Impact Points reward you for engaging with the Earth App and the world around you - reading, writing, completing quests, helping others. Spend them on cosmetics, or watch them climb the leaderboard.',
		footer: 'Click "Points History" on your profile to see exactly how you earned them.',
		anonymous: false,
		icon: 'mdi:chart-line'
	},
	{
		id: 'user-activities',
		title: 'Your Activities Showcase',
		description:
			"Your selected activities also appear right here on your profile, giving friends an at-a-glance look at what you're into.",
		footer: 'Keep this list current - recommendations follow these choices closely.',
		anonymous: false,
		icon: 'mdi:format-list-bulleted-square'
	},
	{
		id: 'user-friends',
		title: 'Your Friends',
		description:
			'Add friends to follow their activities, react to their content, and unlock friends-only privacy settings. Building a network makes the Earth App way more fun.',
		footer: 'Click any user avatar across the app to view their profile and add them.',
		anonymous: false,
		icon: 'mdi:account-multiple-outline'
	},
	{
		id: 'user-journeys',
		title: 'Your Journeys',
		description:
			'Journeys are streaks of meaningful engagement. Keep them alive by exploring something new each day - it adds up fast.',
		footer: 'Daily login alone is enough to keep most journeys going.',
		anonymous: false,
		icon: 'mdi:walk'
	},
	{
		id: 'user-content',
		title: 'Your Content',
		description:
			"Every article and prompt response you publish lives here. It's your portfolio on the Earth App - and a great way for others to discover your perspective.",
		footer: "You're all caught up! Press Finish to start exploring.",
		anonymous: false,
		icon: 'mdi:notebook-multiple'
	}
]);
</script>
