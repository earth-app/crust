const validJournies = ['prompt', 'article', 'event'];
const validTypes = [...validJournies, 'points'];

export default defineEventHandler(async (event) => {
	const { type, limit } = getQuery(event);

	if (!type || typeof type !== 'string' || !validTypes.includes(type)) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Invalid or missing "type" parameter. Must be one of: ' + validTypes.join(', ')
		});
	}

	const limit0 = parseInt(limit as string) || 10;

	const config = useRuntimeConfig();

	const url =
		type === 'points'
			? `${config.public.cloudBaseUrl}/v1/users/impact_points/leaderboard?limit=${limit0}`
			: `${config.public.cloudBaseUrl}/v1/users/journey/${type}/leaderboard?limit=${limit0}`;

	try {
		const response = await $fetch<{ id: string; streak?: number; points?: number }[]>(url, {
			headers: {
				Authorization: `Bearer ${config.adminApiKey}`,
				Accept: 'application/json',
				'Cache-Control': 'no-cache'
			},
			method: 'GET',
			timeout: 10000
		});

		// normalize points -> streak so the client keeps a single { id, streak } shape
		if (type === 'points' && Array.isArray(response)) {
			return response.map((entry) => ({
				id: entry.id,
				streak: entry.points ?? entry.streak ?? 0
			}));
		}

		return response;
	} catch (error) {
		throw createError({
			statusCode: 500,
			statusMessage: `Failed to fetch user journey: ${
				error instanceof Error ? error.message : 'Unknown error'
			}`,
			cause: error
		});
	}
});
