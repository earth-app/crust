const validJournies = ['activity', 'prompt', 'article', 'event'];

export default defineEventHandler(async (event) => {
	const { type, limit } = getQuery(event);

	if (!type || typeof type !== 'string' || !validJournies.includes(type)) {
		throw createError({
			statusCode: 400,
			statusMessage:
				'Invalid or missing "type" parameter. Must be one of: ' + validJournies.join(', ')
		});
	}

	const limit0 = parseInt(limit as string) || 10;

	const config = useRuntimeConfig();

	try {
		const response = await $fetch<{ id: string; streak: number }[]>(
			`${config.public.cloudBaseUrl}/v1/users/journey/${type}/leaderboard?limit=${limit0}`,
			{
				headers: {
					Authorization: `Bearer ${config.adminApiKey}`,
					Accept: 'application/json',
					'Cache-Control': 'no-cache'
				},
				method: 'GET',
				timeout: 10000
			}
		);

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
