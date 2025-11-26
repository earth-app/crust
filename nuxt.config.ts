import tailwindcss from '@tailwindcss/vite';
import { defineOrganization } from 'nuxt-schema-org/schema';
import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
	runtimeConfig: {
		adminApiKey: process.env.NUXT_ADMIN_API_KEY || '',
		baseUrl: process.env.NUXT_BASE_URL || 'https://app.earth-app.com',
		public: {
			baseUrl: process.env.NUXT_PUBLIC_BASE_URL || 'https://app.earth-app.com',
			apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || 'https://api.earth-app.com',
			cloudBaseUrl: process.env.NUXT_PUBLIC_CLOUD_BASE_URL || 'https://cloud.earth-app.com'
		},
		turnstile: {
			secretKey: process.env.NUXT_TURNSTILE_SECRET_KEY || ''
		}
	},
	ssr: true,
	compatibilityDate: '2025-06-20',
	// Disable devtools in production to reduce client bundle size and overhead
	devtools: { enabled: process.env.NODE_ENV !== 'production' },
	srcDir: 'src',
	serverDir: 'src/server',
	css: ['~/assets/css/main.css'],
	// Add global head optimizations (preconnect + dns-prefetch) for critical external domains
	app: {
		head: {
			link: [
				{ rel: 'preconnect', href: 'https://cdn.earth-app.com' },
				{ rel: 'dns-prefetch', href: 'https://cdn.earth-app.com' },
				{ rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
				{ rel: 'dns-prefetch', href: 'https://fonts.gstatic.com' },
				{ rel: 'preconnect', href: 'https://www.youtube.com' },
				{ rel: 'dns-prefetch', href: 'https://www.youtube.com' },
				{ rel: 'preconnect', href: 'https://api.earth-app.com' },
				{ rel: 'dns-prefetch', href: 'https://api.earth-app.com' }
			]
		}
	},
	vite: {
		plugins: [tailwindcss()]
	},
	nitro: {
		preset: 'cloudflare_module',
		cloudflare: {
			deployConfig: true,
			nodeCompat: true
		},
		prerender: {
			routes: ['/sitemap.xml']
		}
	},
	hub: {
		projectKey: 'earthapp-crust-tdti',
		bindings: {
			compatibilityDate: '2025-06-20',
			observability: {
				logs: {
					head_sampling_rate: 0.2
				}
			}
		},
		cache: true
	},
	routeRules: {
		// Static pages, assets (prerender at build time)
		'/about': { prerender: true },

		// Client-side only pages (auth, profiles, admin)
		'/login': { ssr: false },
		'/signup': { ssr: false },
		'/verify-email': { ssr: false, robots: false },
		'/change-password': { ssr: false, robots: false },
		'/profile/**': { ssr: false },
		'/admin': { ssr: false, robots: false },

		// Content listing pages (ISR)
		'/': { isr: 3600 }, // Homepage regenerates every hour
		'/activities': { isr: 14400 }, // Regenerate every 4 hours
		'/articles': { isr: 3600 }, // Regenerate every hour
		'/prompts': { isr: 900 }, // Regenerate every 15 minutes

		// Individual content pages (SWR)
		'/activities/**': { swr: 14400 }, // Cache 4 hours
		'/articles/**': { swr: 3600 }, // Cache 1 hour
		'/prompts/**': { swr: 1800 }, // Cache 30 minutes

		// API routes
		'/api/**': { cors: true },

		// No-cache API routes
		'/api/user/journey': { cors: true, cache: false },
		'/api/turnstile': { cors: true, cache: false },
		'/api/article/recommend': { cors: true, cache: false }, // User-specific
		'/api/article/similar': { cors: true, cache: false }, // Article-specific
		'/api/admin/**': { cors: true, cache: false },

		// Cached API routes
		'/api/activity/**': { cors: true, cache: { maxAge: 3600 } } // 1 hour cache
	},

	modules: [
		'@nuxthub/core',
		'@nuxt/ui',
		'@nuxtjs/i18n',
		'@nuxtjs/turnstile',
		'nuxt-viewport',
		'@nuxtjs/robots',
		'@nuxtjs/sitemap',
		'@nuxt/image',
		'nuxt-schema-org',
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
		locales: [{ code: 'en', language: 'en-US' }],
		defaultLocale: 'en'
	},
	turnstile: {
		siteKey: process.env.NUXT_PUBLIC_TURNSTILE_SITE_KEY || '',
		addValidateEndpoint: true
	},
	experimental: {
		renderJsonPayloads: true
	},
	schemaOrg: {
		identity: defineOrganization({
			name: 'The Earth App',
			logo: '/earth-app.png',
			url: 'https://earth-app.com'
		})
	}
});
