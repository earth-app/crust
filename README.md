# Crust - The Earth App Frontend

> Modern, full-stack frontend application for [The Earth App](https://earth-app.com).

It serves as the user-facing web interface and API proxy layer,
deployed on **Cloudflare Workers** via **NuxtHub**.

## 🏗️ Architecture Overview

### Technology Stack

- **Framework**: [Nuxt 4](https://nuxt.com/) (Vue 3 + Server-Side Rendering)
- **Runtime**: [Bun](https://bun.sh/) (development & package management)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) + [@nuxt/ui](https://ui.nuxt.com/)
- **Type Safety**: TypeScript with strict type checking
- **Validation**: [Zod](https://zod.dev/) schemas for runtime validation
- **Date/Time**: [Luxon](https://moment.github.io/luxon/) for timezone-aware operations
- **Deployment**: [Cloudflare Workers](https://workers.cloudflare.com/) via [NuxtHub](https://hub.nuxt.com/)
- **Icons**: [@nuxt/icon](https://nuxt.com/modules/icon) with 17+ icon sets via Iconify
- **Security**: Cloudflare Turnstile for bot protection
- **Backend Integration**: [`@earth-app/ocean`](https://github.com/earth-app/ocean)
  shared types

### Application Structure

```txt
src/
├── app.vue              # Root component with global SEO meta
├── error.vue            # Global error handling page
├── assets/css/          # Global styles (Tailwind config)
├── components/          # Reusable Vue components
├── composables/         # Composable functions (state management)
├── layouts/             # Page layouts (default.vue)
├── pages/               # File-based routing
├── server/              # Nitro server routes (API proxy)
│   ├── api/             # API endpoints
│   └── utils.ts         # Server utilities (auth guards)
└── shared/              # Shared types & utilities
```

## 🚀 Key Features

### 1. **Hybrid Rendering Strategy**

Crust leverages Nuxt's flexible rendering modes for optimal performance:

- **SSR (Server-Side Rendering)**: Default for SEO-critical pages
- **ISR (Incremental Static Regeneration)**: For content listing pages
  - Homepage: regenerates every hour (`isr: 3600`)
  - Activities: every 4 hours (`isr: 14400`)
  - Prompts: every 15 minutes (`isr: 900`)
- **SWR (Stale-While-Revalidate)**: For individual content pages
  - Activities cached for 4 hours
  - Articles cached for 1 hour
  - Prompts cached for 30 minutes
- **Client-Side Only**: For authenticated pages (profiles, admin, auth flows)

```typescript
// nuxt.config.ts
routeRules: {
  '/': { isr: 3600 },                    // ISR for homepage
  '/activities/**': { swr: 14400 },       // SWR for activity pages
  '/profile/**': { ssr: false },          // Client-only for user pages
  '/api/activity/**': { cors: true, cache: { maxAge: 3600 } }
}
```

### 2. **API Proxy Architecture**

The server layer (`src/server/api/`) acts as a secure proxy to:

- **External APIs**: Wikipedia, YouTube, Iconify (for icon search)
- **Backend Services**: The Earth App's main API (`@earth-app/mantle`)
- **Third-Party Services**: Cloudflare Turnstile verification

**Benefits**:

- Hides API keys from client-side code
- Implements server-side authentication guards
- Provides caching and rate limiting
- Enables CORS configuration per endpoint

**Example**: Icon search endpoint (`src/server/api/activity/iconSearch.get.ts`)

```typescript
export default defineEventHandler(async (event) => {
	const { search } = getQuery(event);
	// Server-side fetch to Iconify API
	const response = await $fetch(`https://api.iconify.design/search?query=${search}`, {
		headers: { 'User-Agent': 'The Earth App/Web' }
	});
	return response;
});
```

### 3. **Authentication & Authorization**

- **Token-based Auth**: JWT tokens stored client-side, validated server-side
- **Composable Hooks**:
  - `useAuth()`: Current user state & avatar management
  - `useCurrentSessionToken()`: Session token retrieval
- **Server Guards** (`src/server/utils.ts`):
  - `ensureLoggedIn()`: Validates user authentication
  - `ensureAdministrator()`: Restricts admin-only routes
  - `ensureValidActivity()`: Validates activity existence

**Example**: Admin route protection

```typescript
export default defineEventHandler(async (event) => {
	await ensureAdministrator(event); // Throws 403 if not admin
	// Admin logic here...
});
```

### 4. **Type Safety & Validation**

#### Shared Type Definitions

All types are sourced from `@earth-app/ocean` (Protocol Buffers) and extended locally:

```typescript
// src/shared/types/user.ts
import { com } from '@earth-app/ocean';

export type User = {
	id: string;
	username: string;
	account: {
		account_type: typeof com.earthapp.account.AccountType.prototype.name;
		visibility: typeof com.earthapp.Visibility.prototype.name;
		field_privacy: {
			/* Privacy settings */
		};
	};
	// ...
};
```

#### Zod Schemas

Runtime validation with Zod (`src/shared/schemas.ts`):

```typescript
export const usernameSchema = z
	.string()
	.min(3, 'Must be at least 3 characters')
	.max(30, 'Must be at most 30 characters')
	.regex(/^[a-zA-Z0-9_.-]+$/, 'Invalid characters');

export const passwordSchema = z
	.string()
	.min(8, 'Must be at least 8 characters')
	.max(100, 'Must be at most 100 characters');
```

### 5. **API Request Utilities**

Centralized request handling in `src/shared/util.ts`:

- **`makeAPIRequest<T>()`**: SSR-friendly requests with `useAsyncData()`
- **`makeClientAPIRequest<T>()`**: Client-side only requests
- **`makeServerRequest<T>()`**: Server-to-server communication
- **`paginatedAPIRequest<T>()`**: Automatic pagination handling

**Features**:

- Automatic error handling (404, 401, 429, 500)
- Binary data support (profile photos)
- Token injection
- Response caching

**Example**:

```typescript
export async function getActivity(id: string) {
	return await makeAPIRequest<Activity>(
		`activity-${id}`, // Cache key
		`/v2/activities/${id}`, // API path
		useCurrentSessionToken() // Auth token
	);
}
```

### 6. **Component Architecture**

#### Feature-Based Organization

- **`activity/`**: Activity cards, profiles, admin editors
- **`admin/`**: Activity editor, modal dialogs
- **`article/`**: Article cards, full-page readers
- **`prompt/`**: Prompt cards, creation menus, responses
- **`user/`**: Profiles, login/signup forms, settings modals

#### Reusable UI Components

- `InfoCard` & `InfoCardGroup`: Content display grids
- `EarthCircle`: Animated homepage logo
- `TurnstileWidget`: Cloudflare captcha integration
- `SiteTour`: Guided onboarding (via `useSiteTour()`)

### 7. **SEO & Metadata**

Configured in `app.vue` with `useSeoMeta()`:

- Open Graph tags for social sharing
- Twitter Card metadata
- Dynamic titles via `useTitleSuffix()`
- Application metadata (theme colors, mobile-web-app-capable)

**Sitemap Generation**:

- Prerendered at build time (`/sitemap.xml`)
- Configured via `@nuxtjs/sitemap` module

**Robots.txt**:

- Static file at `public/_robots.txt`
- Managed by `@nuxtjs/robots` module
- Blocks sensitive routes (`/admin`, `/verify-email`, etc.)

### 8. **Internationalization (i18n)**

Configured via `@nuxtjs/i18n`:

- Current: English (`en-US`)
- Prepared for multi-language expansion
- Locale-aware routing

### 9. **Developer Experience**

#### Code Quality

- **Prettier**: Auto-formatting on commit (via Husky + lint-staged)
- **TypeScript**: Strict mode enabled
- **Bun**: Fast package installation & script execution

#### Scripts

```json
{
	"dev": "bunx nuxi dev --host --port 3000",
	"dev:remote": "bunx nuxi dev --dotenv .config/production.env",
	"build": "nuxt build",
	"prettier": "bunx prettier --write .",
	"prettier:check": "bunx prettier --check ."
}
```

#### Environment Configuration

- **Local**: `.config/local.env`
- **Production**: `.config/production.env` + `.env.local`
- **Runtime Config**: `nuxt.config.ts` with public/private keys

**Key Variables**:

```bash
NUXT_PUBLIC_API_BASE_URL=https://api.earth-app.com
NUXT_PUBLIC_CLOUD_BASE_URL=https://cloud.earth-app.com
NUXT_TURNSTILE_SECRET_KEY=<secret>
NUXT_ADMIN_API_KEY=<secret>
```

## 📦 Dependencies

### Core Dependencies

- **`@earth-app/ocean`**: Shared Protocol Buffer types
- **`nuxt`**: Framework core
- **`vue`** & **`vue-router`**: UI framework & routing
- **`tailwindcss`** & **`@nuxt/ui`**: Styling system
- **`zod`**: Schema validation
- **`luxon`**: Date/time handling
- **`youtube-sr`**: YouTube search integration

### Nuxt Modules

- **`@nuxthub/core`**: Cloudflare deployment integration
- **`@nuxtjs/turnstile`**: Bot protection
- **`@nuxtjs/i18n`**: Internationalization
- **`@nuxtjs/google-fonts`**: Noto Sans font loading
- **`@nuxtjs/robots`** & **`@nuxtjs/sitemap`**: SEO tooling
- **`nuxt-viewport`**: Responsive breakpoint utilities

### Icon Collections

17 Iconify sets included via `devDependencies`:

- Material Design (symbols, symbols-light)
- Lucide, Heroicons, Phosphor
- Carbon, Solar, Game Icons, Health Icons
- And more (see `package.json`)

## 🔧 Configuration Deep Dive

### Nuxt Config Highlights

```typescript
export default defineNuxtConfig({
	runtimeConfig: {
		adminApiKey: process.env.NUXT_ADMIN_API_KEY,
		baseUrl: process.env.NUXT_BASE_URL,
		public: {
			apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL,
			cloudBaseUrl: process.env.NUXT_PUBLIC_CLOUD_BASE_URL
		},
		turnstile: {
			secretKey: process.env.NUXT_TURNSTILE_SECRET_KEY
		}
	},
	ssr: true,
	compatibilityDate: '2025-06-20',
	srcDir: 'src',
	serverDir: 'src/server',

	nitro: {
		preset: 'cloudflare_module',
		cloudflare: {
			deployConfig: true,
			nodeCompat: true
		}
	},

	hub: {
		projectKey: 'earthapp-crust-tdti',
		cache: true,
		bindings: {
			observability: { logs: { head_sampling_rate: 0.2 } }
		}
	}
});
```

### Tailwind CSS v4 Configuration

Custom theme in `src/assets/css/main.css`:

```css
@theme {
	--color-primary: #43b54d; /* Earth green */
	--color-secondary: #174f96; /* Ocean blue */
	--color-accent: #f8f9fb; /* Light gray */
	--font-title: 'Noto Sans', sans-serif;
}
```

## 🚢 Deployment

### Cloudflare Workers (via NuxtHub)

**Build Command**: `nuxt build`
**Output**: Cloudflare Workers module
**Features**:

- Edge-deployed server functions
- Automatic caching via Cloudflare CDN
- Node.js compatibility mode enabled
- Observability at 20% head sampling

**Deployment Workflow**:

1. Code pushed to GitHub (branch: `master`)
2. CI/CD builds Nuxt app
3. NuxtHub deploys to Cloudflare Workers
4. Static assets served from Cloudflare CDN

### Route Prerendering

Static routes generated at build time:

- `/about` (fully static)
- `/sitemap.xml` (SEO)

Dynamic routes use ISR/SWR for on-demand regeneration.

## 🔐 Security Features

1. **Cloudflare Turnstile**: Bot protection on auth forms
2. **Server-Side Token Validation**: All API requests validated via backend
3. **CORS Configuration**: Explicit CORS rules per API route
4. **Rate Limiting**: Handled by backend API (429 responses)
5. **Content Security**: Admin routes require `ADMINISTRATOR` account type
6. **Environment Secrets**: All sensitive keys in runtime config (never client-exposed)

## 🧪 Development Workflow

### Local Development

```bash
# Install dependencies
bun install

# Run dev server (local environment)
bun run dev

# Run dev server (production environment)
bun run dev:remote

# Format code
bun run prettier

# Check formatting
bun run prettier:check
```

### Environment Setup

Create `.config/local.env`:

```env
NUXT_PUBLIC_API_BASE_URL=http://localhost:8080
NUXT_PUBLIC_CLOUD_BASE_URL=http://localhost:9000
NUXT_TURNSTILE_SECRET_KEY=1x00000000000000000000AA
```

### Hot Module Replacement

- **Vue components**: Instant updates
- **Composables**: Auto-reload on change
- **Server routes**: Requires manual restart (use `--no-restart` flag cautiously)

### Type Checking

```bash
# Run type checker
bunx vue-tsc --noEmit
```

## 📚 API Integration Guide

### External Services

#### Wikipedia Integration

- **Endpoint**: `/api/activity/wikipedia`
- **Purpose**: Fetch article summaries for activities
- **Response**: `WikipediaSummary` type with title, extract, image

#### YouTube Search

- **Endpoint**: `/api/activity/youtubeSearch`
- **Purpose**: Find related videos for activities
- **Library**: `youtube-sr` package

#### Icon Search

- **Endpoint**: `/api/activity/iconSearch`
- **Purpose**: Search 50+ icon sets for activity icons
- **API**: Iconify CDN

### Backend Services (Mantle)

All backend requests go through composables:

- **Activities** → `/v2/activities/*`
- **Users** → `/v2/users/*`
- **Prompts** → `/v2/prompts/*`
- **Articles** → `/v2/articles/*`

**Authentication Flow**:

1. User logs in, receives JWT token
2. Token stored in `useState('session-token')`
3. All requests inject token via `useCurrentSessionToken()`
4. Backend validates token and returns user-specific data

## 🎨 UI/UX Patterns

### Responsive Design

- **Mobile-first**: Tailwind breakpoints (`sm:`, `md:`, `lg:`)
- **Viewport Composables**: `nuxt-viewport` for device detection
- **Adaptive Navigation**: `UserDropdown` for mobile, full nav for desktop

### Animation System

- **Tailwind Motion**: Preset animations (`motion-preset-fade-lg`)
- **Custom CSS**: Earth circle rotation animation
- **Conditional Rendering**: `ClientOnly` for hydration-sensitive components

### Loading States

- **Skeletons**: `InfoCardSkeleton`, `JourneyProgressSkeleton`
- **Async Data**: `useAsyncData()` handles loading states automatically
- **Toasts**: `useToast()` for operation feedback

### Forms & Validation

- **Nuxt UI Forms**: Integrated with `@nuxt/ui`
- **Zod Validation**: Real-time validation in forms
- **Error Handling**: Toast notifications for API errors

## 🗂️ State Management

### Composable-Based State

No Vuex/Pinia required. State managed via:

- **`useState()`**: SSR-safe reactive state
- **Composables**: Encapsulate state + logic
- **Lifecycle Hooks**: `onMounted()`, `watch()`, etc.

**Example**: User authentication state

```typescript
export const useAuth = () => {
	const user = useState<User | null>('user', () => undefined);
	const photo = useState<Blob | null>('avatar', () => undefined);

	const fetchUser = async () => {
		/* ... */
	};

	return { user, photo, fetchUser };
};
```

### Persistence

- **Session Tokens**: Stored in `useState()` (memory-based, lost on refresh)
- **Future**: LocalStorage/Cookie integration for persistent auth

## 📊 Performance Optimizations

1. **Image Optimization**: CDN-hosted assets (`cdn.earth-app.com`)
2. **Code Splitting**: Automatic per-route chunks
3. **Tree Shaking**: Unused Iconify icons excluded
4. **Caching Strategy**:
   - API responses: 10min - 4hr TTL
   - Static assets: Indefinite (CDN cache)
5. **Bundle Size**: Bun's faster resolution, Tailwind's JIT compilation

## 🛠️ Troubleshooting

### Common Issues

**Issue**: "Cannot find module '@earth-app/ocean'"
**Solution**: Ensure `@earth-app/ocean` is installed (`bun install`);
Ensure a `GITHUB_TOKEN` is set to install from github packages

**Issue**: "Turnstile verification failed"
**Solution**: Check `NUXT_TURNSTILE_SECRET_KEY` in environment config

**Issue**: "401 Unauthorized on API requests"
**Solution**: Verify session token is valid, try re-logging in

**Issue**: "Type errors in TypeScript"
**Solution**: Run `bunx nuxi prepare` to regenerate `.nuxt/tsconfig.json`

## 📝 Contributing Guidelines

1. **Code Style**: Use Prettier (auto-format on commit)
2. **Commits**: Follow conventional commits (`feat:`, `fix:`, `docs:`)
3. **Type Safety**: All new code must be fully typed
4. **Testing**: Manual testing required (automated tests TBD)
5. **Documentation**: Update README for significant changes

## 📄 License

See [LICENSE](LICENSE) file for details.

## 🤝 Credits

- **Framework**: [Nuxt](https://nuxt.com/) by the Nuxt team
- **UI Components**: [@nuxt/ui](https://ui.nuxt.com/)
- **Icons**: [Iconify](https://iconify.design/)
- **Deployment**: [NuxtHub](https://hub.nuxt.com/) + [Cloudflare](https://cloudflare.com/)
- **Developed by**: [Gregory Mitchell](https://github.com/gmitch215)

---

**For questions or support**, open an issue on [GitHub](https://github.com/earth-app/crust)
or contact the development team.
