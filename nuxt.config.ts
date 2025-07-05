import { defineNuxtConfig } from 'nuxt/config';

import tailwindcss from '@tailwindcss/vite';

export default defineNuxtConfig({
	runtimeConfig: {
		public: {
			apiBaseUrl: 'https://api.earth-app.com'
		}
	},
	ssr: true,
	compatibilityDate: '2025-06-20',
	devtools: { enabled: true },
	srcDir: 'src',
	css: ['~/assets/css/main.css'],
	vite: {
		plugins: [tailwindcss()]
	},
	nitro: {
		preset: 'cloudflare'
	},
	routeRules: {
		'/': { prerender: true },
		'/api/*': { cache: { maxAge: 360, swr: true } }
	},

	modules: [
		'@nuxt/ui',
		[
			'@nuxtjs/google-fonts',
			{
				families: {
					'Noto+Sans': true
				}
			}
		],
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
	]
});
