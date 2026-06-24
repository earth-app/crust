import { cloudErrorMessage, ensureAdministrator } from '~/server/utils';

// admin rescinds impact points from a user (e.g. clawing back quest rewards) via cloud.
export default defineEventHandler(async (event) => {
	await ensureAdministrator(event);
	const config = useRuntimeConfig();

	const id = getRouterParam(event, 'id');
	if (!id) {
		throw createError({ statusCode: 400, statusMessage: 'Bad Request: Missing user id' });
	}

	const body = await readBody<{ points: number; reason?: string }>(event);
	if (typeof body?.points !== 'number' || !Number.isFinite(body.points) || body.points <= 0) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Bad Request: points must be a positive number'
		});
	}

	const reason = (body.reason ?? '').toString().slice(0, 200) || 'Quest points rescinded';

	const res = await $fetch<{ points: number; history: unknown[] }>(
		`${config.public.cloudBaseUrl}/v1/users/impact_points/${id}/remove`,
		{
			method: 'POST',
			timeout: 15_000,
			headers: {
				Authorization: `Bearer ${config.adminApiKey}`,
				Accept: 'application/json'
			},
			body: { points: body.points, reason },
			onResponseError: (ctx) => {
				const message = cloudErrorMessage(ctx.response._data);
				throw createError({
					data: ctx.response._data,
					statusCode: ctx.response.status,
					statusMessage: message || `Failed to rescind points: ${ctx.response.statusText}`
				});
			}
		}
	);
	return res;
});
