import { defineStore } from 'pinia';
import type { Prompt, PromptResponse } from 'types/prompts';
import type { User } from 'types/user';
import { makeClientAPIRequest } from 'utils';
import { reactive } from 'vue';
import { useAuthStore } from './auth';

const RANDOM_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const isValidPrompt = (p: unknown): p is Prompt => {
	if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
	const pr = p as Partial<Prompt>;

	if (typeof pr.id !== 'string' || !pr.id) return false;
	if (!pr.owner || typeof pr.owner !== 'object' || Array.isArray(pr.owner)) return false;
	if (typeof (pr.owner as Partial<User>).id !== 'string') return false;

	return true;
};

export const usePromptStore = defineStore('prompt', () => {
	const MAX_CACHE_SIZE = 100; // Limit cache to prevent memory leaks
	// null marks "fetched and confirmed not found / failed".
	const cache = reactive(new Map<string, Prompt | null>());
	const loading = reactive(new Set<string>());
	const fetchQueue = new Map<string, Promise<void>>();

	const responsesCache = reactive(new Map<string, PromptResponse[]>());
	const responsesLoadingState = reactive(new Map<string, boolean>());
	const randomCache = reactive(new Map<string, { items: Prompt[]; timestamp: number }>());

	// LRU cache eviction
	const evictOldestIfNeeded = () => {
		if (cache.size >= MAX_CACHE_SIZE) {
			const firstKey = cache.keys().next().value;
			if (firstKey) {
				cache.delete(firstKey);
				// responsesCache is keyed by `${id}-${page}-${limit}`, so purge every page for this id
				for (const key of responsesCache.keys()) {
					if (key.startsWith(`${firstKey}-`)) {
						responsesCache.delete(key);
					}
				}
				responsesLoadingState.delete(firstKey);
			}
		}
	};

	const get = (id: string): Prompt | null | undefined => {
		if (!id) return undefined;
		if (loading.has(id) && !cache.get(id)) return undefined;
		return cache.get(id);
	};

	const has = (id: string): boolean => {
		return cache.has(id);
	};

	const isLoadingPrompt = (id: string | null | undefined): boolean => {
		if (!id) return false;
		return loading.has(id);
	};

	const getRandomCached = (count: number): Prompt[] | null => {
		const entry = randomCache.get(`random-${count}`);
		if (entry && Date.now() - entry.timestamp < RANDOM_CACHE_TTL) {
			return entry.items;
		}
		return null;
	};

	const setRandomCached = (count: number, items: Prompt[]) => {
		randomCache.set(`random-${count}`, { items, timestamp: Date.now() });
	};

	const getResponses = (
		id: string,
		page: number = 1,
		limit: number = 25
	): PromptResponse[] | undefined => {
		return responsesCache.get(`${id}-${page}-${limit}`);
	};

	const isLoadingResponses = (id: string): boolean => {
		return responsesLoadingState.get(id) || false;
	};

	const fetchPrompt = async (id: string, force: boolean = false): Promise<Prompt | null> => {
		if (!id) return null;

		if (cache.has(id) && !force && !fetchQueue.has(id)) {
			return cache.get(id)!;
		}

		const existingFetch = fetchQueue.get(id);
		if (existingFetch && !force) {
			await existingFetch;
			return cache.get(id) || null;
		}

		loading.add(id);

		// create new fetch promise
		const fetchPromise = (async () => {
			try {
				const res = await makeClientAPIRequest<Prompt>(`/v2/prompts/${id}`);

				if (valid(res) && isValidPrompt(res.data)) {
					evictOldestIfNeeded();
					cache.set(id, res.data);
				} else {
					cache.set(id, null);
					if (valid(res)) {
						console.warn(`Malformed prompt payload for ${id} — treating as not found`);
					} else if (res.message) {
						console.warn(`Failed to fetch prompt ${id}:`, res.message);
					}
				}
			} catch (error) {
				cache.set(id, null);
				console.warn(`Failed to fetch prompt ${id}:`, error);
			} finally {
				loading.delete(id);
				fetchQueue.delete(id);
			}
		})();

		fetchQueue.set(id, fetchPromise);
		await fetchPromise;

		return cache.get(id) || null;
	};

	const setPrompts = (prompts: Prompt[]) => {
		for (const prompt of prompts) {
			if (!isValidPrompt(prompt)) continue;
			if (cache.get(prompt.id)) continue;
			cache.set(prompt.id, prompt);
		}
	};

	const fetchResponses = async (
		id: string,
		page: number = 1,
		limit: number = 25
	): Promise<PromptResponse[]> => {
		const cacheKey = `${id}-${page}-${limit}`;

		if (responsesLoadingState.get(id)) {
			return responsesCache.get(cacheKey) || [];
		}

		responsesLoadingState.set(id, true);

		try {
			const res = await makeClientAPIRequest<{ items: PromptResponse[] }>(
				`/v2/prompts/${id}/responses?page=${page}&limit=${limit}`
			);

			if (valid(res)) {
				responsesCache.set(cacheKey, res.data.items);
				return res.data.items;
			}

			responsesCache.set(cacheKey, []);
			return [];
		} catch (error) {
			console.warn(`Failed to fetch responses for prompt ${id}:`, error);
			responsesCache.set(cacheKey, []);
			return [];
		} finally {
			responsesLoadingState.set(id, false);
		}
	};

	const clear = (id?: string) => {
		if (id) {
			cache.delete(id);

			for (const key of responsesCache.keys()) {
				if (key.startsWith(`${id}-`)) {
					responsesCache.delete(key);
				}
			}
			responsesLoadingState.delete(id);
		} else {
			cache.clear();
			responsesCache.clear();
			responsesLoadingState.clear();
		}
	};

	const createPrompt = async (prompt: any) => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<Prompt>('/v2/prompts', authStore.sessionToken, {
			method: 'POST',
			body: prompt
		});

		if (valid(res)) {
			cache.set(res.data.id, res.data);
		}

		return res;
	};

	const updatePrompt = async (prompt: any) => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<Prompt>(
			`/v2/prompts/${prompt.id}`,
			authStore.sessionToken,
			{
				method: 'PATCH',
				body: prompt
			}
		);

		if (valid(res)) {
			cache.set(res.data.id, res.data);
		}

		return res;
	};

	const deletePrompt = async (id: string) => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<void>(`/v2/prompts/${id}`, authStore.sessionToken, {
			method: 'DELETE'
		});

		if (res.success) {
			cache.delete(id);
			for (const key of responsesCache.keys()) {
				if (key.startsWith(`${id}-`)) {
					responsesCache.delete(key);
				}
			}
			responsesLoadingState.delete(id);
		}

		return res;
	};

	const createResponse = async (promptId: string, response: any) => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<PromptResponse>(
			`/v2/prompts/${promptId}/responses`,
			authStore.sessionToken,
			{
				method: 'POST',
				body: response
			}
		);

		if (valid(res)) {
			// cache keys are `${id}-${page}-${limit}`; prepend the new response onto every page-1
			// cache for this prompt so any active reader (regardless of its limit) sees it live
			const page1Prefix = `${promptId}-1-`;
			let updatedAny = false;
			for (const [key, responses] of responsesCache.entries()) {
				if (key.startsWith(page1Prefix)) {
					responsesCache.set(key, [res.data, ...responses]);
					updatedAny = true;
				}
			}

			// no page-1 reader yet — seed the default-limit cache so the next render picks it up
			if (!updatedAny) {
				responsesCache.set(`${promptId}-1-25`, [res.data]);
			}
		}

		return res;
	};

	const updateResponse = async (promptId: string, response: any) => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<PromptResponse>(
			`/v2/prompts/${promptId}/responses/${response.id}`,
			authStore.sessionToken,
			{
				method: 'PATCH',
				body: response
			}
		);

		if (valid(res)) {
			for (const [key, responses] of responsesCache.entries()) {
				if (key.startsWith(`${promptId}-`)) {
					const index = responses.findIndex((r) => r.id === response.id);
					if (index !== -1) {
						responses[index] = res.data;
						responsesCache.set(key, [...responses]);
					}
				}
			}
		}

		return res;
	};

	const deleteResponse = async (promptId: string, responseId: string) => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<void>(
			`/v2/prompts/${promptId}/responses/${responseId}`,
			authStore.sessionToken,
			{
				method: 'DELETE'
			}
		);

		if (res.success) {
			for (const [key, responses] of responsesCache.entries()) {
				if (key.startsWith(`${promptId}-`)) {
					responsesCache.set(
						key,
						responses.filter((r) => r.id !== responseId)
					);
				}
			}
		}

		return res;
	};

	return {
		cache,
		responsesCache,
		responsesLoadingState,
		get,
		has,
		isLoadingPrompt,
		getRandomCached,
		setRandomCached,
		getResponses,
		isLoadingResponses,
		fetchPrompt,
		setPrompts,
		fetchResponses,
		createPrompt,
		updatePrompt,
		deletePrompt,
		createResponse,
		updateResponse,
		deleteResponse,
		clear
	};
});
