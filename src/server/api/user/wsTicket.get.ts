export default defineEventHandler(async (event) => {
	const { id } = getQuery(event);
	if (!id || typeof id !== 'string' || !/^\d+$/.test(id)) {
		throw createError({ statusCode: 400, statusMessage: 'A valid user id is required' });
	}

	const auth = getHeader(event, 'authorization');
	// sky posts `Bearer <token>`; an unhydrated token yields a literal
	// "Bearer null"/"Bearer undefined" (truthy) that must not reach cloud
	if (
		!auth ||
		!/^Bearer\s+\S+$/.test(auth) ||
		auth === 'Bearer null' ||
		auth === 'Bearer undefined'
	) {
		throw createError({ statusCode: 401, statusMessage: 'Missing or invalid authorization' });
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
		// propagate cloud's status: a 4xx auth rejection must surface as auth (client
		// re-hydrates), not a masked 502; reserve 502 for real 5xx / network failures
		const status = (error as any)?.response?.status ?? (error as any)?.statusCode;
		if (typeof status === 'number' && status >= 400 && status < 500) {
			throw createError({
				statusCode: status,
				statusMessage: `Rejected websocket ticket request: ${
					error instanceof Error ? error.message : 'unknown error'
				}`
			});
		}

		throw createError({
			statusCode: 502,
			statusMessage: `Failed to issue websocket ticket: ${
				error instanceof Error ? error.message : 'unknown error'
			}`
		});
	}
});
