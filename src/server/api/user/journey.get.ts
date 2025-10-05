import { ensureLoggedIn } from '~/server/utils';

const validJournies = ['activity', 'prompt', 'article'];

export default defineEventHandler(async (event) => {
	await ensureLoggedIn(event);
	const { type, id } = getQuery(event);

	if (!type || typeof type !== 'string' || !validJournies.includes(type)) {
		throw createError({
			statusCode: 400,
			statusMessage:
				'Invalid or missing "type" parameter. Must be one of: ' + validJournies.join(', ')
		});
	}

	const id0 = id?.toString();

	if (!id0 || !id0.match(/^[0-9]{24}$/)) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Invalid or missing "id" parameter.'
		});
	}

	const config = useRuntimeConfig();

	try {
		const response = await $fetch(
			`${config.public.cloudBaseUrl}/v1/users/journey/${type}/${id}${type === 'activity' ? '/count' : ''}`,
			{
				headers: {
					Authorization: `Bearer ${config.adminApiKey}`,
					Accept: 'application/json'
				},
				method: 'GET',
				timeout: 10000
			}
		);

		return response;
	} catch (error) {
		throw createError({
			statusCode: 500,
			statusMessage: `Failed to fetch user journey: ${
				error instanceof Error ? error.message : 'Unknown error'
			}`,
			cause: error
		});
	}
});
