import { ensureLoggedIn } from '~/server/utils';

const MAX_INPUT_LENGTH = 120;
const MIN_INPUT_LENGTH = 2;
const MAX_SUGGESTIONS = 8;
const BIAS_RADIUS_METERS = 50_000; // max allowed for locationBias.circle per Places v1 docs

type Prediction = {
	place?: string;
	placeId?: string;
	text?: { text?: string };
	structuredFormat?: {
		mainText?: { text?: string };
		secondaryText?: { text?: string };
	};
	types?: string[];
	distanceMeters?: number;
};

type AutocompleteResponse = {
	suggestions?: ({ placePrediction?: Prediction } | { queryPrediction?: Prediction })[];
};

function buildBody(
	input: string,
	sessionToken: string,
	bias: { lat: number; lng: number } | null
): Record<string, unknown> {
	const body: Record<string, unknown> = {
		input,
		includeQueryPredictions: true,
		sessionToken,
		// without these, the response can vary based on Worker region — pin to English + US so
		// results match the bias circle's center for most users
		languageCode: 'en',
		regionCode: 'US'
	};
	if (bias) {
		body.locationBias = {
			circle: {
				center: { latitude: bias.lat, longitude: bias.lng },
				radius: BIAS_RADIUS_METERS
			}
		};
	}
	return body;
}

async function callPlacesAutocomplete(
	apiKey: string,
	input: string,
	sessionToken: string,
	bias: { lat: number; lng: number } | null
): Promise<AutocompleteResponse> {
	try {
		return await $fetch<AutocompleteResponse>(
			'https://places.googleapis.com/v1/places:autocomplete',
			{
				method: 'POST',
				body: buildBody(input, sessionToken, bias),
				headers: {
					'Content-Type': 'application/json',
					'X-Goog-Api-Key': apiKey
				},
				timeout: 8000
			}
		);
	} catch (err: any) {
		// surface upstream status + body for ops triage — `[]` will still go to the client below
		const status = err?.response?.status ?? err?.statusCode ?? 'unknown';
		const body = err?.data ?? err?.response?._data ?? null;
		console.warn(
			`[places autocomplete] upstream ${status} for input="${input.slice(0, 40)}":`,
			body ?? (err instanceof Error ? err.message : err)
		);
		return {};
	}
}

function pickPrediction(
	suggestion: { placePrediction?: Prediction } | { queryPrediction?: Prediction } | null | undefined
): Prediction | null {
	if (!suggestion || typeof suggestion !== 'object') return null;
	const place = (suggestion as { placePrediction?: Prediction }).placePrediction;
	if (place && typeof place === 'object') return place;
	const query = (suggestion as { queryPrediction?: Prediction }).queryPrediction;
	if (query && typeof query === 'object') return query;
	return null;
}

function toSuggestions(res: AutocompleteResponse): EventAutocompleteSuggestion[] {
	const suggestions = Array.isArray(res?.suggestions) ? res.suggestions : [];
	const out: EventAutocompleteSuggestion[] = [];
	for (const suggestion of suggestions) {
		const data = pickPrediction(suggestion);
		if (!data) continue;
		const fullName = data.text?.text;
		if (!fullName) continue;

		// Places v1 returns `place: "places/{id}"` and `placeId` for placePrediction; queryPrediction
		// has neither. fall through cleanly so the client sees just the searchable text.
		const placeId = data.placeId ?? data.place?.split('/').pop();

		out.push({
			name: data.structuredFormat?.mainText?.text || fullName,
			full_name: fullName,
			place_id: placeId,
			address: data.structuredFormat?.secondaryText?.text,
			distance_meters: data.distanceMeters,
			types: Array.isArray(data.types) ? data.types : []
		} satisfies EventAutocompleteSuggestion);

		if (out.length >= MAX_SUGGESTIONS) break;
	}
	return out;
}

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
	// require minimum of 2 characters
	if (cleanInput.length < MIN_INPUT_LENGTH) return [];

	const latNum = latitude !== undefined ? Number(latitude) : NaN;
	const lngNum = longitude !== undefined ? Number(longitude) : NaN;
	const hasBias =
		Number.isFinite(latNum) &&
		Number.isFinite(lngNum) &&
		latNum >= -90 &&
		latNum <= 90 &&
		lngNum >= -180 &&
		lngNum <= 180;

	const bias = hasBias ? { lat: latNum, lng: lngNum } : null;
	const apiKey = config.mapsApiKey;

	if (!apiKey) {
		console.warn('[places autocomplete] mapsApiKey is not configured — returning empty');
		return [];
	}

	const first = await callPlacesAutocomplete(apiKey, cleanInput, sessionToken, bias);
	let suggestions = toSuggestions(first);

	// if a biased query found nothing, retry without bias before giving up
	if (suggestions.length === 0 && bias) {
		const second = await callPlacesAutocomplete(apiKey, cleanInput, sessionToken, null);
		suggestions = toSuggestions(second);
	}

	return suggestions;
});
