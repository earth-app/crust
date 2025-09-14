export default defineEventHandler(async (event) => {
	const { search } = getQuery(event);

	if (!search)
		throw createError({
			statusCode: 400,
			statusMessage: 'Search parameter is required'
		});

	if (typeof search !== 'string' || search.trim() === '') {
		throw createError({
			statusCode: 400,
			statusMessage: 'Search must be a non-empty string'
		});
	}

	if (typeof search !== 'string' || search.trim() === '') {
		throw createError({
			statusCode: 400,
			statusMessage: 'Search must be a non-empty string'
		});
	}

	try {
		const response = await $fetch(
			`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
				search
			)}&format=json&origin=*`,
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
			statusMessage: 'Failed to create Wikipedia search'
		});
	}
});
