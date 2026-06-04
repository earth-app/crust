export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig();
	const body = await readBody<{ article: Article; count: number; pool: Article[] }>(event);

	if (!body) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Request body is required.'
		});
	}

	const count = typeof body.count === 'number' && body.count > 0 ? body.count : 5;
	const pool = Array.isArray(body?.pool) ? body.pool : [];

	// pool-shuffle helper used as the belt-and-suspenders fallback so we never blank the UI
	const seedId = body?.article?.id;
	const fallback = (): Article[] => {
		const filtered = seedId ? pool.filter((a) => a?.id !== seedId) : pool;
		if (filtered.length === 0) return [];
		const shuffled = [...filtered].sort(() => Math.random() - 0.5);
		return shuffled.slice(0, count);
	};

	if (!body.article || pool.length === 0) {
		return fallback();
	}

	try {
		const response = await $fetch<Article[]>(
			`${config.public.cloudBaseUrl}/v1/articles/recommend_similar_articles`,
			{
				headers: {
					Authorization: `Bearer ${config.adminApiKey}`,
					Accept: 'application/json',
					'Content-Type': 'application/json'
				},
				body: {
					pool,
					article: body.article,
					limit: count
				},
				method: 'POST',
				timeout: 10000
			}
		);

		if (!Array.isArray(response) || response.length === 0) {
			return fallback();
		}

		return response;
	} catch (error) {
		console.warn(
			'similar articles upstream failed, returning pool fallback:',
			error instanceof Error ? error.message : error
		);
		return fallback();
	}
});
