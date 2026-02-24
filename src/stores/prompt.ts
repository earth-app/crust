import { defineStore } from 'pinia';
import type { Prompt, PromptResponse } from '~/shared/types/prompts';
import { makeClientAPIRequest } from '~/shared/utils/util';
import { useAuthStore } from './auth';

export const usePromptStore = defineStore('prompt', () => {
	const MAX_CACHE_SIZE = 100; // Limit cache to prevent memory leaks
	const cache = reactive(new Map<string, Prompt>());
	const fetchQueue = new Map<string, Promise<void>>();

	const responsesCache = reactive(new Map<string, PromptResponse[]>());
	const responsesLoadingState = reactive(new Map<string, boolean>());

	// LRU cache eviction
	const evictOldestIfNeeded = () => {
		if (cache.size >= MAX_CACHE_SIZE) {
			const firstKey = cache.keys().next().value;
			if (firstKey) {
				cache.delete(firstKey);
				responsesCache.delete(firstKey);
				responsesLoadingState.delete(firstKey);
			}
		}
	};

	const get = (id: string): Prompt | undefined => {
		return cache.get(id);
	};

	const has = (id: string): boolean => {
		return cache.has(id);
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

		// create new fetch promise
		const fetchPromise = (async () => {
			try {
				const res = await makeClientAPIRequest<Prompt>(`/v2/prompts/${id}`);

				if (res.success && res.data) {
					if ('message' in res.data) {
						console.warn(`Failed to fetch prompt ${id}:`, res.data.message);
						return;
					}

					evictOldestIfNeeded();
					cache.set(id, res.data);
				} else {
					console.warn(`Failed to fetch prompt ${id}:`, res.message);
				}
			} catch (error) {
				console.warn(`Failed to fetch prompt ${id}:`, error);
			} finally {
				fetchQueue.delete(id);
			}
		})();

		fetchQueue.set(id, fetchPromise);
		await fetchPromise;

		return cache.get(id) || null;
	};

	const setPrompts = (prompts: Prompt[]) => {
		for (const prompt of prompts) {
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

			if (res.success && res.data && !('message' in res.data)) {
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

		if (res.success && res.data && !('message' in res.data)) {
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

		if (res.success && res.data && !('message' in res.data)) {
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

		if (res.success && res.data && !('message' in res.data)) {
			const cacheKey = `${promptId}-1`;
			const existingResponses = responsesCache.get(cacheKey) || [];
			responsesCache.set(cacheKey, [res.data, ...existingResponses]);
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

		if (res.success && res.data && !('message' in res.data)) {
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
