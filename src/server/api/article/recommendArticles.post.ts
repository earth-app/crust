import { ensureLoggedIn } from '~/server/utils';
import type { Article } from '~/shared/types/article';
import type { User } from '~/shared/types/user';

export default defineEventHandler(async (event) => {
	await ensureLoggedIn(event);

	const config = useRuntimeConfig();
	const body = await readBody<{ user: User; count: number; pool: Article[] }>(event);

	const activities = body.user.activities?.map((a) => a.name) || [];
	if (activities.length === 0) {
		// If the user has no activities, return random articles
		return body.pool.slice(0, body.count);
	}

	try {
		const response = $fetch(`${config.public.cloudBaseUrl}/v1/users/recommend_articles`, {
			headers: {
				Authorization: `Bearer ${config.adminApiKey}`,
				'Content-Type': 'application/json'
			},
			body: {
				pool: body.pool,
				activities,
				limit: body.count
			},
			method: 'POST',
			timeout: 10000
		});

		return response;
	} catch (error) {
		throw createError({
			statusCode: 500,
			statusMessage: `Failed to recommend articles: ${error instanceof Error ? error.message : 'Unknown error'}`,
			cause: error
		});
	}
});
