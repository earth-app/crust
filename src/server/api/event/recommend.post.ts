import { ensureLoggedIn } from '~/server/utils';
import { Event } from '~/shared/types/event';

export default defineEventHandler(async (event) => {
	const user = await ensureLoggedIn(event);

	const config = useRuntimeConfig();
	const body = await readBody<{
		count: number;
		pool: Event[];
	}>(event);

	const activities = user.activities?.map((a) => a.name) || [];
	if (activities.length === 0) {
		// If the user has no activities, return random events
		return body.pool.slice(0, body.count);
	}

	if (!body.pool || !Array.isArray(body.pool) || body.pool.length === 0) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Invalid request body. Must include non-empty "pool" array.'
		});
	}

	if (!body.count || typeof body.count !== 'number' || body.count <= 0) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Invalid "count" parameter. Must be a positive number.'
		});
	}

	try {
		const response = await $fetch(`${config.public.cloudBaseUrl}/v1/users/recommend_events`, {
			headers: {
				Authorization: `Bearer ${config.adminApiKey}`,
				Accept: 'application/json',
				'Content-Type': 'application/json'
			},
			body: {
				pool: body.pool,
				activities,
				limit: body.count
			},
			method: 'POST',
			timeout: 10000
		});

		return response;
	} catch (error) {
		throw createError({
			statusCode: 500,
			statusMessage: `Failed to recommend events: ${
				error instanceof Error ? error.message : 'Unknown error'
			}`,
			cause: error
		});
	}
});
