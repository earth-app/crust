import { PixabayVideo } from '~/shared/types/activity';

export default defineEventHandler(async (event) => {
	const { query } = getQuery(event);

	if (!query)
		throw createError({
			statusCode: 400,
			statusMessage: 'Query parameter is required'
		});

	if (typeof query !== 'string' || query.trim() === '') {
		throw createError({
			statusCode: 400,
			statusMessage: 'Query must be a non-empty string'
		});
	}

	const config = useRuntimeConfig();

	try {
		const response = await $fetch<{ hits: PixabayVideo[]; total: number; totalHits: number }>(
			`https://pixabay.com/api/videos/?key=${config.pixabayApiKey}
			&q=${encodeURIComponent(query)}&safesearch=true&per_page=100`,
			{
				headers: {
					'User-Agent': 'The Earth App/Web (https://earth-app.com)'
				}
			}
		);

		return response.hits;
	} catch (error) {
		throw createError({
			statusCode: 500,
			statusMessage: `Failed to fetch images from Pixabay: ${
				error instanceof Error ? error.message : 'Unknown error'
			}`
		});
	}
});
