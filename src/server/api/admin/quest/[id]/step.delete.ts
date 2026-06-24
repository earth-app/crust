import { cloudErrorMessage, ensureAdministrator } from '~/server/utils';

// admin removes a single completed step from the user's ACTIVE quest (timeline-repairing).
// query: step (required), alt (optional), rescind_points (optional bool) -> cloud reset endpoint.
export default defineEventHandler(async (event) => {
	await ensureAdministrator(event);
	const config = useRuntimeConfig();

	const id = getRouterParam(event, 'id');
	if (!id) {
		throw createError({ statusCode: 400, statusMessage: 'Bad Request: Missing user id' });
	}

	const query = getQuery(event);
	const step = parseInt(String(query.step ?? ''), 10);
	if (!Number.isInteger(step) || step < 0) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Bad Request: step must be a non-negative integer'
		});
	}

	const params = new URLSearchParams({ step: String(step) });
	if (query.alt !== undefined && query.alt !== '') {
		const alt = parseInt(String(query.alt), 10);
		if (!Number.isInteger(alt) || alt < 0) {
			throw createError({
				statusCode: 400,
				statusMessage: 'Bad Request: alt must be a non-negative integer'
			});
		}
		params.set('alt', String(alt));
	}
	if (String(query.rescind_points) === 'true') {
		params.set('rescind_points', 'true');
	}

	const res = await $fetch<{ message: string; pointsRescinded: number }>(
		`${config.public.cloudBaseUrl}/v1/users/quests/progress/${id}/reset?${params.toString()}`,
		{
			method: 'DELETE',
			timeout: 15_000,
			headers: {
				Authorization: `Bearer ${config.adminApiKey}`,
				Accept: 'application/json'
			},
			onResponseError: (ctx) => {
				const message = cloudErrorMessage(ctx.response._data);
				throw createError({
					data: ctx.response._data,
					statusCode: ctx.response.status,
					statusMessage: message || `Failed to remove quest step: ${ctx.response.statusText}`
				});
			}
		}
	);
	return res;
});
