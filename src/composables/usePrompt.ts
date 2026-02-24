import type { com } from '@earth-app/ocean';
import type { SortingOption } from '~/shared/types/global';
import type { Prompt } from '~/shared/types/prompts';
import { makeAPIRequest, makeClientAPIRequest, paginatedAPIRequest } from '~/shared/utils/util';
import { useAuthStore } from '~/stores/auth';
import { usePromptStore } from '~/stores/prompt';

export function usePrompt(id: string) {
	const promptStore = usePromptStore();
	const prompt = computed(() => promptStore.get(id) || null);

	const fetch = async () => {
		await promptStore.fetchPrompt(id);
	};

	const update = async (promptText: string) => {
		return await promptStore.updatePrompt({ id, title: promptText });
	};

	const remove = async () => {
		return await promptStore.deletePrompt(id);
	};

	return {
		prompt,
		fetch,
		update,
		remove
	};
}

export function usePrompts(
	page: number = 1,
	limit: number = 25,
	search: string = '',
	sort: SortingOption = 'desc'
) {
	const promptStore = usePromptStore();
	const authStore = useAuthStore();
	const prompts = useState<Prompt[]>(`prompts-${search}-${page}-${limit}-${sort}`, () => []);
	const total = useState<number>(`prompts-total-${search}-${page}-${limit}-${sort}`, () => 0);

	const fetch = async (
		newPage: number = page,
		newLimit: number = limit,
		newSearch: string = search
	) => {
		const res = await makeAPIRequest<{ items: Prompt[]; total: number }>(
			`prompts-${newSearch}-${newPage}-${newLimit}-${sort}`,
			`/v2/prompts?page=${newPage}&limit=${newLimit}&search=${encodeURIComponent(newSearch)}&sort=${sort}`
		);
		if (res.success && res.data && !('message' in res.data) && Array.isArray(res.data.items)) {
			prompts.value = res.data.items;
			total.value = res.data.total;
			promptStore.setPrompts(res.data.items);
		}
		return res;
	};

	const fetchAll = async (
		limit: number = 25,
		search: string = '',
		sort: SortingOption = 'desc'
	) => {
		return await paginatedAPIRequest<Prompt>(
			`/v2/prompts`,
			authStore.sessionToken,
			{},
			limit,
			search,
			sort
		);
	};

	const getRandom = async (count: number = 10) => {
		const res = await makeClientAPIRequest<Prompt[]>(`/v2/prompts/random?count=${count}`);

		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

			// load individual prompts into store
			promptStore.setPrompts(res.data);
		}

		return res;
	};

	const create = async (
		promptText: string,
		visibility?: typeof com.earthapp.Visibility.prototype.name
	) => {
		return await promptStore.createPrompt({
			title: promptText,
			description: promptText,
			visibility
		});
	};

	return {
		prompts,
		total,
		fetch,
		fetchAll,
		getRandom,
		create
	};
}

export function usePromptResponses(id: string, page: number = 1, limit: number = 25) {
	const promptStore = usePromptStore();
	const responses = computed(() => promptStore.getResponses(id, page, limit) || []);
	const loading = computed(() => promptStore.isLoadingResponses(id));

	const fetch = async (newPage: number = page, newLimit: number = limit) => {
		if (loading.value) return { success: false, message: 'Already loading' };
		await promptStore.fetchResponses(id, newPage, newLimit);
		return { success: true };
	};

	const createResponse = async (content: string) => {
		return await promptStore.createResponse(id, { content });
	};

	const updateResponse = async (responseId: string, content: string) => {
		return await promptStore.updateResponse(id, { id: responseId, content });
	};

	const removeResponse = async (responseId: string) => {
		return await promptStore.deleteResponse(id, responseId);
	};

	if (responses.value.length === 0 && !loading.value) {
		fetch(page, limit);
	}

	return {
		responses,
		fetch,
		loading,
		createResponse,
		updateResponse,
		removeResponse
	};
}

export function useUserPrompts(
	identifier: string,
	page: number = 1,
	limit: number = 25,
	sort: SortingOption = 'desc'
) {
	const promptStore = usePromptStore();
	const total = useState<number>(`user-${identifier}-prompts-total`, () => 0);
	const prompts = useState<Prompt[]>(`user-${identifier}-prompts-${page}:${limit}`, () => []);

	const fetch = async (newPage: number = page, newLimit: number = limit, search: string = '') => {
		const res = await makeAPIRequest<{
			items: Prompt[];
			total: number;
		}>(
			`user-prompts-${identifier}-${newPage}-${newLimit}`,
			`/v2/users/${identifier}/prompts?page=${newPage}&limit=${newLimit}&sort=${sort}&search=${encodeURIComponent(search)}`
		);
		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

			prompts.value = res.data.items;
			total.value = res.data.total;

			// load individual prompts into store
			promptStore.setPrompts(res.data.items);
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
