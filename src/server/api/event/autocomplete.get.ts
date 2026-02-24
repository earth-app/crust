import { ensureLoggedIn } from '~/server/utils';

export default defineEventHandler(async (event) => {
	await ensureLoggedIn(event);

	const config = useRuntimeConfig();
	const { input, latitude, longitude, sessionToken } = getQuery(event);

	if (!sessionToken || typeof sessionToken !== 'string' || sessionToken.trim() === '') {
		throw createError({
			statusCode: 400,
			statusMessage: 'SessionToken parameter is required and must be a non-empty string'
		});
	}

	if (!input || typeof input !== 'string' || input.trim() === '') {
		throw createError({
			statusCode: 400,
			statusMessage: 'Input parameter is required and must be a non-empty string'
		});
	}

	if (!latitude || isNaN(Number(latitude))) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Latitude parameter is required and must be a valid number'
		});
	}

	if (!longitude || isNaN(Number(longitude))) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Longitude parameter is required and must be a valid number'
		});
	}

	const res = await $fetch<{
		suggestions: (
			| { placePrediction: RawEventAutocompleteSuggestion }
			| { queryPrediction: RawEventAutocompleteSuggestion }
		)[];
	}>('https://places.googleapis.com/v1/places:autocomplete', {
		method: 'POST',
		body: {
			input: input.trim(),
			includeQueryPredictions: true,
			sessionToken,
			locationBias: {
				circle: {
					center: {
						latitude: Number(latitude) || 0,
						longitude: Number(longitude) || 0
					},
					radius: 50000
				}
			}
		},
		headers: {
			'Content-Type': 'application/json',
			'X-Goog-Api-Key': config.mapsApiKey
		},
		onResponseError: (ctx) => {
			throw createError({
				data: ctx.response._data,
				statusCode: ctx.response.status,
				statusMessage: `Places API autocomplete request failed with status ${ctx.response.status}`
			});
		}
	});

	return res.suggestions.map((suggestion) => {
		const data =
			'placePrediction' in suggestion
				? suggestion.placePrediction
				: 'queryPrediction' in suggestion
					? suggestion.queryPrediction
					: null;

		if (!data) {
			throw createError({
				statusCode: 500,
				statusMessage: 'Invalid suggestion data from Places API'
			});
		}

		return {
			name: data.structuredFormat?.mainText.text || data.text.text,
			full_name: data.text.text,
			place_id: data.placeId,
			address: data.structuredFormat?.secondaryText?.text,
			distance_meters: data.distanceMeters,
			types: data.types || []
		} satisfies EventAutocompleteSuggestion;
	});
});
