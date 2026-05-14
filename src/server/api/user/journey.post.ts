import { ensureLoggedIn, ensureValidActivity } from '~/server/utils';

const validJournies = ['activity', 'prompt', 'article'];

export default defineEventHandler(async (event) => {
	const { type, activity } = getQuery(event);
	const normalizedActivity = typeof activity === 'string' ? activity.trim() : undefined;

	if (!type || typeof type !== 'string' || !validJournies.includes(type)) {
		throw createError({
			statusCode: 400,
			statusMessage:
				'Invalid or missing "type" parameter. Must be one of: ' + validJournies.join(', ')
		});
	}

	if (type === 'activity') {
		if (!normalizedActivity)
			throw createError({
				statusCode: 400,
				statusMessage: 'Missing or invalid "activity" parameter for activity journey type.'
			});

		await ensureValidActivity(normalizedActivity);
	}

	const user = await ensureLoggedIn(event);
	const config = useRuntimeConfig();

	try {
		const response = await $fetch.raw<{ count: number }>(
			`${config.public.cloudBaseUrl}/v1/users/journey/${type}/${user.id}${
				type === 'activity'
					? `?activity=${encodeURIComponent(normalizedActivity || '')}`
					: '/increment'
			}`,
			{
				headers: {
					Authorization: `Bearer ${config.adminApiKey}`,
					Accept: 'application/json',
					'Cache-Control': 'no-cache'
				},
				method: 'POST',
				timeout: 10000,
				ignoreResponseError: true
			}
		);

		if (response.status >= 400) {
			throw createError({
				data: response._data,
				statusCode: response.status,
				statusMessage: `Failed to bump user journey: ${response.statusText || 'Unknown error'}`
			});
		}

		return {
			...(response._data ?? {}),
			incremented: response.status === 201
		};
	} catch (error) {
		if (error && typeof error === 'object' && 'statusCode' in error) {
			throw error;
		}

		throw createError({
			statusCode: 500,
			statusMessage: `Failed to bump user journey: ${
				error instanceof Error ? error.message : 'Unknown error'
			}`,
			cause: error
		});
	}
});
