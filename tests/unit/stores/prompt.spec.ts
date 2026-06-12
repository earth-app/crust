import { createPinia, setActivePinia } from 'pinia';
import { usePromptStore } from 'stores/prompt';
import type { Prompt, PromptResponse } from 'types/prompts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return {
		...actual,
		makeClientAPIRequest: vi.fn()
	};
});

import { makeClientAPIRequest } from 'utils';

// minimal well-formed prompt: id + owner with an id is all isValidPrompt checks
function makePrompt(id: string, extra: Partial<Prompt> = {}): Prompt {
	return { id, owner: { id: `owner-${id}` }, ...extra } as unknown as Prompt;
}

function stubPrompts(...ids: string[]): Prompt[] {
	return ids.map((id) => ({ id }) as unknown as Prompt);
}

function resp(id: string): PromptResponse {
	return { id } as unknown as PromptResponse;
}

const ids = (items: Prompt[] | null) => (items ?? []).map((p) => p.id);

beforeEach(() => {
	setActivePinia(createPinia());
	vi.clearAllMocks();
});

describe('prompt store validation guard', () => {
	it('accepts a well-formed prompt via setPrompts', () => {
		const store = usePromptStore();
		store.setPrompts([makePrompt('p1')]);
		expect(store.has('p1')).toBe(true);
	});

	it('rejects prompts with a missing/empty id', () => {
		const store = usePromptStore();
		store.setPrompts([{ id: '', owner: { id: 'o' } } as unknown as Prompt]);
		expect(store.cache.size).toBe(0);
	});

	it('rejects prompts whose owner is an array (anon-stripped serializeUser)', () => {
		const store = usePromptStore();
		store.setPrompts([{ id: 'p1', owner: [] } as unknown as Prompt]);
		expect(store.has('p1')).toBe(false);
	});

	it('rejects prompts with no owner', () => {
		const store = usePromptStore();
		store.setPrompts([{ id: 'p1' } as unknown as Prompt]);
		expect(store.has('p1')).toBe(false);
	});

	it('rejects prompts whose owner has no string id', () => {
		const store = usePromptStore();
		store.setPrompts([{ id: 'p1', owner: { id: 99 } } as unknown as Prompt]);
		expect(store.has('p1')).toBe(false);
	});

	it('keeps valid entries and drops invalid ones in a mixed batch', () => {
		const store = usePromptStore();
		store.setPrompts([makePrompt('good'), { id: 'bad', owner: [] } as unknown as Prompt]);
		expect(store.has('good')).toBe(true);
		expect(store.has('bad')).toBe(false);
	});
});

describe('prompt store get/has/three-state', () => {
	it('get returns undefined for an empty id', () => {
		const store = usePromptStore();
		expect(store.get('')).toBeUndefined();
	});

	it('get returns undefined for an unknown id', () => {
		const store = usePromptStore();
		expect(store.get('nope')).toBeUndefined();
	});

	it('get returns null for a confirmed-not-found id', () => {
		const store = usePromptStore();
		store.cache.set('gone', null);
		expect(store.get('gone')).toBeNull();
		expect(store.has('gone')).toBe(true);
	});

	it('isLoadingPrompt is false for null/undefined/empty ids', () => {
		const store = usePromptStore();
		expect(store.isLoadingPrompt(null)).toBe(false);
		expect(store.isLoadingPrompt(undefined)).toBe(false);
		expect(store.isLoadingPrompt('')).toBe(false);
	});
});

describe('prompt store random cache', () => {
	it('keys on count', () => {
		const store = usePromptStore();
		store.setRandomCached(10, stubPrompts('a', 'b'));
		store.setRandomCached(5, stubPrompts('c'));
		expect(ids(store.getRandomCached(10))).toEqual(['a', 'b']);
		expect(ids(store.getRandomCached(5))).toEqual(['c']);
	});

	it('returns null for an uncached count', () => {
		const store = usePromptStore();
		store.setRandomCached(10, stubPrompts('a'));
		expect(store.getRandomCached(3)).toBeNull();
	});

	describe('ttl', () => {
		beforeEach(() => vi.useFakeTimers());
		afterEach(() => vi.useRealTimers());

		it('serves within the 5-minute window and expires past it', () => {
			const store = usePromptStore();
			store.setRandomCached(10, stubPrompts('fresh'));

			vi.advanceTimersByTime(4 * 60 * 1000);
			expect(ids(store.getRandomCached(10))).toEqual(['fresh']);

			vi.advanceTimersByTime(2 * 60 * 1000);
			expect(store.getRandomCached(10)).toBeNull();
		});
	});
});

describe('prompt store responses cache keying', () => {
	it('keys responses by id-page-limit', () => {
		const store = usePromptStore();
		store.responsesCache.set('p1-1-25', [resp('r1')]);
		store.responsesCache.set('p1-2-25', [resp('r2')]);

		expect(store.getResponses('p1', 1, 25)?.map((r) => r.id)).toEqual(['r1']);
		expect(store.getResponses('p1', 2, 25)?.map((r) => r.id)).toEqual(['r2']);
	});

	it('defaults to page 1 limit 25', () => {
		const store = usePromptStore();
		store.responsesCache.set('p1-1-25', [resp('r1')]);
		expect(store.getResponses('p1')?.map((r) => r.id)).toEqual(['r1']);
	});

	it('returns undefined for an uncached page/limit combo', () => {
		const store = usePromptStore();
		store.responsesCache.set('p1-1-25', [resp('r1')]);
		expect(store.getResponses('p1', 1, 10)).toBeUndefined();
	});

	it('isLoadingResponses defaults to false', () => {
		const store = usePromptStore();
		expect(store.isLoadingResponses('p1')).toBe(false);
		store.responsesLoadingState.set('p1', true);
		expect(store.isLoadingResponses('p1')).toBe(true);
	});
});

describe('prompt store LRU eviction', () => {
	// MAX_CACHE_SIZE is 100; eviction runs inside fetchPrompt before caching a valid hit
	it('evicts the oldest entry and its loading-state at the cap', async () => {
		const store = usePromptStore();
		const seed: Prompt[] = [];
		for (let i = 0; i < 100; i++) seed.push(makePrompt(`seed-${i}`));
		store.setPrompts(seed);
		expect(store.cache.size).toBe(100);
		// loading-state is keyed by the bare prompt id, so eviction deletes it cleanly
		store.responsesLoadingState.set('seed-0', true);

		vi.mocked(makeClientAPIRequest).mockResolvedValue({
			success: true,
			data: makePrompt('new')
		} as any);
		await store.fetchPrompt('new');

		expect(store.has('seed-0')).toBe(false);
		expect(store.has('new')).toBe(true);
		expect(store.cache.size).toBe(100);
		expect(store.responsesLoadingState.has('seed-0')).toBe(false);
	});

	// BUG: eviction does responsesCache.delete(firstKey) with the bare prompt id, but the
	// responses cache is keyed by `${id}-${page}-${limit}`, so the evicted prompt's response
	// entries are never removed — a memory leak (clear/deletePrompt correctly use startsWith).
	// asserting CORRECT behavior so this fails until the eviction prefix-matches the key.
	it('evicts the oldest entry response caches at the cap', async () => {
		const store = usePromptStore();
		const seed: Prompt[] = [];
		for (let i = 0; i < 100; i++) seed.push(makePrompt(`seed-${i}`));
		store.setPrompts(seed);
		store.responsesCache.set('seed-0-1-25', [resp('r')]);

		vi.mocked(makeClientAPIRequest).mockResolvedValue({
			success: true,
			data: makePrompt('new')
		} as any);
		await store.fetchPrompt('new');

		expect(store.has('seed-0')).toBe(false);
		expect(store.responsesCache.has('seed-0-1-25')).toBe(false);
	});
});

describe('prompt store fetchPrompt', () => {
	it('caches a valid payload', async () => {
		const store = usePromptStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue({
			success: true,
			data: makePrompt('p1')
		} as any);

		const result = await store.fetchPrompt('p1');
		expect(result?.id).toBe('p1');
		expect(store.get('p1')?.id).toBe('p1');
		expect(store.isLoadingPrompt('p1')).toBe(false);
	});

	it('caches null on a malformed (owner: []) payload', async () => {
		const store = usePromptStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue({
			success: true,
			data: { id: 'p1', owner: [] }
		} as any);

		const result = await store.fetchPrompt('p1');
		expect(result).toBeNull();
		expect(store.has('p1')).toBe(true);
		expect(store.get('p1')).toBeNull();
	});

	it('caches null on a failed response', async () => {
		const store = usePromptStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue({
			success: false,
			message: 'boom'
		} as any);

		const result = await store.fetchPrompt('p1');
		expect(result).toBeNull();
		expect(store.get('p1')).toBeNull();
	});

	it('caches null when the request throws', async () => {
		const store = usePromptStore();
		vi.mocked(makeClientAPIRequest).mockRejectedValue(new Error('network'));

		const result = await store.fetchPrompt('p1');
		expect(result).toBeNull();
		expect(store.get('p1')).toBeNull();
		expect(store.isLoadingPrompt('p1')).toBe(false);
	});

	it('returns null for an empty id without calling the network', async () => {
		const store = usePromptStore();
		const result = await store.fetchPrompt('');
		expect(result).toBeNull();
		expect(makeClientAPIRequest).not.toHaveBeenCalled();
	});

	it('serves a cached hit without re-fetching', async () => {
		const store = usePromptStore();
		store.setPrompts([makePrompt('p1')]);
		const result = await store.fetchPrompt('p1');
		expect(result?.id).toBe('p1');
		expect(makeClientAPIRequest).not.toHaveBeenCalled();
	});

	it('dedupes concurrent fetches into one network call', async () => {
		const store = usePromptStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue({
			success: true,
			data: makePrompt('p1')
		} as any);

		const [a, b] = await Promise.all([store.fetchPrompt('p1'), store.fetchPrompt('p1')]);
		expect(a?.id).toBe('p1');
		expect(b?.id).toBe('p1');
		expect(makeClientAPIRequest).toHaveBeenCalledTimes(1);
	});
});

describe('prompt store fetchResponses', () => {
	it('caches the items list from a valid response under the page/limit key', async () => {
		const store = usePromptStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue({
			success: true,
			data: { items: [resp('r1'), resp('r2')] }
		} as any);

		const result = await store.fetchResponses('p1', 2, 10);
		expect(result.map((r) => r.id)).toEqual(['r1', 'r2']);
		expect(store.getResponses('p1', 2, 10)?.length).toBe(2);
		expect(store.isLoadingResponses('p1')).toBe(false);
	});

	it('caches an empty list on a failed response', async () => {
		const store = usePromptStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue({
			success: false,
			message: 'nope'
		} as any);

		const result = await store.fetchResponses('p1');
		expect(result).toEqual([]);
		expect(store.getResponses('p1')).toEqual([]);
	});

	it('caches an empty list when the request throws', async () => {
		const store = usePromptStore();
		vi.mocked(makeClientAPIRequest).mockRejectedValue(new Error('x'));
		const result = await store.fetchResponses('p1');
		expect(result).toEqual([]);
		expect(store.getResponses('p1')).toEqual([]);
		expect(store.isLoadingResponses('p1')).toBe(false);
	});
});

describe('prompt store response mutations', () => {
	it('createResponse prepends onto every page-1 reader cache for the prompt', async () => {
		const store = usePromptStore();
		store.responsesCache.set('p1-1-25', [resp('old')]);
		store.responsesCache.set('p1-1-10', [resp('old')]);
		// a page-2 cache must NOT receive the new response
		store.responsesCache.set('p1-2-25', [resp('p2')]);

		vi.mocked(makeClientAPIRequest).mockResolvedValue({
			success: true,
			data: resp('new')
		} as any);

		await store.createResponse('p1', {});
		expect(store.getResponses('p1', 1, 25)?.map((r) => r.id)).toEqual(['new', 'old']);
		expect(store.getResponses('p1', 1, 10)?.map((r) => r.id)).toEqual(['new', 'old']);
		expect(store.getResponses('p1', 2, 25)?.map((r) => r.id)).toEqual(['p2']);
	});

	it('createResponse seeds the default-limit cache when no page-1 reader exists', async () => {
		const store = usePromptStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue({
			success: true,
			data: resp('new')
		} as any);

		await store.createResponse('p1', {});
		expect(store.getResponses('p1', 1, 25)?.map((r) => r.id)).toEqual(['new']);
	});

	it('updateResponse replaces the matching response across all caches for the prompt', async () => {
		const store = usePromptStore();
		store.responsesCache.set('p1-1-25', [resp('r1'), resp('r2')]);
		store.responsesCache.set('p1-2-25', [resp('r3')]);

		vi.mocked(makeClientAPIRequest).mockResolvedValue({
			success: true,
			data: { id: 'r2', body: 'edited' }
		} as any);

		await store.updateResponse('p1', { id: 'r2' });
		const page1 = store.getResponses('p1', 1, 25)!;
		expect(page1.map((r) => r.id)).toEqual(['r1', 'r2']);
		expect((page1[1] as any).body).toBe('edited');
		// the page-2 cache (no r2) is untouched
		expect(store.getResponses('p1', 2, 25)?.map((r) => r.id)).toEqual(['r3']);
	});

	it('deleteResponse filters the response out of every cache for the prompt', async () => {
		const store = usePromptStore();
		store.responsesCache.set('p1-1-25', [resp('r1'), resp('r2')]);
		store.responsesCache.set('p1-1-10', [resp('r2')]);

		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true } as any);

		await store.deleteResponse('p1', 'r2');
		expect(store.getResponses('p1', 1, 25)?.map((r) => r.id)).toEqual(['r1']);
		expect(store.getResponses('p1', 1, 10)?.map((r) => r.id)).toEqual([]);
	});
});

describe('prompt store prompt mutations', () => {
	it('createPrompt caches the returned prompt', async () => {
		const store = usePromptStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue({
			success: true,
			data: makePrompt('created')
		} as any);

		await store.createPrompt({ title: 'x' });
		expect(store.get('created')?.id).toBe('created');
	});

	it('updatePrompt caches the updated prompt', async () => {
		const store = usePromptStore();
		vi.mocked(makeClientAPIRequest).mockResolvedValue({
			success: true,
			data: makePrompt('u1', { title: 'new' } as Partial<Prompt>)
		} as any);

		await store.updatePrompt({ id: 'u1' });
		expect((store.get('u1') as any).title).toBe('new');
	});

	it('deletePrompt removes the prompt and its response caches on success', async () => {
		const store = usePromptStore();
		store.setPrompts([makePrompt('d1')]);
		store.responsesCache.set('d1-1-25', [resp('r')]);
		store.responsesLoadingState.set('d1', true);

		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true } as any);

		await store.deletePrompt('d1');
		expect(store.has('d1')).toBe(false);
		expect(store.responsesCache.has('d1-1-25')).toBe(false);
		expect(store.responsesLoadingState.has('d1')).toBe(false);
	});

	it('deletePrompt leaves the cache untouched on failure', async () => {
		const store = usePromptStore();
		store.setPrompts([makePrompt('d1')]);
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: false } as any);

		await store.deletePrompt('d1');
		expect(store.has('d1')).toBe(true);
	});
});

describe('prompt store clear', () => {
	it('clears a single id with its prefixed response caches only', () => {
		const store = usePromptStore();
		store.setPrompts([makePrompt('p1'), makePrompt('p2')]);
		store.responsesCache.set('p1-1-25', [resp('r')]);
		store.responsesCache.set('p2-1-25', [resp('r')]);
		store.responsesLoadingState.set('p1', true);

		store.clear('p1');
		expect(store.has('p1')).toBe(false);
		expect(store.responsesCache.has('p1-1-25')).toBe(false);
		expect(store.responsesLoadingState.has('p1')).toBe(false);
		// p2 and its responses survive
		expect(store.has('p2')).toBe(true);
		expect(store.responsesCache.has('p2-1-25')).toBe(true);
	});

	it('clears everything when called with no id', () => {
		const store = usePromptStore();
		store.setPrompts([makePrompt('p1')]);
		store.responsesCache.set('p1-1-25', [resp('r')]);
		store.responsesLoadingState.set('p1', true);

		store.clear();
		expect(store.cache.size).toBe(0);
		expect(store.responsesCache.size).toBe(0);
		expect(store.responsesLoadingState.size).toBe(0);
	});
});
