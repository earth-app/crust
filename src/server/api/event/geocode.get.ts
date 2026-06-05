import { ensureLoggedIn } from '~/server/utils';

const REQUEST_TIMEOUT_MS = 8000;

type GeocodeStatus =
	| 'OK'
	| 'ZERO_RESULTS'
	| 'OVER_DAILY_LIMIT'
	| 'OVER_QUERY_LIMIT'
	| 'REQUEST_DENIED'
	| 'INVALID_REQUEST'
	| 'UNKNOWN_ERROR';

type ForwardGeocodeResponse = {
	status: GeocodeStatus;
	error_message?: string;
	results: {
		geometry?: { location?: { lat: number; lng: number } };
	}[];
};

type ReverseGeocodeResponse = {
	status: GeocodeStatus;
	error_message?: string;
	results: { formatted_address: string }[];
};

function logUpstream(label: string, status: GeocodeStatus, errMsg?: string): void {
	if (status === 'OK' || status === 'ZERO_RESULTS') return;
	console.warn(`[geocode] ${label} returned ${status}${errMsg ? `: ${errMsg}` : ''}`);
}

export default defineEventHandler(async (event) => {
	await ensureLoggedIn(event);

	const config = useRuntimeConfig();
	const { address, lat, lng } = getQuery(event);

	if (!config.mapsApiKey) {
		throw createError({
			statusCode: 500,
			statusMessage: 'Geocoding service is not configured'
		});
	}

	if (address) {
		if (typeof address !== 'string' || address.trim() === '') {
			throw createError({
				statusCode: 400,
				statusMessage: 'Address parameter is required and must be a non-empty string'
			});
		}

		let res: ForwardGeocodeResponse;
		try {
			res = await $fetch<ForwardGeocodeResponse>(
				'https://maps.googleapis.com/maps/api/geocode/json',
				{
					method: 'GET',
					query: {
						address: address.trim().slice(0, 256),
						key: config.mapsApiKey
					},
					timeout: REQUEST_TIMEOUT_MS
				}
			);
		} catch (error: any) {
			const upstreamStatus = error?.response?.status ?? error?.statusCode ?? 'unknown';
			console.warn(`[geocode] forward upstream failure (${upstreamStatus}):`, error?.data ?? error);
			throw createError({
				statusCode: 502,
				statusMessage: 'Geocoding upstream is currently unavailable'
			});
		}

		logUpstream('forward', res.status, res.error_message);

		if (res.status === 'ZERO_RESULTS' || !res.results.length) {
			throw createError({
				statusCode: 404,
				statusMessage: 'No geocoding results found for the provided address'
			});
		}

		if (res.status !== 'OK') {
			throw createError({
				statusCode: 502,
				statusMessage: `Geocoding upstream returned ${res.status}`
			});
		}

		const location = res.results[0]?.geometry?.location;
		if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
			throw createError({
				statusCode: 502,
				statusMessage: 'Geocoding upstream returned a malformed result'
			});
		}

		return { latitude: location.lat, longitude: location.lng };
	}

	if (lat && lng) {
		const latNum = Number(lat);
		const lngNum = Number(lng);
		if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
			throw createError({
				statusCode: 400,
				statusMessage: 'Latitude parameter must be a valid number between -90 and 90'
			});
		}
		if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
			throw createError({
				statusCode: 400,
				statusMessage: 'Longitude parameter must be a valid number between -180 and 180'
			});
		}

		let res: ReverseGeocodeResponse;
		try {
			res = await $fetch<ReverseGeocodeResponse>(
				'https://maps.googleapis.com/maps/api/geocode/json',
				{
					method: 'GET',
					query: {
						latlng: `${latNum},${lngNum}`,
						key: config.mapsApiKey
					},
					timeout: REQUEST_TIMEOUT_MS
				}
			);
		} catch (error: any) {
			const upstreamStatus = error?.response?.status ?? error?.statusCode ?? 'unknown';
			console.warn(`[geocode] reverse upstream failure (${upstreamStatus}):`, error?.data ?? error);
			throw createError({
				statusCode: 502,
				statusMessage: 'Geocoding upstream is currently unavailable'
			});
		}

		logUpstream('reverse', res.status, res.error_message);

		if (res.status === 'ZERO_RESULTS' || !res.results.length) {
			throw createError({
				statusCode: 404,
				statusMessage: 'No reverse geocoding results found for the provided coordinates'
			});
		}

		if (res.status !== 'OK') {
			throw createError({
				statusCode: 502,
				statusMessage: `Geocoding upstream returned ${res.status}`
			});
		}

		const first = res.results[0];
		if (!first?.formatted_address) {
			throw createError({
				statusCode: 502,
				statusMessage: 'Geocoding upstream returned a malformed result'
			});
		}

		return { address: first.formatted_address };
	}

	throw createError({
		statusCode: 400,
		statusMessage:
			'Either address (geocode) or both lat and lng (reverse geocode) parameters are required'
	});
});
