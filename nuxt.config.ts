import tailwindcss from '@tailwindcss/vite';
import { defineOrganization } from 'nuxt-schema-org/schema';
import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
	runtimeConfig: {
		adminApiKey: process.env.NUXT_ADMIN_API_KEY || '',
		pixabayApiKey: process.env.NUXT_PIXABAY_API_KEY || '',
		baseUrl: process.env.NUXT_BASE_URL || 'https://app.earth-app.com',
		mapsApiKey: process.env.NUXT_MAPS_API_KEY || '',
		public: {
			baseUrl: process.env.NUXT_PUBLIC_BASE_URL || 'https://app.earth-app.com',
			apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || 'https://api.earth-app.com',
			cloudBaseUrl: process.env.NUXT_PUBLIC_CLOUD_BASE_URL || 'https://cloud.earth-app.com',
			// oauth client ids
			googleClientId: process.env.NUXT_PUBLIC_GOOGLE_CLIENT_ID || '',
			microsoftClientId: process.env.NUXT_PUBLIC_MICROSOFT_CLIENT_ID || '',
			githubClientId: process.env.NUXT_PUBLIC_GITHUB_CLIENT_ID || '',
			discordClientId: process.env.NUXT_PUBLIC_DISCORD_CLIENT_ID || '',
			facebookClientId: process.env.NUXT_PUBLIC_FACEBOOK_CLIENT_ID || '',
			// public keys
			mapsApiKey: process.env.NUXT_PUBLIC_MAPS_API_KEY || ''
		},
		turnstile: {
			secretKey: process.env.NUXT_TURNSTILE_SECRET_KEY || ''
		},
		// oauth client secrets
		googleClientSecret: process.env.NUXT_GOOGLE_CLIENT_SECRET || '',
		microsoftClientSecret: process.env.NUXT_MICROSOFT_CLIENT_SECRET || '',
		discordClientSecret: process.env.NUXT_DISCORD_CLIENT_SECRET || '',
		githubClientSecret: process.env.NUXT_GITHUB_CLIENT_SECRET || '',
		facebookClientSecret: process.env.NUXT_FACEBOOK_CLIENT_SECRET || ''
	},
	ssr: true,
	compatibilityDate: '2025-12-13',
	// Disable devtools in production to reduce client bundle size and overhead
	devtools: { enabled: process.env.NODE_ENV !== 'production' },
	srcDir: 'src',
	serverDir: 'src/server',
	css: ['~/assets/css/main.css'],
	// Add global head optimizations (preconnect + dns-prefetch) for critical external domains
	app: {
		head: {
			link: [
				{ rel: 'canonical', href: 'https://app.earth-app.com' },
				{ rel: 'preconnect', href: 'https://cdn.earth-app.com' },
				{ rel: 'dns-prefetch', href: 'https://cdn.earth-app.com' },
				{ rel: 'preconnect', href: 'https://fonts.googleapis.com' },
				{ rel: 'dns-prefetch', href: 'https://fonts.googleapis.com' },
				{ rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' },
				{ rel: 'dns-prefetch', href: 'https://fonts.gstatic.com' },
				{ rel: 'preconnect', href: 'https://www.youtube.com' },
				{ rel: 'dns-prefetch', href: 'https://www.youtube.com' },
				{ rel: 'preconnect', href: 'https://api.earth-app.com' },
				{ rel: 'dns-prefetch', href: 'https://api.earth-app.com', crossorigin: 'use-credentials' }
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
			nodeCompat: true,
			wrangler: {
				name: 'earthapp-crust',
				observability: {
					enabled: true,
					head_sampling_rate: 0.2
				}
			}
		},
		prerender: {
			routes: ['/sitemap.xml']
		}
	},
	hub: {
		cache: true
	},
	routeRules: {
		// Static pages, assets (prerender at build time)
		'/about': { prerender: true },
		'/terms-of-service': { prerender: true },
		'/privacy-policy': { prerender: true },

		// Client-side only pages (auth, profiles, admin)
		'/login': { ssr: false },
		'/signup': { ssr: false },
		'/verify-email': { ssr: false },
		'/change-password': { ssr: false },
		'/profile/**': { ssr: false },
		'/admin': { ssr: false },

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
		'/api/**': { cors: false },

		// No-cache API routes
		'/api/user/journey': { cache: false },
		'/api/turnstile': { cache: false },
		'/api/article/recommend': { cache: false }, // User-specific
		'/api/article/similar': { cache: false }, // Article-specific
		'/api/admin/**': { cache: false },
		// Cached API routes
		'/api/activity/**': { cache: { maxAge: 3600 } } // 1 hour cache
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
		'nuxt-api-shield',
		'@pinia/nuxt',
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
	nuxtApiShield: {
		limit: {
			max: 500,
			duration: 60,
			ban: 300
		},
		delayOnBan: true,
		errorMessage: 'Too many requests from this IP, please try again later.',
		routes: ['/api/admin/**', '/api/event/autocomplete'],
		log: {
			path: '',
			attempts: 100
		}
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
