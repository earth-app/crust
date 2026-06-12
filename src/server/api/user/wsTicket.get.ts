export default defineEventHandler(async (event) => {
	const { id } = getQuery(event);
	if (!id || typeof id !== 'string' || !/^\d+$/.test(id)) {
		throw createError({ statusCode: 400, statusMessage: 'A valid user id is required' });
	}

	const auth = getHeader(event, 'authorization');
	if (!auth) {
		throw createError({ statusCode: 401, statusMessage: 'Missing authorization' });
	}

	const config = useRuntimeConfig();
	const cloudBase = config.public.cloudBaseUrl;

	try {
		const res = await $fetch<{ ticket: string }>(`${cloudBase}/ws/users/${id}/ticket`, {
			headers: { Authorization: auth },
			timeout: 10000
		});

		const wsBase = cloudBase.replace(/^http/, 'ws');
		return { ticket: res.ticket, url: `${wsBase}/ws/users/${id}/notifications` };
	} catch (error) {
		throw createError({
			statusCode: 502,
			statusMessage: `Failed to issue websocket ticket: ${
				error instanceof Error ? error.message : 'unknown error'
			}`
		});
	}
});
