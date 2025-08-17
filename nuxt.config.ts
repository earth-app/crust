import { defineNuxtConfig } from 'nuxt/config';

import tailwindcss from '@tailwindcss/vite';

export default defineNuxtConfig({
	runtimeConfig: {
		adminApiKey: process.env.NUXT_ADMIN_API_KEY || '',
		baseUrl: process.env.NUXT_BASE_URL || 'https://app.earth-app.com',
		public: {
			baseUrl: process.env.NUXT_PUBLIC_BASE_URL || 'https://app.earth-app.com',
			apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || 'https://api.earth-app.com',
			cloudBaseUrl: process.env.NUXT_PUBLIC_CLOUD_BASE_URL || 'https://cloud.earth-app.com',
			v3SiteKey: process.env.NUXT_PUBLIC_RECAPTCHA_V3_SITE_KEY || ''
		}
	},
	ssr: true,
	compatibilityDate: '2025-06-20',
	devtools: { enabled: true },
	srcDir: 'src',
	serverDir: 'src/server',
	css: ['~/assets/css/main.css'],
	vite: {
		plugins: [tailwindcss()]
	},
	nitro: {
		preset: 'cloudflare_module',
		cloudflare: {
			deployConfig: true,
			nodeCompat: true
		}
	},
	hub: {
		projectKey: 'earthapp-crust-tdti',
		bindings: {
			compatibilityDate: '2025-06-20',
			observability: {
				logs: {
					head_sampling_rate: 0.1
				}
			}
		}
	},
	routeRules: {
		'/': { prerender: true },
		'/api/*': { cache: { maxAge: 360, swr: true } }
	},

	modules: [
		'@nuxthub/core',
		'@nuxt/ui',
		'@nuxtjs/i18n',
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
	],
	i18n: {
		defaultLocale: 'en'
	}
});
