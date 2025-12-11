import tailwindcss from '@tailwindcss/vite';
import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
	compatibilityDate: '2025-06-20',
	srcDir: 'src',
	css: ['~/assets/css/main.css'],
	vite: {
		plugins: [tailwindcss()]
	},
	modules: [
		'@nuxt/ui',
		'@nuxtjs/i18n',
		'@nuxt/image',
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
	}
});
