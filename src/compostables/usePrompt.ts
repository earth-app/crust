import type { Prompt, PromptResponse } from '~/shared/types/prompts';
import * as util from '~/shared/util';
import { useCurrentSessionToken } from './useLogin';

export async function getRandomPrompts(limit: number = 10) {
	return await util.makeClientAPIRequest<Prompt[]>(`/v1/prompts/random?limit=${limit}`);
}

export async function getPrompt(id: string) {
	return await util.makeClientAPIRequest<Prompt>(`/v1/prompts/${id}`);
}

export async function getPromptResponses(id: string, page: number = 1, limit: number = 25) {
	return await util.makeClientAPIRequest<PromptResponse[]>(
		`/v1/prompts/${id}/responses?page=${page}&limit=${limit}`
	);
}

export async function getPromptResponsesCount(id: string) {
	return await util.makeAPIRequest<number>(
		`responses-count-${id}`,
		`/v1/prompts/${id}/responses/count`
	);
}

export async function createPromptResponse(promptId: string, content: string) {
	return await util.makeClientAPIRequest<PromptResponse>(
		`/v1/prompts/${promptId}/responses`,
		useCurrentSessionToken(),
		{
			method: 'POST',
			body: { content }
		}
	);
}
