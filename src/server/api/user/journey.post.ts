import { ensureLoggedIn, ensureValidActivity } from '~/server/utils';

const validJournies = ['activity', 'prompt', 'article'];

export default defineEventHandler(async (event) => {
	const { type, activity } = getQuery(event);

	if (!type || typeof type !== 'string' || !validJournies.includes(type)) {
		throw createError({
			statusCode: 400,
			statusMessage:
				'Invalid or missing "type" parameter. Must be one of: ' + validJournies.join(', ')
		});
	}

	if (type === 'activity') {
		if (!activity || typeof activity !== 'string' || activity.trim() === '')
			throw createError({
				statusCode: 400,
				statusMessage: 'Missing or invalid "activity" parameter for activity journey type.'
			});

		await ensureValidActivity(activity as string);
	}

	const user = await ensureLoggedIn(event);
	const config = useRuntimeConfig();

	try {
		const response = await $fetch(
			`${config.public.cloudBaseUrl}/v1/users/journey/${type}/${user.id}${type === 'activity' ? `?activity=${activity}` : '/increment'}`,
			{
				headers: {
					Authorization: `Bearer ${config.adminApiKey}`,
					Accept: 'application/json'
				},
				method: 'POST',
				timeout: 10000
			}
		);

		return response;
	} catch (error) {
		throw createError({
			statusCode: 500,
			statusMessage: `Failed to bump user journey: ${
				error instanceof Error ? error.message : 'Unknown error'
			}`,
			cause: error
		});
	}
});
