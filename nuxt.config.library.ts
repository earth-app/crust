import tailwindcss from '@tailwindcss/vite';
import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
	runtimeConfig: {
		public: {
			googleClientId: process.env.NUXT_PUBLIC_GOOGLE_CLIENT_ID || '',
			microsoftClientId: process.env.NUXT_PUBLIC_MICROSOFT_CLIENT_ID || '',
			githubClientId: process.env.NUXT_PUBLIC_GITHUB_CLIENT_ID || '',
			discordClientId: process.env.NUXT_PUBLIC_DISCORD_CLIENT_ID || '',
			facebookClientId: process.env.NUXT_PUBLIC_FACEBOOK_CLIENT_ID || '',
			// public keys
			mapsApiKey: process.env.NUXT_PUBLIC_MAPS_API_KEY || ''
		}
	},
	compatibilityDate: '2025-12-13',
	srcDir: 'src',
	dir: {
		shared: 'src/shared'
	},
	css: ['~/assets/css/main.css'],
	vite: {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		plugins: [tailwindcss() as any]
	},
	modules: [
		'@nuxt/ui',
		'@nuxtjs/i18n',
		'@nuxt/image',
		'nuxt-viewport',
		'@pinia/nuxt',
		'@nuxt/hints',
		[
			'@nuxt/icon',
			{
				icon: {
					mode: 'css',
					cssLayer: 'base',
					size: '48px'
				}
			}
		]
	],
	i18n: {
		locales: [{ code: 'en', language: 'en-US' }],
		defaultLocale: 'en'
	},
	image: {
		provider: 'none'
	}
});
