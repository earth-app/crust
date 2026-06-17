import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from 'stores/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expandApiKeyScopes, useApiKeys } from '~/composables/useApiKeys';

// useApiKeys relies on the auto-imported makeClientAPIRequest; mocking the
// resolved 'utils' module intercepts it the same as an explicit import.
vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return { ...actual, makeClientAPIRequest: vi.fn() };
});

import { makeClientAPIRequest } from 'utils';

// mirror of the backend scope tree (parents expand to their leaf scopes)
const catalog: any = {
	scopes: {
		user: {
			description: 'user',
			children: {
				'user:read': { description: 'read' },
				'user:write': { description: 'write' }
			}
		},
		content: {
			description: 'content',
			children: {
				article: {
					description: 'article',
					children: {
						'article:read': { description: 'read' },
						'article:write': { description: 'write' }
					}
				}
			}
		}
	}
};

describe('expandApiKeyScopes', () => {
	it('expands a top-level parent to its leaves', () => {
		expect(expandApiKeyScopes(['user'], catalog)).toEqual(['user:read', 'user:write']);
	});

	it('walks nested children to collect deep leaves', () => {
		expect(expandApiKeyScopes(['content'], catalog)).toEqual(['article:read', 'article:write']);
	});

	it('resolves a parent nested inside another parent', () => {
		expect(expandApiKeyScopes(['article'], catalog)).toEqual(['article:read', 'article:write']);
	});

	it('returns a leaf scope unchanged', () => {
		expect(expandApiKeyScopes(['user:read'], catalog)).toEqual(['user:read']);
	});

	it('unions and dedupes overlapping grants, sorted', () => {
		expect(expandApiKeyScopes(['user', 'user:read'], catalog)).toEqual(['user:read', 'user:write']);
		expect(expandApiKeyScopes(['user', 'content'], catalog)).toEqual([
			'article:read',
			'article:write',
			'user:read',
			'user:write'
		]);
	});

	it('drops unknown scopes', () => {
		expect(expandApiKeyScopes(['nope' as any], catalog)).toEqual([]);
	});
});

const ok = <T>(data: T) => ({ success: true as const, data });
const fail = (message = 'boom') => ({ success: false as const, message });
const key = (id: string) => ({ id, name: id, revoked: false }) as any;

describe('useApiKeys', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
		useAuthStore().setSessionToken('token');
		// reset the module-level shared state between tests
		const api = useApiKeys();
		api.keys.value = [];
		api.active.value = 0;
		api.max.value = 0;
		api.loading.value = false;
		api.error.value = null;
		api.catalog.value = null;
	});

	describe('fetchKeys', () => {
		it('loads the list and surfaces active/max', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(
				ok({ items: [key('k1'), key('k2')], active: 2, max: 10 })
			);
			const api = useApiKeys();

			const res = await api.fetchKeys();

			expect(res.success).toBe(true);
			expect(api.keys.value.map((k) => k.id)).toEqual(['k1', 'k2']);
			expect(api.active.value).toBe(2);
			expect(api.max.value).toBe(10);
			expect(api.loading.value).toBe(false);
		});

		it('captures an error envelope on failure', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(fail('nope'));
			const api = useApiKeys();

			const res = await api.fetchKeys();

			expect(res).toEqual({ success: false, error: 'nope' });
			expect(api.error.value).toBe('nope');
		});
	});

	describe('createKey', () => {
		it('returns the created key (with token) and reconciles via fetchKeys', async () => {
			(makeClientAPIRequest as any).mockImplementation((path: string, _t: unknown, opts: any) => {
				if (opts?.method === 'POST') {
					return Promise.resolve(ok({ id: 'k1', name: 'CI', token: 'raw-secret', revoked: false }));
				}
				// trailing fetchKeys() reconcile
				return Promise.resolve(ok({ items: [key('k1')], active: 1, max: 10 }));
			});
			const api = useApiKeys();

			const res = await api.createKey({ name: 'CI', scopes: [] } as any);

			expect(res.success).toBe(true);
			expect(res.data?.token).toBe('raw-secret');
			// reconciled list never carries the raw token
			expect(api.keys.value).toHaveLength(1);
			expect((api.keys.value[0] as any).token).toBeUndefined();
			expect(api.active.value).toBe(1);
		});

		it('returns an error envelope when creation fails', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(fail('limit reached'));
			const api = useApiKeys();

			const res = await api.createKey({ name: 'CI', scopes: [] } as any);
			expect(res).toEqual({ success: false, error: 'limit reached' });
		});
	});

	describe('updateKey', () => {
		it('patches the matching key in place', async () => {
			const api = useApiKeys();
			api.keys.value = [key('k1'), key('k2')];
			(makeClientAPIRequest as any).mockResolvedValue(
				ok({ id: 'k1', name: 'renamed', revoked: false })
			);

			const res = await api.updateKey('k1', { name: 'renamed' } as any);

			expect(res.success).toBe(true);
			expect(api.keys.value[0]!.name).toBe('renamed');
			expect(api.keys.value[1]!.id).toBe('k2'); // untouched
		});
	});

	describe('revokeKey', () => {
		it('soft-marks the key revoked and decrements the active count', async () => {
			const api = useApiKeys();
			api.keys.value = [key('k1')];
			api.active.value = 1;
			(makeClientAPIRequest as any).mockResolvedValue(ok({}));

			const res = await api.revokeKey('k1');

			expect(res.success).toBe(true);
			expect(api.keys.value[0]!.revoked).toBe(true);
			expect(api.keys.value[0]!.revoked_at).toBeTruthy();
			expect(api.active.value).toBe(0);
		});

		it('returns an error envelope when revoke fails', async () => {
			const api = useApiKeys();
			api.keys.value = [key('k1')];
			(makeClientAPIRequest as any).mockResolvedValue(fail('forbidden'));

			const res = await api.revokeKey('k1');
			expect(res).toEqual({ success: false, error: 'forbidden' });
			expect(api.keys.value[0]!.revoked).toBe(false); // unchanged on failure
		});
	});

	describe('fetchCatalog', () => {
		it('caches the catalog and reuses it without a second request', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(ok(catalog));
			const api = useApiKeys();

			const first = await api.fetchCatalog();
			const second = await api.fetchCatalog();

			// only one network call — second is served from the module cache
			expect(makeClientAPIRequest).toHaveBeenCalledTimes(1);
			expect(first).toEqual(second);
		});

		it('refetches when forced', async () => {
			(makeClientAPIRequest as any).mockResolvedValue(ok(catalog));
			const api = useApiKeys();

			await api.fetchCatalog();
			await api.fetchCatalog(true);

			expect(makeClientAPIRequest).toHaveBeenCalledTimes(2);
		});
	});
});
