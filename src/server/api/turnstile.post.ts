export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig();
	const secretKey = config.turnstile.secretKey;

	if (!secretKey || secretKey.trim() === '') {
		// assume in dev mode if no secret key is set
		return { success: true, message: 'Turnstile verification skipped, no secret key configured' };
	}

	const body = await readBody<{ token?: string }>(event);
	const { token } = body || {};
	if (!token) return { success: false, message: 'Missing or invalid "token" in request body.' };

	return await verifyTurnstileToken(token);
});
