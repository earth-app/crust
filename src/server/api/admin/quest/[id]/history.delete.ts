import { cloudErrorMessage, ensureAdministrator } from '~/server/utils';

// admin deletes ALL completed quests from a user's history via cloud.
export default defineEventHandler(async (event) => {
	await ensureAdministrator(event);
	const config = useRuntimeConfig();

	const id = getRouterParam(event, 'id');
	if (!id) {
		throw createError({ statusCode: 400, statusMessage: 'Bad Request: Missing user id' });
	}

	await $fetch(`${config.public.cloudBaseUrl}/v1/users/quests/history/${id}`, {
		method: 'DELETE',
		timeout: 20_000,
		headers: {
			Authorization: `Bearer ${config.adminApiKey}`,
			Accept: 'application/json'
		},
		onResponseError: (ctx) => {
			const message = cloudErrorMessage(ctx.response._data);
			throw createError({
				data: ctx.response._data,
				statusCode: ctx.response.status,
				statusMessage: message || `Failed to delete quest history: ${ctx.response.statusText}`
			});
		}
	});

	return { success: true };
});
