<template>
	<div>
		<NuxtLayout>
			<NuxtPage />
		</NuxtLayout>
	</div>
</template>

<script setup>
import { SITE_DESCRIPTION, SITE_NAME } from './compostables/useConstants';

useHead({
	meta: [
		{ name: 'viewport', content: 'width=device-width, initial-scale=1' },
		{ name: 'description', content: 'Meet Real People' },
		{ name: 'keywords', content: 'Earth, App, Explore' },
		{ name: 'author', content: 'Gregory Mitchell' },
	],
	link: [
		{ rel: 'icon', type: 'image/png', href: '/favicon.png' },
		{ rel: 'apple-touch-icon', href: '/favicon.png' },
	],
});

useSeoMeta({
	title: SITE_NAME,
	description: SITE_DESCRIPTION,
	ogTitle: SITE_NAME,
	ogDescription: SITE_DESCRIPTION,
	ogLocale: 'en_US',
	ogImage: 'https://cdn.earth-app.com/earth-app.png',
	twitterCard: 'summary_large_image',
});
</script>
