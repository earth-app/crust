import { ensureLoggedIn, parseUserAgent } from '~/server/utils';

export default defineEventHandler(async (event) => {
	const user = await ensureLoggedIn(event);
	const config = useRuntimeConfig();

	const rank = user.account.account_type.toLowerCase();

	const ua = event.node.req.headers['user-agent'];
	if (!ua) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Bad Request: Missing User-Agent header'
		});
	}

	const latitude = parseFloat(event.node.req.headers['X-Latitude']?.toString() || '0');
	const longitude = parseFloat(event.node.req.headers['X-Longitude']?.toString() || '0');

	const device = {
		latitude,
		longitude,
		...parseUserAgent(ua)
	};

	if (isNaN(latitude) || isNaN(longitude)) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Bad Request: Invalid latitude or longitude headers'
		});
	}

	const response = await readBody<{
		type: string;
		index: number;
		altIndex?: number;
		dataUrl?: string;
		[x: string]: any;
	}>(event);

	if (
		!response.type ||
		typeof response.index !== 'number' ||
		response.index < 0 ||
		(response.altIndex && (typeof response.altIndex !== 'number' || response.altIndex < 0))
	) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Bad Request: Missing or invalid type/index/altIndex in request body'
		});
	}

	// validate dataUrl if present
	if (response.dataUrl) {
		if (typeof response.dataUrl !== 'string' || !response.dataUrl.startsWith('data:')) {
			throw createError({
				statusCode: 400,
				statusMessage: 'Bad Request: dataUrl must be a valid data URL string'
			});
		}
	}

	const res = await $fetch<{ message: string; completed: boolean; validated: boolean }>(
		`${config.public.cloudBaseUrl}/v1/users/quests/progress/${user.id}`,
		{
			method: 'PATCH',
			headers: {
				Authorization: `Bearer ${config.adminApiKey}`,
				Accept: 'application/json'
			},
			body: {
				device,
				response,
				rank
			},
			onResponseError: (ctx) => {
				throw createError({
					data: ctx.response._data,
					statusCode: ctx.response.status,
					statusMessage: `Failed to update quest: ${ctx.response.statusText}`
				});
			}
		}
	);
	return res;
});
