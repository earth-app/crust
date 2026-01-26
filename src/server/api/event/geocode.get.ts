import { ensureLoggedIn } from '~/server/utils';

export default defineEventHandler(async (event) => {
	await ensureLoggedIn(event);

	const config = useRuntimeConfig();
	const { address, lat, lng } = getQuery(event);

	if (address) {
		// normal geocoding

		if (typeof address !== 'string' || address.trim() === '') {
			throw createError({
				statusCode: 400,
				statusMessage: 'Address parameter is required and must be a non-empty string'
			});
		}

		try {
			const res = await $fetch<{
				results: {
					geometry: {
						location: {
							lat: number;
							lng: number;
						};
					};
				}[];
			}>('https://maps.googleapis.com/maps/api/geocode/json', {
				method: 'GET',
				query: {
					address: address.trim(),
					key: config.mapsApiKey
				}
			});

			if (res.results.length === 0) {
				throw createError({
					statusCode: 404,
					statusMessage: 'No geocoding results found for the provided address'
				});
			}

			const location = res.results[0].geometry.location;

			return {
				latitude: location.lat,
				longitude: location.lng
			};
		} catch (error) {
			throw createError({
				statusCode: 500,
				statusMessage: `Failed to geocode address: ${
					error instanceof Error ? error.message : 'Unknown error'
				}`,
				cause: error
			});
		}
	} else if (lat && lng) {
		// reverse geocoding

		if (isNaN(Number(lat))) {
			throw createError({
				statusCode: 400,
				statusMessage: 'Latitude parameter must be a valid number'
			});
		}

		if (isNaN(Number(lng))) {
			throw createError({
				statusCode: 400,
				statusMessage: 'Longitude parameter must be a valid number'
			});
		}

		try {
			const res = await $fetch<{
				results: {
					formatted_address: string;
				}[];
			}>('https://maps.googleapis.com/maps/api/geocode/json', {
				method: 'GET',
				query: {
					latlng: `${Number(lat)},${Number(lng)}`,
					key: config.mapsApiKey
				}
			});

			if (res.results.length === 0) {
				throw createError({
					statusCode: 404,
					statusMessage: 'No reverse geocoding results found for the provided coordinates'
				});
			}

			return {
				address: res.results[0].formatted_address
			};
		} catch (error) {
			throw createError({
				statusCode: 500,
				statusMessage: `Failed to reverse geocode coordinates: ${
					error instanceof Error ? error.message : 'Unknown error'
				}`,
				cause: error
			});
		}
	} else {
		throw createError({
			statusCode: 400,
			statusMessage:
				'Either address (geocode) or both lat and lng (reverse geocode) parameters are required'
		});
	}
});
