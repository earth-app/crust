const CODE_REGEX = /^[0-9A-HJKMNP-TV-Z]{6}$/;

export default defineEventHandler(async (event) => {
	const body = await readBody<{ code?: string }>(event).catch(() => ({}) as { code?: string });
	const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';

	if (!code || !CODE_REGEX.test(code)) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Invalid or missing referral code'
		});
	}

	const config = useRuntimeConfig();

	try {
		const response = await $fetch<{ ok: boolean }>(
			`${config.public.cloudBaseUrl}/v1/users/referral/click`,
			{
				headers: {
					Authorization: `Bearer ${config.adminApiKey}`,
					Accept: 'application/json',
					'Cache-Control': 'no-cache'
				},
				method: 'POST',
				body: { code },
				timeout: 10000
			}
		);

		return response;
	} catch (error) {
		throw createError({
			statusCode: 500,
			statusMessage: `Failed to record referral click: ${
				error instanceof Error ? error.message : 'Unknown error'
			}`,
			cause: error
		});
	}
});
