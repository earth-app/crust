<template>
	<UApp :toaster="{ expand: false }">
		<BadgeUnlockRibbon />
		<NuxtLayout>
			<NuxtPage />
		</NuxtLayout>
	</UApp>
</template>

<script setup lang="ts">
const appConfig = useAppConfig();
const route = useRoute();
const siteUrl = (useRuntimeConfig().public.baseUrl || 'https://app.earth-app.com').replace(
	/\/$/,
	''
);

// per-page, because nuxt.config declared ONE canonical pointing every route at the homepage, which
// tells crawlers every page is a duplicate of `/`
useHead({
	link: [{ rel: 'canonical', href: () => `${siteUrl}${route.path}` }]
});

useSeoMeta({
	charset: 'utf-8',
	// no maximumScale/userScalable: pinning them blocks pinch zoom, a WCAG 1.4.4 failure
	viewport: {
		width: 'device-width',
		initialScale: 1
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
	appleItunesApp: {
		appId: '6771985151'
	},
	appleMobileWebAppCapable: 'yes',
	appleMobileWebAppStatusBarStyle: 'black'
});
</script>
