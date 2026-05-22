/**
 * Client for the mock backend control plane.
 *
 * Lets tests reach into the in-process mock server to:
 *   - register one-shot overrides for a (method, path, response) tuple
 *   - set the "current user" identity for a test
 *   - reset all overrides scoped to a test id
 *
 * Each test gets a fresh `MockClient` bound to a unique testId so parallel
 * workers do not bleed state. The X-Test-Id header is also stamped onto every
 * navigated request by the browser fixture, which the mock server reads to
 * match overrides.
 */

import { CLOUD_PORT, MANTLE_PORT } from './mock-server';

export type Backend = 'mantle' | 'cloud';

export interface OverrideSpec {
	backend?: Backend;
	method: string;
	path: string | RegExp;
	status?: number;
	body: any;
	headers?: Record<string, string>;
	once?: boolean;
}

function baseUrl(backend: Backend): string {
	return backend === 'cloud' ? `http://127.0.0.1:${CLOUD_PORT}` : `http://127.0.0.1:${MANTLE_PORT}`;
}

export class MockClient {
	constructor(public readonly testId: string) {}

	async set(spec: OverrideSpec): Promise<void> {
		const backend = spec.backend ?? 'mantle';
		const url = `${baseUrl(backend)}/__mock__/override`;
		const path =
			spec.path instanceof RegExp
				? spec.path.source
				: `^${spec.path.replace(/\\/g, '\\\\').replace(/[.*+?^${}()|[\]]/g, (m) => (m === '.' ? '\\.' : m))}$`;
		await fetch(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				method: spec.method.toUpperCase(),
				path,
				status: spec.status ?? 200,
				body: spec.body,
				headers: spec.headers,
				once: spec.once ?? true,
				testId: this.testId
			})
		});
	}

	/**
	 * Register multiple overrides at once. Order matters — first registered = first matched.
	 */
	async setMany(specs: OverrideSpec[]): Promise<void> {
		for (const spec of specs) await this.set(spec);
	}

	/**
	 * Make every request from this test see `user` as the current user.
	 * Pass `null` to anonymize. Optionally also bind a token so SSR-side
	 * lookups (which can't read the X-Test-Id header) resolve correctly.
	 */
	async loginAs(userId: string | null, token?: string | null): Promise<void> {
		for (const backend of ['mantle', 'cloud'] as const) {
			await fetch(`${baseUrl(backend)}/__mock__/login-as`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ userId, testId: this.testId, token })
			});
		}
	}

	/**
	 * Register a user definition with the mock so subsequent `/v2/users/current`
	 * calls return it. Use together with `loginAs` to swap identities mid-test.
	 */
	async registerUser(user: Record<string, any>): Promise<void> {
		await fetch(`${baseUrl('mantle')}/__mock__/user`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ user })
		});
	}

	async reset(opts: { signal?: AbortSignal } = {}): Promise<void> {
		for (const backend of ['mantle', 'cloud'] as const) {
			await fetch(`${baseUrl(backend)}/__mock__/reset`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ testId: this.testId }),
				signal: opts.signal
			});
		}
	}

	async healthCheck(): Promise<boolean> {
		try {
			const [m, c] = await Promise.all([
				fetch(`${baseUrl('mantle')}/__mock__/health`).then((r) => r.ok),
				fetch(`${baseUrl('cloud')}/__mock__/health`).then((r) => r.ok)
			]);
			return m && c;
		} catch {
			return false;
		}
	}
}
