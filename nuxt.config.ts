import tailwindcss from '@tailwindcss/vite';
import { defineOrganization } from 'nuxt-schema-org/schema';
import { defineNuxtConfig } from 'nuxt/config';
import { fileURLToPath } from 'url';

export default defineNuxtConfig({
	alias: {
		types: fileURLToPath(new URL('./src/shared/types', import.meta.url)),
		utils: fileURLToPath(new URL('./src/shared/utils/util', import.meta.url)),
		schemas: fileURLToPath(new URL('./src/shared/utils/schemas', import.meta.url)),
		errors: fileURLToPath(new URL('./src/shared/utils/errors', import.meta.url)),
		stores: fileURLToPath(new URL('./src/stores', import.meta.url))
	},
	runtimeConfig: {
		baseUrl: process.env.NUXT_BASE_URL || 'https://app.earth-app.com',
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
			appleTeamId: process.env.NUXT_PUBLIC_APPLE_TEAM_ID || '',
			appleClientId: process.env.NUXT_PUBLIC_APPLE_CLIENT_ID || '',
			// public keys & ids
			mapsApiKey: process.env.NUXT_PUBLIC_MAPS_API_KEY || '',
			unsplashApplicationId: process.env.NUXT_PUBLIC_UNSPLASH_APPLICATION_ID || '',
			// only true in test builds; gates the deterministic client-moderation hook used by e2e
			testBuild: process.env.NUXT_PUBLIC_TEST_BUILD === '1'
		},
		turnstile: {
			secretKey: process.env.NUXT_TURNSTILE_SECRET_KEY || ''
		},
		// api keys and secrets
		adminApiKey: process.env.NUXT_ADMIN_API_KEY || '',
		pixabayApiKey: process.env.NUXT_PIXABAY_API_KEY || '',
		mapsApiKey: process.env.NUXT_MAPS_API_KEY || '',
		unsplashAccessKey: process.env.NUXT_UNSPLASH_ACCESS_KEY || '',
		// oauth client secrets
		googleClientSecret: process.env.NUXT_GOOGLE_CLIENT_SECRET || '',
		microsoftClientSecret: process.env.NUXT_MICROSOFT_CLIENT_SECRET || '',
		discordClientSecret: process.env.NUXT_DISCORD_CLIENT_SECRET || '',
		githubClientSecret: process.env.NUXT_GITHUB_CLIENT_SECRET || '',
		facebookClientSecret: process.env.NUXT_FACEBOOK_CLIENT_SECRET || '',
		applePrivateKey: process.env.NUXT_APPLE_PRIVATE_KEY || '',
		appleKeyId: process.env.NUXT_APPLE_KEY_ID || ''
	},
	ssr: true,
	compatibilityDate: '2025-12-13',
	// Disable devtools in production to reduce client bundle size and overhead
	devtools: { enabled: process.env.NODE_ENV !== 'production' },
	srcDir: 'src',
	serverDir: 'src/server',
	dir: {
		shared: 'src/shared'
	},
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
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		plugins: [tailwindcss() as any],
		optimizeDeps: {
			include: [
				'@vue/devtools-core',
				'@vue/devtools-kit',
				'@tensorflow/tfjs',
				'@earth-app/ocean',
				'@internationalized/date',
				'luxon',
				'zod',
				'obscenity',
				'nsfwjs',
				'tesseract.js',
				'html-to-image',
				'gif.js',
				'upng-js'
			]
		},
		ssr: {
			noExternal: ['@earth-app/ocean']
		},
		build: {
			reportCompressedSize: false
		}
	},
	sourcemap: {
		client: process.env.NUXT_TEST_BUILD === '1',
		server: process.env.NUXT_TEST_BUILD === '1'
	},
	nitro: {
		preset: process.env.NUXT_TEST_BUILD === '1' ? 'node-server' : 'cloudflare_module',
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
		},
		storage: {
			shield: {
				driver: 'cloudflare-kv-binding',
				binding: 'CACHE'
			}
		}
	},
	hub: {
		cache: true
	},
	routeRules: {
		// Static pages, assets (prerender at build time)
		'/about': { prerender: true },
		'/tos': { redirect: '/terms-of-service' },
		'/terms-of-service': { prerender: true },
		'/privacy-policy': { prerender: true },
		'/refund-policy': { prerender: true },
		'/pricing': { prerender: true },

		// Client-side only pages (auth, profiles, admin)
		'/login': { ssr: false },
		'/signup': { ssr: false },
		'/verify-email': { ssr: false },
		'/change-password': { ssr: false },
		'/reset-password': { ssr: false },
		'/profile/**': { ssr: false },
		'/admin': { ssr: false },
		'/oauth/complete': { ssr: false },
		'/invite/**': { ssr: false },

		'/': process.env.NUXT_TEST_BUILD === '1' ? {} : { isr: 120 },
		'/activities': process.env.NUXT_TEST_BUILD === '1' ? {} : { isr: 300 },
		'/articles': process.env.NUXT_TEST_BUILD === '1' ? {} : { isr: 120 },
		'/prompts': process.env.NUXT_TEST_BUILD === '1' ? {} : { isr: 120 },
		'/events': process.env.NUXT_TEST_BUILD === '1' ? {} : { isr: 60 },
		'/leaderboard': process.env.NUXT_TEST_BUILD === '1' ? {} : { isr: 120 },

		'/share/**': process.env.NUXT_TEST_BUILD === '1' ? {} : { isr: 300 },

		'/.well-known/apple-app-site-association': {
			headers: { 'content-type': 'application/json' }
		},

		// API routes
		'/api/**': { cors: false },

		// No-cache API routes
		'/api/user/journey': { cache: false },
		'/api/user/referral/click': { cache: false },
		'/api/turnstile': { cache: false },
		'/api/auth/session': {
			cache: false,
			headers: {
				'cache-control': 'no-store, no-cache, must-revalidate, max-age=0'
			}
		},
		'/api/article/recommend': { cache: false }, // User-specific
		'/api/article/similar': { cache: false }, // Article-specific
		'/api/admin/**': { cache: false },
		/// Auth-required, rate-limited endpoints
		'/api/activity/unsplash': { cache: false },
		'/api/activity/pixabayImages': { cache: false },
		'/api/activity/pixabayVideos': { cache: false },
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
		'@nuxt/hints',
		'@vueuse/nuxt',
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
		],
		'@nuxt/test-utils/module',
		[
			'@codecov/nuxt-plugin',
			{
				enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
				bundleName: 'crust',
				uploadToken: process.env.CODECOV_TOKEN
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
	ui: {
		theme: {
			colors: ['primary', 'secondary', 'tertiary', 'info', 'success', 'warning', 'error']
		}
	},
	experimental: {
		renderJsonPayloads: true,
		viewTransition: true,
		appManifest: true,
		checkOutdatedBuildInterval: 60_000
	},
	sitemap: {
		exclude: [
			'/admin',
			'/login',
			'/login/**',
			'/signup',
			'/verify-email',
			'/change-password',
			'/reset-password',
			'/oauth/**',
			'/profile',
			'/profile/**',
			'/invite/**',
			'/subscription/**',
			'/articles/new',
			'/prompts/new',
			'/__test__/**'
		]
	},
	robots: {
		// config is the source of truth; internal-only routes should never be crawled
		mergeWithRobotsTxtPath: false,
		disallow: ['/admin', '/oauth/', '/__test__/']
	},
	schemaOrg: {
		identity: defineOrganization({
			name: 'The Earth App',
			logo: '/earth-app.png',
			url: 'https://earth-app.com',
			foundingDate: '2025-05-04'
		})
	}
});
