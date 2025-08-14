import { ensureAdministrator } from '../../utils';

export default defineEventHandler(async (event) => {
	await ensureAdministrator(event);

	const config = useRuntimeConfig();
	const { id } = getQuery(event);

	if (!id) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Activity ID is required'
		});
	}

	try {
		const response = await $fetch(`${config.public.cloudBaseUrl}/v1/activity/${id}`, {
			headers: {
				Authorization: `Bearer ${config.adminApiKey}`,
				'Content-Type': 'application/json'
			}
		});

		return response;
	} catch (error) {
		throw createError({
			statusCode: 500,
			statusMessage: `Failed to get activity draft: ${error instanceof Error ? error.message : 'Unknown error'}`
		});
	}
});
