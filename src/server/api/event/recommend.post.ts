import { ensureLoggedIn } from '~/server/utils';

export default defineEventHandler(async (event) => {
	const user = await ensureLoggedIn(event);

	const config = useRuntimeConfig();
	const body = await readBody<{
		count: number;
		pool: Event[];
	}>(event);

	const count = typeof body?.count === 'number' && body.count > 0 ? body.count : 5;
	const pool = Array.isArray(body?.pool) ? body.pool : [];
	const activities = user.activities?.map((a) => a.name) || [];

	const fallback = (): Event[] => {
		if (pool.length === 0) return [];
		const shuffled = [...pool].sort(() => Math.random() - 0.5);
		return shuffled.slice(0, count);
	};

	if (activities.length === 0 || pool.length === 0) {
		return fallback();
	}

	try {
		const response = await $fetch<Event[]>(
			`${config.public.cloudBaseUrl}/v1/users/recommend_events`,
			{
				headers: {
					Authorization: `Bearer ${config.adminApiKey}`,
					Accept: 'application/json',
					'Content-Type': 'application/json'
				},
				body: {
					pool,
					activities,
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
			'recommend events upstream failed, returning pool fallback:',
			error instanceof Error ? error.message : error
		);
		return fallback();
	}
});
