import { vi } from 'vitest';

// nuxt 4.5 moved `$fetch` from a plain global to an auto-import out of `#build/fetch.mjs`,
// whose `export const $fetch = globalThis.$fetch` snapshots the instance at module-eval time.
// app code therefore holds the real ofetch instance and a per-test `vi.stubGlobal('$fetch')`
// stops reaching it (it hit real api.earth-app.com on the 4.5 bump). forward every call and
// property to whatever `globalThis.$fetch` is at call time so stubbing works as it did on 4.4.
vi.mock('#build/fetch.mjs', async (importOriginal) => {
	// the original module is what installs the configured instance on globalThis
	await importOriginal();
	const live = () =>
		globalThis.$fetch as unknown as ((...args: unknown[]) => unknown) &
			Record<string | symbol, unknown>;
	return {
		$fetch: new Proxy(function () {} as never, {
			apply: (_target, _thisArg, args: unknown[]) => live()(...args),
			get: (_target, property) => live()?.[property]
		})
	};
});
