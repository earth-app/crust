export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig();
	const { id, metadata } = getQuery(event);

	if (!id || typeof id !== 'string' || id.trim() === '') {
		throw createError({
			statusCode: 400,
			statusMessage: 'ID parameter is required and must be a non-empty string'
		});
	}

	if (metadata === 'true') {
		const res = await $fetch(`${config.public.cloudBaseUrl}/v1/events/thumbnail/${id}/metadata`, {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${config.adminApiKey}`
			},
			timeout: 10000,
			onResponseError: (ctx) => {
				throw createError({
					data: ctx.response._data,
					statusCode: ctx.response.status,
					statusMessage: `Failed to fetch event thumbnail metadata: ${ctx.response.statusText}`
				});
			}
		});

		return res;
	}

	const res = await $fetch<Blob>(`${config.public.cloudBaseUrl}/v1/events/thumbnail/${id}`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${config.adminApiKey}`
		},
		responseType: 'blob',
		timeout: 10000,
		onResponseError: (ctx) => {
			throw createError({
				data: ctx.response._data,
				statusCode: ctx.response.status,
				statusMessage: `Failed to fetch event thumbnail: ${ctx.response.statusText}`
			});
		}
	});

	if (res.type !== 'image/webp') {
		throw createError({
			statusCode: 500,
			statusMessage: `Unexpected thumbnail content type: ${res.type}; expected image/webp`
		});
	}

	event.node.res.setHeader('Content-Type', 'image/webp');
	event.node.res.setHeader('Content-Length', res.size.toString());
	event.node.res.setHeader('Content-Disposition', `inline; filename="event_${id}_thumbnail.webp"`);
	event.node.res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
	return res;
});
