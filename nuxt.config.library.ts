import tailwindcss from '@tailwindcss/vite';
import { defineNuxtConfig } from 'nuxt/config';
import { fileURLToPath } from 'url';

export default defineNuxtConfig({
	alias: {
		types: fileURLToPath(new URL('./src/shared/types', import.meta.url)),
		utils: fileURLToPath(new URL('./src/shared/utils/util', import.meta.url)),
		schemas: fileURLToPath(new URL('./src/shared/utils/schemas', import.meta.url)),
		errors: fileURLToPath(new URL('./src/shared/utils/errors', import.meta.url)),
		backend: fileURLToPath(new URL('./src/shared/utils/backend', import.meta.url)),
		stores: fileURLToPath(new URL('./src/stores', import.meta.url))
	},
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
		'@vueuse/nuxt',
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
	/* MUST mirror nuxt.config.ts. prepack copies this file over nuxt.config.ts before publish, and
	   @nuxt/ui REPLACES rather than extends this list, so any drift drops a colour slot from the
	   published layer. omitting it entirely is what left sky rendering `tertiary` as an empty
	   colour. tests/unit/design/library-config.spec.ts deep-equals the two */
	ui: {
		theme: {
			colors: ['primary', 'secondary', 'tertiary', 'info', 'success', 'warning', 'error']
		}
	},
	image: {
		provider: 'none'
	}
});
