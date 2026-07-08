import {
	cloudErrorMessage,
	ensureLoggedIn,
	parseUserAgent,
	resolveAccountRank
} from '~/server/utils';

export default defineEventHandler(async (event) => {
	const user = await ensureLoggedIn(event);
	const config = useRuntimeConfig();

	const rank = resolveAccountRank(user);

	const ua = event.node.req.headers['user-agent'];
	if (!ua) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Bad Request: Missing User-Agent header'
		});
	}

	const latitude = parseFloat(getRequestHeader(event, 'X-Latitude') || '0');
	const longitude = parseFloat(getRequestHeader(event, 'X-Longitude') || '0');

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

	try {
		const res = await $fetch<{ message: string; completed: boolean; validated: boolean }>(
			`${config.public.cloudBaseUrl}/v1/users/quests/progress/${user.id}/update`,
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
					rank
				},
				onResponseError: (ctx) => {
					const message = cloudErrorMessage(ctx.response._data);
					throw createError({
						data: ctx.response._data,
						statusCode: ctx.response.status,
						statusMessage: message || `Failed to update quest: ${ctx.response.statusText}`
					});
				}
			}
		);
		return res;
	} catch (error) {
		if (
			error &&
			typeof error === 'object' &&
			typeof (error as { statusCode?: unknown }).statusCode === 'number'
		) {
			throw error;
		}
		throw createError({
			statusCode: 502,
			statusMessage: 'Quest update failed to reach the quest service'
		});
	}
});
