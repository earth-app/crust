import { createPinia, setActivePinia } from 'pinia';
import { useAvatarStore } from 'stores/avatar';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// mock the network layer; keep the pure helpers (valid, etc) real via the spread
vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return {
		...actual,
		makeAPIRequest: vi.fn(),
		makeClientAPIRequest: vi.fn(),
		makeServerRequest: vi.fn()
	};
});

import { makeAPIRequest } from 'utils';

const FALLBACK = {
	avatar: '/earth-app.png',
	avatar32: '/favicon.png',
	avatar128: '/favicon.png'
};

describe('avatar store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
	});

	describe('isValidAvatarUrl guards (via safeUrl / preloadAvatar)', () => {
		it('safeUrl returns the sized fallback for non-http urls', () => {
			const store = useAvatarStore();
			// blob/relative/empty/array-ish all fail the http(s) guard
			expect(store.safeUrl('', 'avatar128')).toBe(FALLBACK.avatar128);
			expect(store.safeUrl(undefined, 'avatar32')).toBe(FALLBACK.avatar32);
			expect(store.safeUrl(null, 'avatar')).toBe(FALLBACK.avatar);
			expect(store.safeUrl('blob:foo', 'avatar128')).toBe(FALLBACK.avatar128);
			expect(store.safeUrl('/relative/path.png', 'avatar128')).toBe(FALLBACK.avatar128);
			// partial-serialization shapes ([] / object) must not slip through
			expect(store.safeUrl([] as unknown as string)).toBe(FALLBACK.avatar128);
		});

		it('safeUrl appends ?size= for sized variants on a clean url', () => {
			const store = useAvatarStore();
			expect(store.safeUrl('https://cdn.test/a.png', 'avatar32')).toBe(
				'https://cdn.test/a.png?size=32'
			);
			expect(store.safeUrl('https://cdn.test/a.png', 'avatar128')).toBe(
				'https://cdn.test/a.png?size=128'
			);
		});

		it('safeUrl uses & when the url already carries a query', () => {
			const store = useAvatarStore();
			expect(store.safeUrl('https://cdn.test/a.png?v=1', 'avatar128')).toBe(
				'https://cdn.test/a.png?v=1&size=128'
			);
		});

		it("safeUrl returns the base url unchanged for the 'avatar' (full) size", () => {
			const store = useAvatarStore();
			expect(store.safeUrl('https://cdn.test/a.png', 'avatar')).toBe('https://cdn.test/a.png');
		});

		it('preloadAvatar ignores invalid urls and does not populate the queue/cache', () => {
			const store = useAvatarStore();
			store.preloadAvatar('');
			store.preloadAvatar(undefined);
			store.preloadAvatar('blob:x');
			store.preloadAvatar('/local.png');
			expect(store.cache.size).toBe(0);
			expect(store.has('')).toBe(false);
		});

		it('fetchAvatarBlobs short-circuits invalid urls to the fallback (no network)', async () => {
			const store = useAvatarStore();
			const fetchSpy = vi.spyOn(globalThis, 'fetch');
			const result = await store.fetchAvatarBlobs('not-a-url');
			expect(result).toEqual(FALLBACK);
			expect(fetchSpy).not.toHaveBeenCalled();
			expect(store.cache.size).toBe(0);
			fetchSpy.mockRestore();
		});
	});

	describe('three-state cache get/has', () => {
		it('get returns undefined for a never-seen url', () => {
			const store = useAvatarStore();
			expect(store.get('https://cdn.test/x.png')).toBeUndefined();
			expect(store.has('https://cdn.test/x.png')).toBe(false);
		});

		it('isLoading and hasFailed are false for null/undefined/empty', () => {
			const store = useAvatarStore();
			expect(store.isLoading(null)).toBe(false);
			expect(store.isLoading(undefined)).toBe(false);
			expect(store.isLoading('')).toBe(false);
			expect(store.hasFailed(null)).toBe(false);
			expect(store.hasFailed('')).toBe(false);
		});
	});

	describe('safeUrl cache promotion', () => {
		it('serves a cached blob for the requested size', () => {
			const store = useAvatarStore();
			const url = 'https://cdn.test/a.png';
			store.cache.set(url, {
				avatar: 'blob:full',
				avatar32: 'blob:small',
				avatar128: 'blob:med'
			});
			expect(store.safeUrl(url, 'avatar128')).toBe('blob:med');
			expect(store.safeUrl(url, 'avatar32')).toBe('blob:small');
		});

		it('falls through to remote if the cached entry holds a fallback (leading /)', () => {
			const store = useAvatarStore();
			const url = 'https://cdn.test/a.png';
			// a prior partial fetch left a static fallback for avatar128
			store.cache.set(url, {
				avatar: 'blob:full',
				avatar32: 'blob:small',
				avatar128: '/favicon.png'
			});
			// must not serve the fallback as a real blob — appends remote size instead
			expect(store.safeUrl(url, 'avatar128')).toBe('https://cdn.test/a.png?size=128');
		});

		it('returns the sized fallback when the url is marked failed', () => {
			const store = useAvatarStore();
			const url = 'https://cdn.test/a.png';
			store.failedUrls.add(url);
			expect(store.safeUrl(url, 'avatar128')).toBe(FALLBACK.avatar128);
		});
	});

	describe('buildAvatarCacheBust', () => {
		beforeEach(() => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date(1_700_000_000_000));
		});
		afterEach(() => vi.useRealTimers());

		it('appends ?v= for a clean url', () => {
			const store = useAvatarStore();
			expect(store.buildAvatarCacheBust('https://cdn.test/a.png')).toBe(
				'https://cdn.test/a.png?v=1700000000000'
			);
		});

		it('appends &v= when a query already exists', () => {
			const store = useAvatarStore();
			expect(store.buildAvatarCacheBust('https://cdn.test/a.png?x=1')).toBe(
				'https://cdn.test/a.png?x=1&v=1700000000000'
			);
		});

		it('returns the (falsy) input unchanged when empty', () => {
			const store = useAvatarStore();
			expect(store.buildAvatarCacheBust('')).toBe('');
		});
	});

	describe('clear', () => {
		it('removes a single url and its failed mark, revoking blob urls', () => {
			const store = useAvatarStore();
			const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
			const url = 'https://cdn.test/a.png';
			store.cache.set(url, { avatar: 'blob:1', avatar32: 'blob:2', avatar128: '/favicon.png' });
			store.failedUrls.add(url);

			store.clear(url);

			expect(store.cache.has(url)).toBe(false);
			expect(store.failedUrls.has(url)).toBe(false);
			// only the two blob: entries get revoked, not the static fallback
			expect(revoke).toHaveBeenCalledWith('blob:1');
			expect(revoke).toHaveBeenCalledWith('blob:2');
			expect(revoke).not.toHaveBeenCalledWith('/favicon.png');
			revoke.mockRestore();
		});

		it('full clear wipes cache, failedUrls and preview cache', () => {
			const store = useAvatarStore();
			vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
			store.cache.set('https://cdn.test/a.png', {
				avatar: 'blob:1',
				avatar32: 'blob:2',
				avatar128: 'blob:3'
			});
			store.failedUrls.add('https://cdn.test/a.png');
			store.previewCache.set('frame', 'blob:p');

			store.clear();

			expect(store.cache.size).toBe(0);
			expect(store.failedUrls.size).toBe(0);
			expect(store.previewCache.size).toBe(0);
			vi.restoreAllMocks();
		});
	});

	describe('clearPreview', () => {
		it('removes a single key from both preview keyspaces', () => {
			const store = useAvatarStore();
			vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
			store.previewCache.set('frame', 'blob:a');
			store.selfPreviewCache.set('frame', 'blob:b');

			store.clearPreview('frame');

			expect(store.previewCache.has('frame')).toBe(false);
			expect(store.selfPreviewCache.has('frame')).toBe(false);
			vi.restoreAllMocks();
		});

		it('full clearPreview empties both preview keyspaces', () => {
			const store = useAvatarStore();
			vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
			store.previewCache.set('a', 'blob:1');
			store.selfPreviewCache.set('b', 'blob:2');

			store.clearPreview();

			expect(store.previewCache.size).toBe(0);
			expect(store.selfPreviewCache.size).toBe(0);
			vi.restoreAllMocks();
		});
	});

	describe('cosmetics fetch -> state', () => {
		it('fetchAllCosmetics replaces allCosmetics on success', async () => {
			const store = useAvatarStore();
			const cosmetics = [{ key: 'frame' }, { key: 'glow' }];
			vi.mocked(makeAPIRequest).mockResolvedValue({ success: true, data: { cosmetics } } as any);

			await store.fetchAllCosmetics();

			expect(store.allCosmetics.map((c: any) => c.key)).toEqual(['frame', 'glow']);
		});

		it('fetchAllCosmetics leaves allCosmetics untouched on failure', async () => {
			const store = useAvatarStore();
			vi.mocked(makeAPIRequest).mockResolvedValue({ success: false, message: 'boom' } as any);

			await store.fetchAllCosmetics();

			expect(store.allCosmetics).toEqual([]);
		});

		it('fetchCosmeticsForUser populates the per-user entry on success', async () => {
			const store = useAvatarStore();
			vi.mocked(makeAPIRequest).mockResolvedValue({
				success: true,
				data: { current: 'frame', unlocked: ['frame', 'glow'] }
			} as any);

			await store.fetchCosmeticsForUser('u1');

			expect(store.userCosmetics.get('u1')).toEqual({
				current: 'frame',
				unlocked: ['frame', 'glow']
			});
		});

		it('fetchCosmeticsForUser writes a stable empty entry on failure (stops loading state)', async () => {
			const store = useAvatarStore();
			vi.mocked(makeAPIRequest).mockResolvedValue({ success: false, message: 'no' } as any);

			await store.fetchCosmeticsForUser('u2');

			expect(store.userCosmetics.get('u2')).toEqual({ current: null, unlocked: [] });
		});

		it('fetchCosmeticsForUser does not clobber an existing entry on failure', async () => {
			const store = useAvatarStore();
			store.userCosmetics.set('u3', { current: 'glow', unlocked: ['glow'] });
			vi.mocked(makeAPIRequest).mockResolvedValue({ success: false, message: 'no' } as any);

			await store.fetchCosmeticsForUser('u3');

			expect(store.userCosmetics.get('u3')).toEqual({ current: 'glow', unlocked: ['glow'] });
		});
	});
});
