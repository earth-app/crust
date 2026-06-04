import { Event } from 'types/event';

export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig();
	const body = await readBody<{ event: Event; count: number; pool: Event[] }>(event);

	if (!body) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Request body is required.'
		});
	}

	const count = typeof body.count === 'number' && body.count > 0 ? body.count : 5;
	const pool = Array.isArray(body?.pool) ? body.pool : [];

	const seedId = body?.event?.id;
	const fallback = (): Event[] => {
		const filtered = seedId ? pool.filter((e) => e?.id !== seedId) : pool;
		if (filtered.length === 0) return [];
		const shuffled = [...filtered].sort(() => Math.random() - 0.5);
		return shuffled.slice(0, count);
	};

	if (!body.event || pool.length === 0) {
		return fallback();
	}

	try {
		const response = await $fetch<Event[]>(
			`${config.public.cloudBaseUrl}/v1/events/recommend_similar_events`,
			{
				headers: {
					Authorization: `Bearer ${config.adminApiKey}`,
					Accept: 'application/json',
					'Content-Type': 'application/json'
				},
				body: {
					pool,
					event: body.event,
					limit: count
				},
				method: 'POST',
				timeout: 10000
			}
		);

		if (!Array.isArray(response) || response.length === 0) {
			return fallback();
		}

		return response;
	} catch (error) {
		console.warn(
			'similar events upstream failed, returning pool fallback:',
			error instanceof Error ? error.message : error
		);
		return fallback();
	}
});
