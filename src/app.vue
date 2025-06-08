<template>
    <nuxt-page />
    <div>
        <nav-bar />
    </div>
</template>

<script setup>
import NavBar from './components/NavBar.vue'

useHead({
    meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Meet Real People' },
        { name: 'keywords', content: 'Earth, App, Explore' },
        { name: 'author', content: 'Gregory Mitchell' },
    ]
})

useSeoMeta({
    title: 'The Earth App',
    ogTitle: 'The Earth App',
    description: 'Explore with real people',
    ogDescription: 'Explore with real people',
    ogImage: 'https://cdn.earth-app.com/earth-app.png',
    twitterCard: 'summary_large_image',
})
</script>