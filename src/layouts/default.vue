<template>
	<NavBar />
	<main class="min-h-[90vh] w-full">
		<slot />
	</main>
	<Footer />

	<ClientOnly>
		<SiteTour
			:steps="welcomeTour"
			name="Welcome Tour"
			tourId="welcome"
		/>
	</ClientOnly>
</template>

<script setup lang="ts">
const route = useRoute();
const { user, fetchUser } = useAuth();

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

const welcomeTour: SiteTourStep[] = [
	{
		id: 'title',
		title: 'Welcome to the Earth App',
		description:
			'The Earth App is a new take on the app experience, encouraging you to explore new things and engage with people of similar interests.',
		footer: 'Click Next to continue.'
	},
	{
		id: 'navbar',
		title: 'Navigation Bar',
		description:
			'The navigation bar at the top of the page allows you to easily access different sections of the app, including your profile, articles, and more.',
		footer: 'Click Next to continue.'
	},
	{
		url: '/activities',
		id: 'activities',
		title: 'Activities Page',
		description:
			'The Activities page is where you can discover and participate in various activities. Engage with the community and find events that interest you!',
		footer: 'There are a lot of things to explore. Click Next to continue.',
		prerendered: true
	},
	{
		url: '/articles',
		id: 'navbar',
		title: 'Articles Page',
		description:
			'The Articles page offers a wide range of articles tailored to your interests. Read, learn, and share your thoughts with others!',
		footer:
			'Your articles are recommended to you based on your profile. Creating an account helps us personalize your experience even more. Click Next to continue.'
	},
	{
		url: '/prompts',
		id: 'prompts-title',
		title: 'Prompts Page',
		description:
			'After all that knowledge, you might want to get creative! Answer questions and prompts to spark your imagination and share your ideas with the community.',
		footer: 'Click Next to continue.'
	},
	{
		url: '/signup',
		id: 'signup',
		title: 'Sign Up',
		description:
			'Create an account to unlock personalized features and connect with the community on the Earth App.',
		footer: 'Thank you for taking the tour! Click Finish to get started.',
		anonymous: true
	},
	{
		url: '/profile',
		id: 'activities',
		title: 'Your Profile',
		description:
			'Your profile helps us recommend articles and activities that match your interests. Customize it to get the most out of the Earth App!',
		footer: "You can add the activities you're interested in right here.",
		anonymous: false
	},
	{
		id: 'avatar',
		title: 'Your Avatar',
		description:
			'Based on the activities you choose, you can get your own customized profile avatar! This avatar will represent you across the Earth App community, and will be displayed on your profile.',
		footer:
			'You can create or regenerate it by clicking on "Regenerate Avatar" below your current avatar. The default avatar is the site logo.',
		anonymous: false
	},
	{
		id: 'settings',
		title: 'Your Settings',
		description:
			"In your settings, you can control your account visibility and other preferences. Make sure to review them to tailor your experience on the Earth App. Be safe and make sure you don't share sensitive information!",
		footer:
			'You can change your email and add a variety of information here. Click on the fields for more information as well.',
		anonymous: false
	},
	{
		id: 'notifications',
		title: 'Notifications',
		description:
			'Stay updated with the latest news, updates, and interactions through your notifications. Click on the bell icon to view your notifications and stay connected with the community!',
		footer:
			'You can view your notifications through the bell icon in the navigation bar. Click Next to continue.',
		anonymous: false
	},
	{
		id: 'badges',
		title: 'Badges',
		description:
			'Badges are a fun way to show off your achievements and interests on the Earth App. You can earn badges by engaging with content and participating in activities.',
		footer: 'You can view your badges on your profile through this button. Click Next to continue.',
		anonymous: false
	},
	{
		id: 'quests',
		title: 'Quests',
		description:
			'Quests are a new feature on the Earth App that encourage you to explore and engage with content in a fun and interactive way. Completing quests can earn you rewards and help you discover new interests!',
		footer: 'You can view your quests on your profile through this button. Click Next to continue.',
		anonymous: false
	},
	{
		url: `/profile/@${user.value?.username}`,
		id: 'navbar',
		title: 'Your Public Profile',
		description:
			'This is how people will see your profile. Make sure to keep it updated and engaging to connect with like-minded individuals on the Earth App!',
		footer:
			'You may be able to see fields that other users cannot based on your settings. The avatar is public!',
		anonymous: false,
		prerendered: true
	},
	{
		id: 'points-history',
		title: 'Points History',
		description:
			'Engaging with The Earth App rewards you Impact Points! You can view your points history to see how you have earned points over time. Keep engaging with content and activities to earn more points and climb the leaderboard!',
		footer:
			'You can view your points history by clicking on the "Points History" button on your profile. Click Next to continue.',
		anonymous: false
	},
	{
		id: 'user-activities',
		title: 'Your Activities',
		description:
			"Your activities are the things you selected you're interested in. Your experience is tailored based on what you select here, so make sure to keep it updated! Your activities also show up on your profile, and are a fun way for other users to see what you're interested in at a glance.",
		footer:
			'Keep exploring to increase the streak. The more you engage, the more your activities grow!',
		anonymous: false
	},
	{
		id: 'user-friends',
		title: 'Your Friends',
		description:
			'Your friends are the people you connect with on the Earth App. You can view their profiles, see their activities, and engage with their content. Building a network of friends can enhance your experience and help you discover new interests!',
		footer: 'Connect with friends to see their activities and content. Click Next to continue.',
		anonymous: false
	},
	{
		id: 'user-journeys',
		title: 'Your Journeys',
		description:
			"Your journeys showcase the content you have engaged with. It's like a streak that you have to keep up with.",
		footer:
			'Keep exploring to increase the streak. The more you engage, the more your journeys grow!',
		anonymous: false
	},
	{
		id: 'user-content',
		title: 'Your Content',
		description:
			'All the articles and prompts you have created will be displayed here. Share your knowledge and creativity with the Earth App community!',
		footer:
			'The more content you create, the more you contribute to the community. Keep sharing your ideas, thoughts, stories!',
		anonymous: false
	}
];
</script>
