const iconSets = [
	'mdi',
	'material-symbols',
	'material-symbols-light',
	'carbon',
	'cib',
	'circum',
	'eos-icons',
	'lucide',
	'heroicons',
	'nimbus',
	'ph',
	'solar',
	'healthicons',
	'game-icons',
	'icon-park-outline',
	'map'
];

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
			`https://api.iconify.design/search?query=${encodeURIComponent(search)}&prefixes=${iconSets.join(',')}&limit=50`,
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
			statusMessage: 'Failed to make icon search'
		});
	}
});
