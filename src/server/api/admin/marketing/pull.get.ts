import { ensureAdministrator } from '~/server/utils';
import type { MarketingKind } from '~/shared/types/marketing';

// one real sample per kind, pulled read-only from mantle2 to seed a preview (never mutated)
const KIND_PATHS: Partial<Record<MarketingKind, string>> = {
	activity: '/v2/activities/random?count=1',
	event: '/v2/events/random?count=1',
	prompt: '/v2/prompts/random?count=1',
	article: '/v2/articles/random?count=1',
	user: '/v2/users?limit=1&sort=rand'
};

function firstItem(res: unknown): unknown {
	if (Array.isArray(res)) return res[0];
	if (res && typeof res === 'object' && Array.isArray((res as { items?: unknown[] }).items)) {
		return (res as { items: unknown[] }).items[0];
	}
	return res;
}

export default defineEventHandler(async (event) => {
	await ensureAdministrator(event);

	const config = useRuntimeConfig();
	const { kind } = getQuery(event) as { kind?: MarketingKind };
	const path = kind ? KIND_PATHS[kind] : undefined;

	if (!kind || !path) {
		throw createError({
			statusCode: 400,
			statusMessage: 'A supported kind is required (activity, event, prompt, article, user)'
		});
	}

	// forward the admin's bearer so gated/private sample content resolves
	const auth = getRequestHeader(event, 'Authorization');

	try {
		const res = await $fetch(`${config.public.apiBaseUrl}${path}`, {
			headers: {
				...(auth ? { Authorization: auth } : {}),
				Accept: 'application/json',
				'User-Agent': 'The Earth App/Web (https://earth-app.com)'
			}
		});

		const item = firstItem(res);
		if (!item) {
			throw createError({
				statusCode: 404,
				statusMessage: `No live ${kind} sample is available`
			});
		}

		return { kind, source: 'live', payload: item };
	} catch (error) {
		if (error && typeof error === 'object' && 'statusCode' in error) throw error;
		throw createError({
			statusCode: 502,
			statusMessage: `Failed to pull live ${kind}: ${error instanceof Error ? error.message : 'Unknown error'}`
		});
	}
});
