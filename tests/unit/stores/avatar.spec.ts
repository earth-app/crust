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
	let fetchSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
		// safeUrl()/preloadAvatar() kick off a fire-and-forget fetchAvatarBlobs() for any
		// uncached http(s) url. without a stub that resolves quietly, the background fetch
		// hits the real network, fails, and console.warn()s *after* these (sync) tests have
		// returned — racing worker teardown (EnvironmentTeardownError: Closing rpc while
		// "onUserConsoleLog" was pending). a non-ok response settles it without logging
		fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as Response);
	});

	afterEach(() => {
		fetchSpy.mockRestore();
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

	// a transient blip used to land in failedUrls permanently, so one bad request on a cold
	// launch blanked the avatar to the static placeholder for the rest of the session
	describe('transient vs permanent failure', () => {
		const URL_A = 'https://cdn.test/u1/profile_photo';
		let origCreateObjectURL: typeof URL.createObjectURL;
		let blobCounter = 0;

		const png = () =>
			({ ok: true, status: 200, blob: async () => ({ size: 68 }) }) as unknown as Response;
		const status = (code: number) => ({ ok: false, status: code }) as Response;

		beforeEach(() => {
			vi.useFakeTimers();
			blobCounter = 0;
			origCreateObjectURL = URL.createObjectURL;
			URL.createObjectURL = vi.fn(() => `blob:avatar-${++blobCounter}`) as any;
		});

		afterEach(() => {
			vi.useRealTimers();
			URL.createObjectURL = origCreateObjectURL;
		});

		// the retry sleeps RETRY_DELAY_MS between attempts; drain both the timers and the
		// microtasks the three parallel size fetches are sitting on
		const settle = async (promise: Promise<unknown>) => {
			await vi.advanceTimersByTimeAsync(2_000);
			return promise;
		};

		it('retries a failed size once before giving up', async () => {
			const store = useAvatarStore();
			fetchSpy.mockResolvedValue(status(500));

			await settle(store.fetchAvatarBlobs(URL_A));

			// 3 sizes x 2 attempts
			expect(fetchSpy).toHaveBeenCalledTimes(6);
		});

		it('a first-attempt blip that succeeds on retry fills every size', async () => {
			const store = useAvatarStore();
			const seen = new Set<string>();
			fetchSpy.mockImplementation(async (input: any) => {
				const key = String(input);
				if (!seen.has(key)) {
					seen.add(key);
					throw new Error('network down');
				}
				return png();
			});

			const sizes = (await settle(store.fetchAvatarBlobs(URL_A))) as any;

			expect(sizes.avatar).toMatch(/^blob:/);
			expect(sizes.avatar32).toMatch(/^blob:/);
			expect(sizes.avatar128).toMatch(/^blob:/);
			expect(store.hasFailed(URL_A)).toBe(false);
		});

		it('a 5xx on every size stays retryable and never becomes a permanent failure', async () => {
			const store = useAvatarStore();
			fetchSpy.mockResolvedValue(status(503));

			await settle(store.fetchAvatarBlobs(URL_A));

			expect(store.hasFailed(URL_A)).toBe(false);
			expect(store.failedUrls.has(URL_A)).toBe(false);
			expect(store.transientFailures.has(URL_A)).toBe(true);
		});

		it('a network throw on every size stays retryable', async () => {
			const store = useAvatarStore();
			fetchSpy.mockRejectedValue(new Error('offline'));

			await settle(store.fetchAvatarBlobs(URL_A));

			expect(store.hasFailed(URL_A)).toBe(false);
			expect(store.transientFailures.has(URL_A)).toBe(true);
		});

		it('a 200 with an empty body is transient, not a missing photo', async () => {
			const store = useAvatarStore();
			fetchSpy.mockResolvedValue({
				ok: true,
				status: 200,
				blob: async () => ({ size: 0 })
			} as unknown as Response);

			await settle(store.fetchAvatarBlobs(URL_A));

			expect(store.hasFailed(URL_A)).toBe(false);
			expect(store.transientFailures.has(URL_A)).toBe(true);
		});

		it.each([408, 429])('treats %i as transient rather than "no photo"', async (code) => {
			const store = useAvatarStore();
			fetchSpy.mockResolvedValue(status(code));

			await settle(store.fetchAvatarBlobs(URL_A));

			expect(store.hasFailed(URL_A)).toBe(false);
			expect(store.transientFailures.has(URL_A)).toBe(true);
		});

		// the onboarding checklist and the profile editor's regenerate ring both read
		// failedUrls as "this user has no custom photo", so a 404 must still land there
		it('a 404 on every size is permanent and serves the static fallback', async () => {
			const store = useAvatarStore();
			fetchSpy.mockResolvedValue(status(404));

			await settle(store.fetchAvatarBlobs(URL_A));

			expect(store.hasFailed(URL_A)).toBe(true);
			expect(store.safeUrl(URL_A, 'avatar128')).toBe(FALLBACK.avatar128);
			// 404 needs no retry
			expect(fetchSpy).toHaveBeenCalledTimes(3);
		});

		it('a mixed 404 + 5xx is NOT permanent (one size erroring cannot mean "no photo")', async () => {
			const store = useAvatarStore();
			fetchSpy.mockImplementation(async (input: any) =>
				String(input).includes('size=32') ? status(500) : status(404)
			);

			await settle(store.fetchAvatarBlobs(URL_A));

			expect(store.hasFailed(URL_A)).toBe(false);
			expect(store.transientFailures.has(URL_A)).toBe(true);
		});

		it('safeUrl falls through to the remote url after a transient failure, never the placeholder', async () => {
			const store = useAvatarStore();
			fetchSpy.mockResolvedValue(status(500));

			await settle(store.fetchAvatarBlobs(URL_A));

			expect(store.safeUrl(URL_A, 'avatar128')).toBe(`${URL_A}?size=128`);
			expect(store.safeUrl(URL_A, 'avatar')).toBe(URL_A);
		});

		it('does not re-request inside the retry window, and does after it', async () => {
			const store = useAvatarStore();
			fetchSpy.mockResolvedValue(status(500));

			await settle(store.fetchAvatarBlobs(URL_A));
			const afterFirst = fetchSpy.mock.calls.length;

			store.safeUrl(URL_A, 'avatar128');
			store.preloadAvatar(URL_A);
			await vi.advanceTimersByTimeAsync(0);
			expect(fetchSpy.mock.calls.length).toBe(afterFirst);

			vi.advanceTimersByTime(15_000);
			store.safeUrl(URL_A, 'avatar128');
			await vi.advanceTimersByTimeAsync(2_000);
			expect(fetchSpy.mock.calls.length).toBeGreaterThan(afterFirst);
		});

		it('a partial fill is cached, stays repairable, and only refetches the missing size', async () => {
			const store = useAvatarStore();
			fetchSpy.mockImplementation(async (input: any) =>
				String(input).includes('size=128') ? status(500) : png()
			);

			await settle(store.fetchAvatarBlobs(URL_A));

			// the sizes that did load are served from cache straight away
			expect(store.safeUrl(URL_A, 'avatar32')).toMatch(/^blob:/);
			// the missing one falls through to the remote instead of the placeholder
			expect(store.safeUrl(URL_A, 'avatar128')).toBe(`${URL_A}?size=128`);
			expect(store.transientFailures.has(URL_A)).toBe(true);

			fetchSpy.mockClear();
			fetchSpy.mockResolvedValue(png());
			vi.advanceTimersByTime(15_000);
			await settle(store.fetchAvatarBlobs(URL_A));

			expect(store.safeUrl(URL_A, 'avatar128')).toMatch(/^blob:/);
			// only the missing size is re-requested; the two good blobs are left alone
			expect(fetchSpy).toHaveBeenCalledTimes(1);
			expect(String(fetchSpy.mock.calls[0][0])).toContain('size=128');
		});

		it('a complete fetch clears the transient record and stops further requests', async () => {
			const store = useAvatarStore();
			fetchSpy.mockResolvedValue(png());

			await settle(store.fetchAvatarBlobs(URL_A));

			expect(store.transientFailures.has(URL_A)).toBe(false);
			expect(store.hasAllSizes(URL_A)).toBe(true);

			fetchSpy.mockClear();
			store.safeUrl(URL_A, 'avatar128');
			store.preloadAvatar(URL_A);
			await vi.advanceTimersByTimeAsync(0);
			expect(fetchSpy).not.toHaveBeenCalled();
		});

		// six mount handlers call fetchAvatarBlobs directly, bypassing safeUrl/preloadAvatar.
		// while the entry path cleared the failure flags, each of those mounts republished
		// "we don't know yet" and safeUrl swung placeholder -> untested remote url -> placeholder
		it('a settled "no photo" verdict never wobbles while a mount handler re-probes', async () => {
			const store = useAvatarStore();
			fetchSpy.mockResolvedValue(status(404));

			await settle(store.fetchAvatarBlobs(URL_A));
			expect(store.safeUrl(URL_A, 'avatar')).toBe(FALLBACK.avatar);

			// record what every consumer would render across a burst of direct re-probes
			const rendered: string[] = [];
			for (let mount = 0; mount < 5; mount++) {
				const probe = store.fetchAvatarBlobs(URL_A);
				rendered.push(store.safeUrl(URL_A, 'avatar'));
				await settle(probe);
				rendered.push(store.safeUrl(URL_A, 'avatar'));
			}

			expect(new Set(rendered)).toEqual(new Set([FALLBACK.avatar]));
		});

		it('a direct fetchAvatarBlobs respects the retry window its callers do not check', async () => {
			const store = useAvatarStore();
			fetchSpy.mockResolvedValue(status(500));

			await settle(store.fetchAvatarBlobs(URL_A));
			const afterFirst = fetchSpy.mock.calls.length;

			for (let mount = 0; mount < 5; mount++) await settle(store.fetchAvatarBlobs(URL_A));

			expect(fetchSpy.mock.calls.length).toBe(afterFirst);
		});

		it('force re-probes inside the window, for an explicit refresh', async () => {
			const store = useAvatarStore();
			fetchSpy.mockResolvedValue(status(500));

			await settle(store.fetchAvatarBlobs(URL_A));
			const afterFirst = fetchSpy.mock.calls.length;

			fetchSpy.mockResolvedValue(png());
			await settle(store.fetchAvatarBlobs(URL_A, true));

			expect(fetchSpy.mock.calls.length).toBeGreaterThan(afterFirst);
			expect(store.safeUrl(URL_A, 'avatar128')).toMatch(/^blob:/);
		});

		it('a successful re-probe clears an earlier permanent verdict', async () => {
			const store = useAvatarStore();
			fetchSpy.mockResolvedValue(status(404));

			await settle(store.fetchAvatarBlobs(URL_A));
			expect(store.hasFailed(URL_A)).toBe(true);

			// the user generates a photo, so the same url starts answering
			fetchSpy.mockResolvedValue(png());
			await settle(store.fetchAvatarBlobs(URL_A, true));

			expect(store.hasFailed(URL_A)).toBe(false);
			expect(store.safeUrl(URL_A, 'avatar')).toMatch(/^blob:/);
		});

		it('clear(url) drops the transient record so the next render retries immediately', async () => {
			const store = useAvatarStore();
			fetchSpy.mockResolvedValue(status(500));

			await settle(store.fetchAvatarBlobs(URL_A));
			expect(store.canRetry(URL_A)).toBe(false);

			store.clear(URL_A);

			expect(store.transientFailures.has(URL_A)).toBe(false);
			expect(store.canRetry(URL_A)).toBe(true);
		});
	});
});
