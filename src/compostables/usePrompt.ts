import type { Prompt, PromptResponse } from '~/shared/types/prompts';
import * as util from '~/shared/util';
import { useCurrentSessionToken } from './useLogin';

export async function getRandomPrompts(count: number = 10) {
	return await util.makeClientAPIRequest<Prompt[]>(`/v2/prompts/random?count=${count}`);
}

export async function getPrompt(id: string) {
	return await util.makeClientAPIRequest<Prompt>(`/v2/prompts/${id}`);
}

export async function updatePrompt(id: string, prompt: string) {
	return await util.makeClientAPIRequest<Prompt>(`/v2/prompts/${id}`, useCurrentSessionToken(), {
		method: 'PATCH',
		body: { prompt }
	});
}

export async function removePrompt(id: string) {
	return await util.makeClientAPIRequest<{ message: string }>(
		`/v2/prompts/${id}`,
		useCurrentSessionToken(),
		{
			method: 'DELETE'
		}
	);
}

export async function getPromptResponses(id: string, page: number = 1, limit: number = 25) {
	return await util.makeClientAPIRequest<{ items: PromptResponse[] }>(
		`/v2/prompts/${id}/responses?page=${page}&limit=${limit}`
	);
}

export async function getPromptResponsesCount(id: string) {
	return await util.makeClientAPIRequest<{ count: number; prompt: Prompt }>(
		`/v2/prompts/${id}/responses/count`
	);
}

export async function createPromptResponse(promptId: string, content: string) {
	return await util.makeClientAPIRequest<PromptResponse>(
		`/v2/prompts/${promptId}/responses`,
		useCurrentSessionToken(),
		{
			method: 'POST',
			body: { content }
		}
	);
}

export async function updatePromptResponse(promptId: string, id: string, content: string) {
	return await util.makeClientAPIRequest<PromptResponse>(
		`/v2/prompts/${promptId}/responses/${id}`,
		useCurrentSessionToken(),
		{
			method: 'PATCH',
			body: { content }
		}
	);
}

export async function removePromptResponse(promptId: string, id: string) {
	return await util.makeClientAPIRequest<{ message: string }>(
		`/v2/prompts/${promptId}/responses/${id}`,
		useCurrentSessionToken(),
		{
			method: 'DELETE'
		}
	);
}
