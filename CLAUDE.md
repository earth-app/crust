# Project Context: Crust (The Earth App Frontend)

This file provides concise, project-specific context for Claude Code sessions working
on the Crust frontend. Keep this file minimal, update it when workflows or
tooling change, and never add secrets or credentials.

## About This Project

Crust is the user-facing Nuxt 4 frontend for The Earth App. It is designed for
fast iteration with Bun in development and Cloudflare Workers via NuxtHub for
production. The repo is packaged as a library for reuse and published to GitHub
Packages.

Key goals when making changes:

- Preserve TypeScript type-safety and Zod validation contracts
- Maintain server-side request proxying and token validation
- Keep public runtime config free of secrets (use runtime env variables)

## Code organization

Consolidate by domain into a single file rather than splitting across many small
files: all user types in `src/shared/types/user.ts`, all user composables in
`src/composables/useUser.ts`, each store in one file under `src/stores/`. Add a
new feature's types/composable to the existing domain file (with a section
comment) instead of creating a parallel file. Server proxy routes are grouped by
resource too (e.g. `src/server/api/user/leaderboard.get.ts` serves points +
journey leaderboards via a `type` query, not one route per metric).

## Quick Map (Key files & folders)

- `src/` - Application source (components, composables, pages, plugins, server)
- `src/components/` - Reusable UI components and feature folders (activity, user, article, event, prompt)
- `src/composables/` - Domain logic facades used by pages and stores
- `src/stores/` - Pinia stores (auth, user, content caches)
- `src/shared/` - Local types and runtime schemas (Zod) and utilities
- `src/server/` - Nitro server routes used as an API proxy and helper utilities
- `public/` - Static assets (robots, icons, fallback images)
- `nuxt.config.ts` - Primary Nuxt configuration and module list ([nuxt.config.ts](nuxt.config.ts))
- `nuxt.config.library.ts` - Library-specific config used during packaging ([nuxt.config.library.ts](nuxt.config.library.ts))
- `package.json` - Scripts, publish config and prepack hooks ([package.json](package.json))
- `.github/workflows/` - CI workflows (build, release, prettier checks) ([.github/workflows](.github/workflows))

## Notable Modules & Runtime Configuration

- Nuxt modules in active use: `@nuxthub/core`, `@nuxt/ui`, `@nuxtjs/i18n`, `@nuxtjs/turnstile`, `@nuxtjs/robots`, `@nuxtjs/sitemap`, `@nuxt/image`, `nuxt-schema-org`, `nuxt-api-shield`, `@pinia/nuxt`, `nuxt-viewport`, `@nuxt/icon`. See [nuxt.config.ts](nuxt.config.ts).
- Vite uses `@tailwindcss/vite` to integrate Tailwind JIT.
- Nitro preset: `cloudflare_module` with `nodeCompat` enabled (deploys as Cloudflare Worker module).
- Route-level caching rules are declared in `routeRules` (ISR/SWR/ssr toggles).

## Backend Integration

- Primary backend services to be aware of (other repos):
  - `earth-app/mantle2` - core API & business logic services (user, activities, prompts, articles)
  - `earth-app/cloud` - Cloud/edge services and any Cloudflare Worker–side integrations

When changing API paths or response shapes, update shared types in `@earth-app/ocean` (if applicable) and validate with Zod schemas in `src/shared/utils/schemas.ts`.

### Request routing rule (mantle2-direct vs Nitro-proxy)

This is the vital architectural boundary; get it right every time.

- **mantle2 (`/v2/*`) is called DIRECT from Pinia stores/composables** via `makeAPIRequest`
  (cacheable GET) / `makeClientAPIRequest` (uncached POST/PATCH/DELETE) with
  `useAuthStore().sessionToken`. `apiBaseUrl` is absolute, so the same store/composable works on
  web AND native (sky). Do NOT route a mantle2 call through a Nitro `src/server/api/*` proxy.
- **`src/server/api/*` (Nitro) + `makeServerRequest` exist ONLY to reach CLOUD with a server-side
  secret** the browser must never see: `ADMIN_API_KEY` (cloud), or another API key (Google Maps,
  Pixabay, Unsplash, YouTube, Internet Archive, etc.). Called from the client via
  `makeServerRequest`.
- **A Nitro route that merely forwards to mantle2 `/v2/*` is WRONG** — delete it and move the call
  into the store/composable as a direct `makeAPIRequest`/`makeClientAPIRequest`. Prefer the
  mantle2-direct path even when cloud exposes the same data (e.g. garden is `/v2/users/{id}/garden`,
  which mantle2 proxies to cloud with proper user auth); keep a cloud-direct Nitro route only when
  mantle2 genuinely does not expose the endpoint.
- **serverRequest-injection (for the cloud/secret composables only).** A composable whose calls are
  all mantle2-direct takes no `serverRequest` param and sky reuses it verbatim. A composable that
  hits a crust cloud/secret Nitro route takes `serverRequest = makeServerRequest` as a default
  param; sky passes its own `makeMServerRequest` (which calls the crust host's Nitro routes from
  native). See `useActivity` (no param) vs `useActivityInfo` (param) for the exact shape.

## CI, Packaging & Publishing

- CI workflows live in `.github/workflows/`:
  - `build.yml`: sets up Bun, installs deps, bumps version with short git hash, and publishes to GitHub Packages.
  - `release.yml`: manual release flow that publishes packages and creates GitHub releases.
  - `prettier.yml`: formatting checks on push & PRs.
- Library export: the package defines a `prepack` script that copies `nuxt.config.library.ts` to `nuxt.config.ts` before packaging. The package publishes to GitHub Packages (see `publishConfig` in `package.json`).

## How to Run (local developer commands)

- Install: `bun install`
- Dev server: `bun run dev` (local .config/local.env)
- Dev remote (prod-like env): `bun run dev:remote`
- Build: `bun run build` or `NODE_OPTIONS='--max-old-space-size=4096' nuxt build`
- Format: `bun run prettier`

## Standard Workflows (for Claude)

When asked to change code:

1. Explore: Read related files (`src/` folders, `nuxt.config.ts`, `package.json`, `.github` workflows).
2. Plan: Produce a short plan with steps and tests before editing (include potential impact on Nitro server, SSR, or publishing).
3. Code: Make minimal, well-typed changes; update Zod schemas and shared types if response shapes change.
4. Test: Run `bun run dev` and `bunx vue-tsc --noEmit` locally where possible; run Prettier checks.
5. Publish: If publishing is required, follow `build.yml` patterns (update version, publish to GitHub Packages).

## Common Commands & Checks

- Typecheck: `bunx vue-tsc --noEmit`
- Prettier check: `bun run prettier:check`
- Run CI-style build locally: `bun install && bun run postinstall && bun run build`

## Notes & Cautions

- Do NOT commit secrets or env files-runtime secrets belong in CI/CD or Cloudflare environment variables.
- `nuxt.config.library.ts` is copied over during `prepack` - be cautious editing `nuxt.config.ts` directly if preparing a package release.
- Avoid changing `routeRules` without considering caching and Cloudflare edge invalidation.

## Where to Find Things (quick pointers)

- UI components: [src/components](src/components)
- Composables: [src/composables](src/composables)
- Stores: [src/stores](src/stores)
- Server API routes: [src/server/api](src/server/api)
- Static assets: [public](public)

## Example: When adding a new server API route

1. Add route under `src/server/api/` (Nitro). Validate shape with Zod in `src/shared/utils/schemas.ts`.
2. Update any composable in `src/composables` that will call the route.
3. Add unit/formatting checks and test locally.
4. If route affects caching or ISR, update `routeRules` in `nuxt.config.ts` and document the change in README.

## Route caching strategy

Listing pages (`/`, `/activities`, `/articles`, `/events`, `/prompts`) use
short ISR (60-300s). Detail pages (`/activities/**`, `/articles/**`,
`/prompts/**`, `/events/**`) use **plain SSR with no cache**. Static pages
(`/about`, `/terms-of-service`, `/privacy-policy`) are prerendered. Auth /
user-specific pages (`/login`, `/profile/**`, `/admin`, etc.) are
`ssr: false`.

**Why no SWR on detail pages.** NuxtHub's cache lives in the `CACHE` KV
binding ([wrangler.jsonc](wrangler.jsonc)) and survives deploys — but a
new deploy replaces the worker bundle, so the `/_nuxt/<hash>.js` chunks
referenced by old cached HTML are gone. With multi-times-per-day deploys,
SWR cached HTML on detail pages frequently outlived its chunks, producing
`/_nuxt/*` 404s and `Cannot read properties of null (reading 'ce')`-style
hydration errors. Per-detail-page traffic is too thin for SWR to give a
meaningful hit rate anyway, so removing it eliminates the failure mode at
near-zero cost.

**Listing pages keep short ISR.** Multi-fetch fan-out on these pages makes
caching worthwhile, but TTLs are kept tight (60-300s) so the stale-chunk
window is small. Pair this with `experimental.checkOutdatedBuildInterval`
(60s) — the client polls the build manifest and triggers a hard reload on
mismatch, recovering from any stale HTML that does slip through.

**If a stale-chunk error surfaces again**, the long-term fix is a
post-deploy cache flush. Add a step to the deploy workflow that calls a
private Nitro route which runs `await useStorage('cache').clear()`, or
clear the KV namespace via wrangler. Without that, the only defense is
the short TTL + manifest-reload safety net.

## SSR safety on cacheable routes

ISR routes still cache HTML and the embedded Pinia payload and serve it
to every visitor. Any user-specific state baked in during SSR will leak
across users.

Rules:

- **No user-specific data fetching during SSR on cacheable routes.** Don't
  call `useFetch`/`useAsyncData` against auth-gated endpoints at page setup
  time. Defer to `onMounted` or composable methods invoked client-side (the
  existing pattern across the codebase).
- **No cookies/request headers read during SSR inside Pinia stores.** The
  auth store is the only one allowed to touch `session_token`, and even
  there the read happens client-side only. If a new store needs
  cookies/headers, gate the read on `import.meta.client`.
- **Mark client-only reactive state with `skipHydrate`.** Any ref derived
  from `useCookie`, `useLocalStorage`, `useSessionStorage`, or other
  browser-only sources must be wrapped with `skipHydrate(...)` at return
  time, or its client value will be silently overwritten by the cached SSR
  payload during Pinia hydration. See [src/stores/auth.ts](src/stores/auth.ts)
  for the pattern.
- **Auth-gated UI on SWR pages must hydrate client-side.** Today
  `currentUser` is never fetched on SSR, so this is moot. If that ever
  changes, wrap auth-specific markup in `<ClientOnly>` on cacheable routes
  to keep cached HTML auth-agnostic.
- **Don't use `v-html` on user-supplied content.** Plain text +
  `whitespace-pre-line` CSS handles line breaks without an XSS surface. The
  session cookie is `httpOnly: false` (required for `useCookie`), so any
  XSS sink becomes a session-theft sink.
