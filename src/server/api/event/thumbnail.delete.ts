export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig();
	const { id } = getQuery(event);

	if (!id || typeof id !== 'string' || id.trim() === '') {
		throw createError({
			statusCode: 400,
			statusMessage: 'ID parameter is required and must be a non-empty string'
		});
	}

	const res = await $fetch(`${config.public.cloudBaseUrl}/v1/events/thumbnail/${id}`, {
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${config.adminApiKey}`
		},
		timeout: 10000,
		onResponseError: (ctx) => {
			throw createError({
				data: ctx.response._data,
				statusCode: ctx.response.status,
				statusMessage: `Failed to delete event thumbnail: ${ctx.response.statusText}`
			});
		}
	});

	return res;
});
