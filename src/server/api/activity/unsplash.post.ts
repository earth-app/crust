import { ensureLoggedIn } from '~/server/utils';
import { UnsplashImage } from '~/shared/types/activity';

export default defineEventHandler(async (event) => {
	await ensureLoggedIn(event);

	const { query } = getQuery(event);
	const body = await readBody<{ excluded: string }>(event).catch(() => null);

	const config = useRuntimeConfig();
	const accessKey = config.unsplashAccessKey;

	if (!query || typeof query !== 'string' || query.trim() === '') {
		throw createError({
			statusCode: 400,
			message: 'Query must be a non-empty string'
		});
	}

	if (body?.excluded && !Array.isArray(body.excluded)) {
		throw createError({
			statusCode: 400,
			message: 'Excluded must be an array of IDs'
		});
	}

	const excludedIds = body?.excluded
		? body.excluded
				.toString()
				.split(',')
				.map((id) => id.toString().trim())
		: [];

	const retries = 3;

	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			const params = new URLSearchParams({
				query,
				content_filter: 'high',
				count: '30'
			});
			const response = await $fetch<UnsplashImage[]>(
				`https://api.unsplash.com/photos/random?${params.toString()}`,
				{
					headers: {
						Authorization: `Client-ID ${accessKey}`,
						'Accept-Version': 'v1',
						'Content-Type': 'application/json',
						'User-Agent': 'The Earth App/Web (https://earth-app.com)'
					}
				}
			);

			const images = response.filter((img) => !excludedIds.includes(img.id));

			if (images.length > 0) {
				return images;
			}
		} catch (error) {
			console.warn(`Attempt ${attempt} to fetch from Unsplash failed.`, error);

			if (attempt === retries) {
				console.error('All attempts to fetch from Unsplash failed');
				throw createError({
					statusCode: 500,
					message: error instanceof Error ? error.message : 'Unable to fetch images from Unsplash',
					stack: error instanceof Error ? error.stack : undefined
				});
			}
		}
	}

	return [];
});
