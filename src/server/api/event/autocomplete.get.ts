import { ensureLoggedIn } from '~/server/utils';
import {
	EventAutocompleteSuggestion,
	type RawEventAutocompleteSuggestion
} from '~/shared/types/event';

export default defineEventHandler(async (event) => {
	await ensureLoggedIn(event);

	const config = useRuntimeConfig();
	const { input, latitude, longitude } = getQuery(event);

	if (!input || typeof input !== 'string' || input.trim() === '') {
		throw createError({
			statusCode: 400,
			statusMessage: 'Input parameter is required and must be a non-empty string'
		});
	}

	if (latitude && typeof latitude !== 'number') {
		throw createError({
			statusCode: 400,
			statusMessage: 'Latitude parameter must be a number'
		});
	}

	if (longitude && typeof longitude !== 'number') {
		throw createError({
			statusCode: 400,
			statusMessage: 'Longitude parameter must be a number'
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
			locationBias: {
				circle: {
					latitude: latitude || 0,
					longitude: longitude || 0,
					radiusMeters: 50000
				}
			}
		},
		headers: {
			'Content-Type': 'application/json',
			'X-Goog-Api-Key': config.mapsApiKey
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
			distance_meters: data.distanceMeters
		} satisfies EventAutocompleteSuggestion;
	});
});
