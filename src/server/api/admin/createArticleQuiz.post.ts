import { ensureAdministrator } from '~/server/utils';
import { Article } from '~/shared/types/article';

export default defineEventHandler(async (event) => {
	await ensureAdministrator(event);

	const config = useRuntimeConfig();
	const { article } = await readBody<{ article: Article }>(event);

	const res = await $fetch(`${config.public.cloudBaseUrl}/v1/articles/quiz/create`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${config.adminApiKey}`,
			Accept: 'application/json'
		},
		body: { article }
	});

	return res;
});
