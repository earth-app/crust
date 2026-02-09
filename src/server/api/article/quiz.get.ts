import { ensureLoggedIn } from '~/server/utils';

export default defineEventHandler(async (event) => {
	const user = await ensureLoggedIn(event);

	const { articleId } = getQuery(event);

	if (!articleId || typeof articleId !== 'string') {
		throw createError({
			statusCode: 400,
			message: 'Missing or invalid articleId query parameter'
		});
	}

	const config = useRuntimeConfig();

	try {
		const res = await $fetch(
			`${config.public.cloudBaseUrl}/v1/articles/quiz/score?userId=${user.id}&articleId=${articleId}`,
			{
				method: 'GET',
				headers: {
					Authorization: `Bearer ${config.adminApiKey}`,
					Accept: 'application/json'
				}
			}
		);

		return res;
	} catch (error: any) {
		// ignore 404 errors, which just means the user hasn't taken the quiz yet
		if (error.statusCode === 404) {
			return null;
		}
		throw error;
	}
});
