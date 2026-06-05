import { ensureLoggedIn } from '~/server/utils';

// google places "autocomplete" proxy. user input is trimmed + length-capped before going upstream
// to avoid wasting quota on accidental long pastes, and an empty result is returned as a 200 instead
// of bubbling a 4xx so the client never has to special-case "no matches" via error handling.
const MAX_INPUT_LENGTH = 120;
const MAX_SUGGESTIONS = 8;

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

	if (!input || typeof input !== 'string') {
		throw createError({
			statusCode: 400,
			statusMessage: 'Input parameter is required'
		});
	}

	const cleanInput = input.trim().slice(0, MAX_INPUT_LENGTH);
	if (cleanInput.length === 0) return [];

	// lat/lng are optional bias — when absent we still query, just without locationBias
	const latNum = latitude !== undefined ? Number(latitude) : NaN;
	const lngNum = longitude !== undefined ? Number(longitude) : NaN;
	const hasBias =
		Number.isFinite(latNum) &&
		Number.isFinite(lngNum) &&
		latNum >= -90 &&
		latNum <= 90 &&
		lngNum >= -180 &&
		lngNum <= 180;

	let res:
		| {
				suggestions?: (
					| { placePrediction: RawEventAutocompleteSuggestion }
					| { queryPrediction: RawEventAutocompleteSuggestion }
				)[];
		  }
		| undefined;

	try {
		res = await $fetch('https://places.googleapis.com/v1/places:autocomplete', {
			method: 'POST',
			body: {
				input: cleanInput,
				includeQueryPredictions: true,
				sessionToken,
				...(hasBias
					? {
							locationBias: {
								circle: {
									center: { latitude: latNum, longitude: lngNum },
									radius: 50000
								}
							}
						}
					: {})
			},
			headers: {
				'Content-Type': 'application/json',
				'X-Goog-Api-Key': config.mapsApiKey
			},
			timeout: 8000
		});
	} catch (err) {
		// upstream blip — return empty so the client shows "no matches" rather than a generic 500
		console.warn('places autocomplete upstream failed:', err instanceof Error ? err.message : err);
		return [];
	}

	const suggestions = Array.isArray(res?.suggestions) ? res.suggestions : [];
	const out: EventAutocompleteSuggestion[] = [];

	for (const suggestion of suggestions) {
		const data =
			'placePrediction' in suggestion
				? suggestion.placePrediction
				: 'queryPrediction' in suggestion
					? suggestion.queryPrediction
					: null;
		if (!data || !data.text?.text) continue;

		out.push({
			name: data.structuredFormat?.mainText?.text || data.text.text,
			full_name: data.text.text,
			place_id: data.placeId,
			address: data.structuredFormat?.secondaryText?.text,
			distance_meters: data.distanceMeters,
			types: data.types || []
		} satisfies EventAutocompleteSuggestion);

		if (out.length >= MAX_SUGGESTIONS) break;
	}

	return out;
});
