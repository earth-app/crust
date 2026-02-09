import { ensureLoggedIn } from '~/server/utils';

export default defineEventHandler(async (event) => {
	const user = await ensureLoggedIn(event);
	const config = useRuntimeConfig();

	const { answers, articleId } = await readBody<{
		answers: { question: string; text: string; index: number }[];
		articleId: string;
	}>(event);

	if (!answers || !articleId) {
		throw createError({
			statusCode: 400,
			message: 'Missing answers or articleId in request body'
		});
	}

	const res = await $fetch(`${config.public.cloudBaseUrl}/v1/articles/quiz/submit`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${config.adminApiKey}`,
			Accept: 'application/json',
			'Content-Type': 'application/json'
		},
		body: {
			answers,
			articleId,
			userId: user.id
		}
	});

	return res;
});
