import { cloudErrorMessage, ensureAdministrator } from '~/server/utils';

export default defineEventHandler(async (event) => {
	await ensureAdministrator(event);

	const config = useRuntimeConfig();
	const body = await readBody<{ dry_run?: boolean; limit?: number }>(event).catch(() => ({
		dry_run: true, // default to dry run if body is not valid JSON
		limit: 10
	}));

	if (body?.limit && (body.limit < 1 || body.limit > 100)) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Limit must be between 1 and 100'
		});
	}

	// the caller's session authenticates this hop; the outbound hop uses the server secret
	return await $fetch<{ considered: number; funnel: Record<string, unknown> }>(
		`${config.public.cloudBaseUrl}/v1/admin/activities/discover`,
		{
			method: 'POST',
			timeout: 60_000,
			headers: {
				Authorization: `Bearer ${config.adminApiKey}`,
				Accept: 'application/json'
			},
			body: {
				dry_run: body?.dry_run !== false,
				...(body?.limit ? { limit: body.limit } : {})
			},
			onResponseError: (ctx) => {
				const message = cloudErrorMessage(ctx.response._data);
				throw createError({
					data: ctx.response._data,
					statusCode: ctx.response.status,
					statusMessage: message || `Failed to run activity discovery: ${ctx.response.statusText}`
				});
			}
		}
	);
});
