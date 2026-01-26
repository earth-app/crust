import { Event } from '~/shared/types/event';

export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig();
	const body = await readBody<{ event: Event; count: number; pool: Event[] }>(event);

	if (!body) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Request body is required.'
		});
	}

	if (!body.event || !body.pool || !Array.isArray(body.pool) || body.pool.length === 0) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Invalid request body. Must include "event" and non-empty "pool" array.'
		});
	}

	if (!body.count || typeof body.count !== 'number' || body.count <= 0) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Invalid "count" parameter. Must be a positive number.'
		});
	}

	try {
		const response = await $fetch(
			`${config.public.cloudBaseUrl}/v1/events/recommend_similar_events`,
			{
				headers: {
					Authorization: `Bearer ${config.adminApiKey}`,
					Accept: 'application/json',
					'Content-Type': 'application/json'
				},
				body: {
					pool: body.pool,
					event: body.event,
					limit: body.count
				},
				method: 'POST',
				timeout: 10000
			}
		);

		return response;
	} catch (error) {
		throw createError({
			statusCode: 500,
			statusMessage: `Failed to recommend similar events: ${
				error instanceof Error ? error.message : 'Unknown error'
			}`,
			cause: error
		});
	}
});
