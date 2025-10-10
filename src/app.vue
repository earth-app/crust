<template>
	<UApp :toaster="{ expand: false }">
		<NuxtLayout>
			<NuxtPage />
		</NuxtLayout>
	</UApp>
</template>

<script setup>
import { SITE_DESCRIPTION, SITE_NAME, THEME_COLOR } from './compostables/useConstants';
import { useAuth } from './compostables/useUser';

useSeoMeta({
	charset: 'utf-8',
	viewport: {
		width: 'device-width',
		initialScale: 1,
		minimumScale: 1,
		maximumScale: 1,
		userScalable: 'no'
	},
	applicationName: SITE_NAME,
	title: SITE_NAME,
	description: SITE_DESCRIPTION,
	ogTitle: SITE_NAME,
	author: 'Gregory Mitchell',
	creator: 'Gregory Mitchell',
	ogDescription: SITE_DESCRIPTION,
	ogImage: 'https://cdn.earth-app.com/earth-app.png',
	ogLocale: 'en_US',
	ogType: 'website',
	ogSiteName: SITE_NAME,
	ogUrl: 'https://earth-app.com',
	twitterTitle: SITE_NAME,
	twitterDescription: SITE_DESCRIPTION,
	twitterCard: 'summary_large_image',
	twitterCreator: '@the_earth_app',
	themeColor: {
		color: THEME_COLOR,
		media: '(prefers-color-scheme: dark)'
	},
	msapplicationTileColor: THEME_COLOR,
	msapplicationTileImage: '/earth-app.png',
	mobileWebAppCapable: 'yes',
	appleMobileWebAppCapable: 'yes',
	appleMobileWebAppStatusBarStyle: 'black'
});

// Global Variables

const { fetchUser } = useAuth();
onMounted(() => {
	fetchUser();
});
</script>
