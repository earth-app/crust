<template>
	<NavBar />
	<main class="min-h-[90vh] w-full">
		<slot />
	</main>
	<Footer />

	<SiteTour
		:steps="welcomeTour"
		name="Welcome Tour"
		tourId="welcome"
	/>
</template>

<script setup lang="ts">
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
		footer: 'There are a lot of things to explore. Click Next to continue.'
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
		footer: 'Enjoy exploring the Earth App! Click Next to end the tour.'
	},
	{
		url: '/signup',
		id: 'signup',
		title: 'Sign Up',
		description:
			'Create an account to unlock personalized features and connect with the community on the Earth App.',
		footer: 'Thank you for taking the tour! Click Finish to get started.'
	}
];
</script>
