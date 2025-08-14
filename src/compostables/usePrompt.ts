import type { Prompt } from '~/shared/types/prompts';
import * as util from '~/shared/util';

export async function getRandomPrompts(limit: number = 10) {
	return await util.makeAPIRequest<Prompt[]>(null, `/v1/prompts/random?limit=${limit}`);
}
