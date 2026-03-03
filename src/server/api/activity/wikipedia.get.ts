export default defineEventHandler(async (event) => {
	const { title } = getQuery(event);

	if (!title)
		throw createError({
			statusCode: 400,
			statusMessage: 'Title parameter is required'
		});

	if (typeof title !== 'string' || title.trim() === '') {
		throw createError({
			statusCode: 400,
			statusMessage: 'Title must be a non-empty string'
		});
	}

	try {
		const response = await $fetch(
			`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
			{
				headers: {
					'User-Agent': 'The Earth App/Web (https://earth-app.com)'
				}
			}
		);

		return response;
	} catch (error: any) {
		// Propagate the actual upstream status so callers can distinguish
		// not-found (404) from genuine failures — makeServerRequest suppresses
		// console logging for 404s, avoiding log spam for pages without summaries
		const status: number = error?.status ?? error?.statusCode ?? 500;
		throw createError({
			statusCode: status,
			statusMessage:
				status === 404 ? 'Wikipedia page not found' : 'Failed to fetch Wikipedia summary'
		});
	}
});
