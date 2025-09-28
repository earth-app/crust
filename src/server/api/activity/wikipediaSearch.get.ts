const NSFW_KEYWORDS = [
	'sex',
	'porn',
	'pornography',
	'nude',
	'erotic',
	'fetish',
	'incest',
	'masturbation',
	'prostitution',
	'bdsm',
	'strip game',
	'cunnilingus',
	'fellatio',
	'handjob',
	'blowjob',
	'strip club',
	'stripping',
	'murder',
	'bestiality',
	'zoophilia'
];

function isNSFW(title: string, snippet: string) {
	const text = (title + ' ' + snippet).toLowerCase();
	return NSFW_KEYWORDS.some((keyword) => text.includes(keyword));
}

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
		const response = await $fetch<{ query: { search: { title: string; snippet: string }[] } }>(
			`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
				search
			)}&format=json&origin=*`,
			{
				headers: {
					'User-Agent': 'The Earth App/Web (https://earth-app.com)'
				}
			}
		);

		const safeResults = response.query.search.filter(
			(result) => !isNSFW(result.title, result.snippet)
		);

		return { query: { search: safeResults } };
	} catch (error) {
		throw createError({
			statusCode: 500,
			statusMessage: 'Failed to create Wikipedia search'
		});
	}
});
