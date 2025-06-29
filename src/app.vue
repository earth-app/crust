<template>
	<div>
		<NuxtLayout>
			<NuxtPage />
		</NuxtLayout>
	</div>
</template>

<script setup>
import { SITE_DESCRIPTION, SITE_NAME, THEME_COLOR } from './compostables/useConstants';
import { useAuth } from './compostables/useUser';

useHead({
	meta: [
		{ name: 'viewport', content: 'width=device-width, initial-scale=1' },
		{ name: 'application-name', content: SITE_NAME },
		{ name: 'description', content: SITE_DESCRIPTION },
		{ name: 'keywords', content: 'Earth, App, Explore' },
		{ name: 'author', content: 'Gregory Mitchell' },
		{ name: 'theme-color', content: THEME_COLOR },
		{ name: 'apple-mobile-web-app-capable', content: 'yes' },
		{ name: 'apple-mobile-web-app-status-bar-style', content: 'black' },
		{ name: 'mobile-web-app-capable', content: 'yes' },
		{ name: 'msapplication-TileColor', content: THEME_COLOR },
		{ name: 'msapplication-TileImage', content: '/favicon.png' },
	],
});

useSeoMeta({
	title: SITE_NAME,
	description: SITE_DESCRIPTION,
	ogTitle: SITE_NAME,
	ogDescription: SITE_DESCRIPTION,
	ogImage: 'https://cdn.earth-app.com/earth-app.png',
	ogLocale: 'en_US',
	ogType: 'website',
	ogSiteName: SITE_NAME,
	ogUrl: 'https://earth-app.com',
	twitterTitle: SITE_NAME,
	twitterDescription: SITE_DESCRIPTION,
	twitterCard: 'summary_large_image',
	twitterCreator: '@theearthapp',
});

// Global Variables

const { fetchUser } = useAuth();
onMounted(() => {
	fetchUser();
});
</script>
