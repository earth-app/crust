import { ensureLoggedIn } from '~/server/utils';

const validJournies = ['activity', 'prompt', 'article'];

export default defineEventHandler(async (event) => {
	const { type } = getQuery(event);

	if (!type || typeof type !== 'string' || !validJournies.includes(type)) {
		throw createError({
			statusCode: 400,
			statusMessage:
				'Invalid or missing "type" parameter. Must be one of: ' + validJournies.join(', ')
		});
	}

	const user = await ensureLoggedIn(event);
	const config = useRuntimeConfig();

	try {
		const response = await $fetch(
			`${config.public.cloudBaseUrl}/v1/users/journey/${type}/${user.id}/delete`,
			{
				headers: {
					Authorization: `Bearer ${config.adminApiKey}`,
					Accept: 'application/json'
				},
				method: 'DELETE',
				timeout: 10000
			}
		);

		return response;
	} catch (error) {
		throw createError({
			statusCode: 500,
			statusMessage: `Failed to clear user journey: ${
				error instanceof Error ? error.message : 'Unknown error'
			}`,
			cause: error
		});
	}
});
