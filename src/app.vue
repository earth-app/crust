<template>
	<UApp :toaster="{ expand: false }">
		<NuxtLayout>
			<NuxtPage />
		</NuxtLayout>
	</UApp>
</template>

<script setup lang="ts">
const appConfig = useAppConfig();

useSeoMeta({
	charset: 'utf-8',
	viewport: {
		width: 'device-width',
		initialScale: 1,
		minimumScale: 1,
		maximumScale: 1,
		userScalable: 'no'
	},
	applicationName: appConfig.name,
	title: appConfig.name,
	description: appConfig.description,
	ogTitle: appConfig.name,
	author: 'Gregory Mitchell',
	creator: 'Gregory Mitchell',
	ogDescription: appConfig.description,
	ogImage: 'https://cdn.earth-app.com/earth-app.png',
	ogLocale: 'en_US',
	ogType: 'website',
	ogSiteName: appConfig.name,
	ogUrl: 'https://earth-app.com',
	twitterTitle: appConfig.name,
	twitterDescription: appConfig.description,
	twitterCard: 'summary_large_image',
	twitterCreator: '@the_earth_app',
	themeColor: {
		content: appConfig.themeColor,
		media: '(prefers-color-scheme: dark)'
	},
	msapplicationTileColor: appConfig.themeColor,
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
