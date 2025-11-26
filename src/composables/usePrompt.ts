import type { com } from '@earth-app/ocean';
import type { SortingOption } from '~/shared/types/global';
import type { Prompt, PromptResponse } from '~/shared/types/prompts';
import { makeClientAPIRequest, paginatedAPIRequest } from '~/shared/util';
import { useCurrentSessionToken } from './useLogin';

export async function getPrompts(
	limit: number = 25,
	search: string = '',
	sort: SortingOption = 'desc'
) {
	return await paginatedAPIRequest<Prompt>(
		`prompts-${search}-${limit}`,
		`/v2/prompts`,
		useCurrentSessionToken(),
		{},
		limit,
		search,
		sort
	);
}

export async function getRandomPrompts(count: number = 10) {
	const res = await makeClientAPIRequest<Prompt[]>(`/v2/prompts/random?count=${count}`);

	if (res.success && res.data) {
		if ('message' in res.data) {
			return res;
		}

		// load individual prompts into state
		for (const p of res.data) {
			useState<Prompt | null>(`prompt-${p.id}`, () => p);
		}
	}

	return res;
}

export function usePrompt(id: string) {
	const prompt = useState<Prompt | null>(`prompt-${id}`, () => null);

	const fetch = async () => {
		const res = await makeClientAPIRequest<Prompt>(`/v2/prompts/${id}`);
		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

			prompt.value = res.data;
		}

		return res;
	};

	if (!prompt.value) {
		fetch();
	}

	return {
		prompt,
		fetch
	};
}

export async function updatePrompt(id: string, prompt: string) {
	return await makeClientAPIRequest<Prompt>(`/v2/prompts/${id}`, useCurrentSessionToken(), {
		method: 'PATCH',
		body: { prompt }
	});
}

export async function removePrompt(id: string) {
	return await makeClientAPIRequest<{ message: string }>(
		`/v2/prompts/${id}`,
		useCurrentSessionToken(),
		{
			method: 'DELETE'
		}
	);
}

export function usePromptResponses(id: string, page: number = 1, limit: number = 25) {
	const responses = useState<PromptResponse[]>(`prompt-${id}-responses-page-${page}`, () => []);
	const loading = useState<boolean>(`prompt-${id}-responses-loading`, () => false);

	const fetch = async (newPage: number = page, newLimit: number = limit) => {
		if (loading.value) return { success: false, message: 'Already loading' };

		loading.value = true;
		const res = await makeClientAPIRequest<{ items: PromptResponse[] }>(
			`/v2/prompts/${id}/responses?page=${newPage}&limit=${newLimit}`
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				loading.value = false;
				return res;
			}

			responses.value = res.data.items;
		}

		loading.value = false;
		return res;
	};

	if (responses.value.length === 0 && !loading.value) {
		fetch(page, limit);
	}

	return {
		responses,
		fetch,
		loading
	};
}

export async function createPrompt(
	prompt: string,
	visibility?: typeof com.earthapp.Visibility.prototype.name
) {
	return await makeClientAPIRequest<Prompt>('/v2/prompts', useCurrentSessionToken(), {
		method: 'POST',
		body: { prompt, visibility }
	});
}

export async function createPromptResponse(promptId: string, content: string) {
	return await makeClientAPIRequest<PromptResponse>(
		`/v2/prompts/${promptId}/responses`,
		useCurrentSessionToken(),
		{
			method: 'POST',
			body: { content }
		}
	);
}

export async function updatePromptResponse(promptId: string, id: string, content: string) {
	return await makeClientAPIRequest<PromptResponse>(
		`/v2/prompts/${promptId}/responses/${id}`,
		useCurrentSessionToken(),
		{
			method: 'PATCH',
			body: { content }
		}
	);
}

export async function removePromptResponse(promptId: string, id: string) {
	return await makeClientAPIRequest<{ message: string }>(
		`/v2/prompts/${promptId}/responses/${id}`,
		useCurrentSessionToken(),
		{
			method: 'DELETE'
		}
	);
}

export function useUserPrompts(
	identifier: string,
	page: number = 1,
	limit: number = 25,
	sort: SortingOption = 'desc'
) {
	const total = useState<number>(`user-${identifier}-prompts-total`, () => 0);
	const prompts = useState<Prompt[]>(`user-${identifier}-prompts-${page}:${limit}`, () => []);

	const fetch = async (newPage: number = page, newLimit: number = limit) => {
		const res = await makeClientAPIRequest<{
			items: Prompt[];
			total: number;
		}>(`/v2/users/${identifier}/prompts?page=${newPage}&limit=${newLimit}&sort=${sort}`);
		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

			prompts.value = res.data.items;
			total.value = res.data.total;

			// load individual prompts into state
			for (const p of res.data.items) {
				useState<Prompt | null>(`prompt-${p.id}`, () => p);
			}
		}
		return res;
	};

	if (prompts.value.length === 0) {
		fetch(page, limit);
	}

	return {
		prompts,
		total,
		fetch
	};
}
