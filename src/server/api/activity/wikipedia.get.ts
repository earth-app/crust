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
	} catch (error) {
		throw createError({
			statusCode: 500,
			statusMessage: 'Failed to fetch Wikipedia summary'
		});
	}
});
