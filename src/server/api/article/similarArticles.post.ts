import { ensureLoggedIn } from '~/server/utils';
import type { Article } from '~/shared/types/article';

export default defineEventHandler(async (event) => {
	await ensureLoggedIn(event);

	const config = useRuntimeConfig();
	const body = await readBody<{ article: Article; count: number; pool: Article[] }>(event);

	try {
		const response = $fetch(
			`${config.public.cloudBaseUrl}/v1/articles/recommend_similar_articles`,
			{
				headers: {
					Authorization: `Bearer ${config.adminApiKey}`,
					'Content-Type': 'application/json'
				},
				body: {
					pool: body.pool,
					article: body.article,
					limit: body.count
				},
				method: 'POST',
				timeout: 10000
			}
		);

		return response;
	} catch (error) {
		throw createError({
			statusCode: 500,
			statusMessage: `Failed to recommend articles: ${error instanceof Error ? error.message : 'Unknown error'}`,
			cause: error
		});
	}
});
