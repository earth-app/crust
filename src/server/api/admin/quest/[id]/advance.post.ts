import { cloudErrorMessage, ensureAdministrator } from '~/server/utils';

// admin spoofs the target user to advance one quest step via cloud's update endpoint.
// device os=web/model=api exempts mobile checks; rank=administrator waives the step delay.
export default defineEventHandler(async (event) => {
	await ensureAdministrator(event);
	const config = useRuntimeConfig();

	const id = getRouterParam(event, 'id');
	if (!id) {
		throw createError({ statusCode: 400, statusMessage: 'Bad Request: Missing user id' });
	}

	const body = await readBody<{
		response: {
			type: string;
			index: number;
			altIndex?: number;
			dataUrl?: string;
			[x: string]: any;
		};
		latitude?: number;
		longitude?: number;
	}>(event);

	const response = body?.response;
	if (
		!response ||
		!response.type ||
		typeof response.index !== 'number' ||
		response.index < 0 ||
		(response.altIndex !== undefined &&
			(typeof response.altIndex !== 'number' || response.altIndex < 0))
	) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Bad Request: Missing or invalid response type/index/altIndex'
		});
	}

	if (
		response.dataUrl &&
		(typeof response.dataUrl !== 'string' || !response.dataUrl.startsWith('data:'))
	) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Bad Request: dataUrl must be a valid data URL string'
		});
	}

	const device = {
		latitude: typeof body.latitude === 'number' ? body.latitude : 0,
		longitude: typeof body.longitude === 'number' ? body.longitude : 0,
		make: 'unknown',
		model: 'api',
		os: 'web',
		version: 'admin'
	};

	const res = await $fetch<{ message: string; completed: boolean; validated: boolean }>(
		`${config.public.cloudBaseUrl}/v1/users/quests/progress/${id}/update`,
		{
			method: 'PATCH',
			timeout: 20_000,
			headers: {
				Authorization: `Bearer ${config.adminApiKey}`,
				Accept: 'application/json'
			},
			body: {
				device,
				response,
				rank: 'administrator'
			},
			onResponseError: (ctx) => {
				const message = cloudErrorMessage(ctx.response._data);
				throw createError({
					data: ctx.response._data,
					statusCode: ctx.response.status,
					statusMessage: message || `Failed to advance quest step: ${ctx.response.statusText}`
				});
			}
		}
	);
	return res;
});
