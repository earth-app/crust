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

- The frontend proxies backend API requests (e.g. `/v2/*`) through server routes in `src/server/api/`.
- Primary backend services to be aware of (other repos):
  - `earth-app/mantle2` — core API & business logic services (user, activities, prompts, articles)
  - `earth-app/cloud` — Cloud/edge services and any Cloudflare Worker–side integrations

When changing API paths or response shapes, update shared types in `@earth-app/ocean` (if applicable) and validate with Zod schemas in `src/shared/utils/schemas.ts`.

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

- Do NOT commit secrets or env files—runtime secrets belong in CI/CD or Cloudflare environment variables.
- `nuxt.config.library.ts` is copied over during `prepack` — be cautious editing `nuxt.config.ts` directly if preparing a package release.
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
