import { PixabayVideo } from 'types/activity';
import { ensureLoggedIn } from '~/server/utils';

export default defineEventHandler(async (event) => {
	await ensureLoggedIn(event);

	const { query, page } = getQuery(event);

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

	if (typeof page !== 'undefined' && (isNaN(Number(page)) || Number(page) < 1)) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Invalid page number'
		});
	}

	const page0 = page ? Number(page) : 1;

	const config = useRuntimeConfig();
	const url = `https://pixabay.com/api/videos/?key=${config.pixabayApiKey}&q=${encodeURIComponent(query)}&safesearch=true&per_page=20&page=${page0}`;

	try {
		const response = await $fetch<{ hits: PixabayVideo[]; total: number; totalHits: number }>(url, {
			headers: {
				'User-Agent': 'The Earth App/Web (https://earth-app.com)'
			}
		});

		return {
			hits: response.hits,
			total: response.total,
			totalHits: response.totalHits,
			page: page0,
			hasMore: page0 * 20 < response.totalHits
		};
	} catch (error) {
		console.warn('Pixabay videos unavailable; returning empty result set.', error);
		return {
			hits: [],
			total: 0,
			totalHits: 0,
			page: page0,
			hasMore: false
		};
	}
});
