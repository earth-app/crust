import type { Event, EventAutocompleteSuggestion, EventData } from '~/shared/types/event';
import type { User } from '~/shared/types/user';
import {
	makeAPIRequest,
	makeClientAPIRequest,
	makeServerRequest,
	paginatedAPIRequest
} from '~/shared/util';

export function useEvents() {
	const getEvents = async (
		page: number = 1,
		limit: number = 50,
		search: string = '',
		upcoming: boolean = true
	) => {
		const res = await makeAPIRequest<{
			items: Event[];
			page: number;
			limit: number;
			total: number;
		}>(
			`events-${page}-${limit}-${search}-${upcoming}`,
			`/v2/events?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`,
			useCurrentSessionToken()
		);
		if (res.success && res.data) {
			if ('message' in res.data) {
				throw new Error(res.data.message);
			}

			if (upcoming) {
				const now = new Date();
				return {
					items: res.data.items.filter((event) => new Date(event.date) >= now),
					total: res.data.total,
					page: res.data.page,
					limit: res.data.limit
				};
			} else {
				return res.data;
			}
		}

		return { items: [], total: 0, page, limit };
	};

	const createEvent = async (eventData: EventData) => {
		const res = await makeClientAPIRequest<Event>('/v2/events', useCurrentSessionToken(), {
			method: 'POST',
			body: eventData
		});

		return res;
	};

	const deleteEvent = async (id: string) => {
		const res = await makeClientAPIRequest<void>(`/v2/events/${id}`, useCurrentSessionToken(), {
			method: 'DELETE'
		});

		return res;
	};

	return {
		getEvents,
		createEvent,
		deleteEvent
	};
}

export function useEvent(id: string) {
	const event = useState<Event | null | undefined>(`event-${id}`, () => undefined);

	const fetch = async () => {
		if (!id || id === '') {
			event.value = null;
			return { success: false, message: 'Invalid event ID' };
		}

		const res = await makeAPIRequest<Event>(
			`event-${id}`,
			`/v2/events/${id}`,
			useCurrentSessionToken()
		);
		if (res.success && res.data) {
			if ('message' in res.data) {
				event.value = null;
				return res;
			}

			event.value = res.data;
		} else {
			event.value = null;
		}

		return res;
	};

	if (event.value === undefined && id && id !== '') {
		fetch();
	}

	const updateEvent = async (updatedEvent: Partial<EventData>) => {
		const res = await makeClientAPIRequest<Event>(`/v2/events/${id}`, useCurrentSessionToken(), {
			method: 'PATCH',
			body: updatedEvent
		});

		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

			event.value = res.data;
		}

		return res;
	};

	const deleteEvent = async () => {
		const res = await makeClientAPIRequest(`/v2/events/${id}`, useCurrentSessionToken(), {
			method: 'DELETE'
		});

		if (res.success) {
			event.value = null;
		}

		return res;
	};

	const attendees = useState<User[] | null>(`event-attendees-${id}`, () => null);
	const fetchAttendees = async () => {
		const res = await paginatedAPIRequest<User>(
			`/v2/events/${id}/attendees`,
			useCurrentSessionToken()
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				attendees.value = null;
				return res;
			}

			attendees.value = res.data;
		} else {
			attendees.value = null;
		}

		return res;
	};

	if (!attendees.value) {
		fetchAttendees();
	}

	const signUpForEvent = async () => {
		const res = await makeClientAPIRequest<{ user: User; event: Event }>(
			`/v2/events/${id}/signup`,
			useCurrentSessionToken(),
			{
				method: 'POST'
			}
		);

		if (res.success && event.value) {
			event.value.is_attending = true;
			event.value.attendee_count += 1;

			if (res.data && !('message' in res.data) && attendees.value) {
				const userData = res.data as { user: User; event: Event };

				if (!attendees.value.some((a) => a.id === userData.user.id)) {
					attendees.value.push(userData.user);
				}
			} else {
				await fetchAttendees();
			}
		}

		return res;
	};

	const leaveEvent = async () => {
		const res = await makeClientAPIRequest<{ user: User; event: Event }>(
			`/v2/events/${id}/leave`,
			useCurrentSessionToken(),
			{
				method: 'POST'
			}
		);

		if (res.success && event.value) {
			event.value.is_attending = false;
			event.value.attendee_count -= 1;

			// Remove the current user from the attendees list for immediate visual update
			if (res.data && !('message' in res.data) && attendees.value) {
				const userData = res.data as { user: User; event: Event };
				attendees.value = attendees.value.filter((a) => a.id !== userData.user.id);
			} else {
				// Refetch attendees to ensure UI is in sync
				await fetchAttendees();
			}
		}

		return res;
	};

	const thumbnail = useState<string | null>(`event-thumbnail-${id}`, () => null);
	const fetchThumbnail = async () => {
		const res = await makeServerRequest<Blob>(
			`event-thumbnail-${id}`,
			`/api/event/thumbnail?id=${encodeURIComponent(id)}`,
			useCurrentSessionToken()
		);

		if (res.success && res.data) {
			const url = URL.createObjectURL(res.data);
			thumbnail.value = url;
		} else {
			thumbnail.value = null;
		}

		return res;
	};

	if (!thumbnail.value) {
		fetchThumbnail();
	}

	const thumbnailAuthor = useState<string | null>(`event-thumbnail-author-${id}`, () => null);
	const thumbnailSize = useState<number | null>(`event-thumbnail-size-${id}`, () => null);

	const fetchThumbnailMetadata = async () => {
		const res = await makeServerRequest<{ author: string; size: number }>(
			`event-thumbnail-metadata-${id}`,
			`/api/event/thumbnail?id=${encodeURIComponent(id)}&metadata=true`,
			useCurrentSessionToken()
		);

		if (res.success && res.data) {
			const author =
				res.data.author === '<user>' ? event.value?.host.full_name || 'Host' : res.data.author;
			thumbnailAuthor.value = author;

			thumbnailSize.value = res.data.size;
		} else {
			thumbnailAuthor.value = null;
			thumbnailSize.value = null;
		}

		return res;
	};

	if (!thumbnailAuthor.value || !thumbnailSize.value) {
		fetchThumbnailMetadata();
	}

	const uploadThumbnail = async (file: File) => {
		const formData = new FormData();
		formData.append('photo', file);

		const res = await makeServerRequest(
			`event-thumbnail-upload-${id}`,
			`/api/event/thumbnail?id=${encodeURIComponent(id)}`,
			useCurrentSessionToken(),
			{
				method: 'POST',
				body: formData
			}
		);

		if (res.success) {
			await fetchThumbnail();
		}

		return res;
	};

	const generateThumbnail = async () => {
		if (!event.value) {
			await fetch();
		}

		const res = await makeServerRequest<Blob>(
			`event-thumbnail-generate-${id}`,
			`/api/event/thumbnail?id=${id}&name=${encodeURIComponent(event.value?.name ?? '')}&generate=true`,
			useCurrentSessionToken(),
			{
				method: 'POST'
			}
		);

		if (res.success && res.data) {
			const url = URL.createObjectURL(res.data);
			thumbnail.value = url;
		}

		return res;
	};

	const deleteThumbnail = async () => {
		const res = await makeServerRequest(
			`event-thumbnail-delete-${id}`,
			`/api/event/thumbnail?id=${encodeURIComponent(id)}`,
			useCurrentSessionToken(),
			{
				method: 'DELETE'
			}
		);

		if (res.success) {
			if (thumbnail.value) {
				URL.revokeObjectURL(thumbnail.value);
				thumbnail.value = null;
			}
		}

		return res;
	};

	const unloadThumbnail = () => {
		if (thumbnail.value) {
			URL.revokeObjectURL(thumbnail.value);
			thumbnail.value = null;
		}
	};

	const cancelEvent = async () => {
		const res = await makeClientAPIRequest<Event>(
			`/v2/events/${id}/cancel`,
			useCurrentSessionToken(),
			{
				method: 'POST'
			}
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

			event.value = res.data;
		} else {
			return res;
		}

		return res;
	};

	const uncancelEvent = async () => {
		const res = await makeClientAPIRequest<Event>(
			`/v2/events/${id}/uncancel`,
			useCurrentSessionToken(),
			{
				method: 'POST'
			}
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

			event.value = res.data;
		} else {
			return res;
		}

		return res;
	};

	return {
		event,
		fetch,
		updateEvent,
		deleteEvent,
		attendees,
		fetchAttendees,
		signUpForEvent,
		leaveEvent,
		thumbnail,
		fetchThumbnail,
		uploadThumbnail,
		generateThumbnail,
		deleteThumbnail,
		unloadThumbnail,
		thumbnailAuthor,
		thumbnailSize,
		fetchThumbnailMetadata,
		cancelEvent,
		uncancelEvent
	};
}

export async function getRandomEvents(count: number = 5) {
	const res = await makeClientAPIRequest<Event[]>(
		`/v2/events/random?count=${count}`,
		useCurrentSessionToken()
	);

	if (res.success && res.data) {
		if ('message' in res.data) {
			return res;
		}

		// load individual events into state
		for (const event of res.data) {
			useState<Event | null>(`event-${event.id}`, () => event);
		}
	}

	return res;
}

export async function getRecentEvents(count: number = 5) {
	const res = await makeClientAPIRequest<{ items: Event[] }>(
		`/v2/events?sort=desc&limit=${count}`,
		useCurrentSessionToken()
	);

	if (res.success && res.data) {
		if ('message' in res.data) {
			return res;
		}

		// load individual events into state
		for (const event of res.data.items) {
			useState<Event | null>(`event-${event.id}`, () => event);
		}
	}

	return res;
}

export async function getRecommendedEvents(count: number = 5) {
	const { user } = useAuth();
	if (!user.value) {
		const res = await useCurrentUser();
		if (!res.success || !res.data || 'message' in res.data) {
			return {
				success: false,
				message: 'User must be logged in to get recommended events.'
			};
		}

		user.value = res.data;
	}

	const pool = await getRandomEvents(Math.min(count * 3, 15)).then((res) =>
		res.success ? res.data : res.message
	);

	const res = await makeServerRequest<Event[]>(
		`user-${user.value.id}-event_recommendations`,
		`/api/event/recommend`,
		useCurrentSessionToken(),
		{
			method: 'POST',
			body: { user, count, pool }
		}
	);

	if (res.success && res.data) {
		if ('message' in res.data) {
			return res;
		}

		// load recommended events into state
		for (const recommendedEvent of res.data) {
			useState<Event | null>(`event-${recommendedEvent.id}`, () => recommendedEvent);
		}
	}

	return res;
}

export async function getSimilarEvents(event: Event, count: number = 5) {
	const pool = await getRandomEvents(Math.min(count * 3, 15)).then((res) =>
		res.success ? res.data : res.message
	);

	if (!pool || typeof pool === 'string') {
		throw new Error(`Failed to fetch random events: ${pool}`);
	}

	if ('message' in pool) {
		throw new Error(`Failed to fetch random events: ${pool.code} ${pool.message}`);
	}

	if (!pool || pool.length === 0) {
		return { success: true, data: [] };
	}

	const res = await makeServerRequest<Event[]>(
		`event-${event.id}-similar_events`,
		`/api/event/similar`,
		useCurrentSessionToken(),
		{
			method: 'POST',
			body: { event, count, pool }
		}
	);

	if (res.success && res.data) {
		if ('message' in res.data) {
			return res;
		}

		// load similar events into state
		for (const similarEvent of res.data) {
			useState<Event | null>(`event-${similarEvent.id}`, () => similarEvent);
		}
	}

	return res;
}

export function useGeocoding() {
	const latitude = useState<number | null>('user-latitude', () => null);
	const longitude = useState<number | null>('user-longitude', () => null);

	const retrieveLocation = () => {
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					latitude.value = position.coords.latitude;
					longitude.value = position.coords.longitude;
				},
				(error) => {
					console.error('Error retrieving location:', error);
				}
			);
		}
	};

	if (latitude.value === null || longitude.value === null) {
		retrieveLocation();
	}

	const autocomplete = async (input: string, sessionToken: string) => {
		const res = await makeServerRequest<EventAutocompleteSuggestion[]>(
			`event-autocomplete-${input}-${latitude.value ?? 'null'}-${longitude.value ?? 'null'}`,
			`/api/event/autocomplete?input=${encodeURIComponent(
				input
			)}&sessionToken=${encodeURIComponent(sessionToken)}${
				latitude.value !== null && longitude.value !== null
					? `&latitude=${latitude.value}&longitude=${longitude.value}`
					: ''
			}`,
			useCurrentSessionToken()
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

			return res;
		}

		return { success: false, message: 'Failed to fetch autocomplete suggestions.' };
	};

	const geocode = async (address: string) => {
		const res = await makeServerRequest<{ latitude: number; longitude: number }>(
			`event-geocode-${address}`,
			`/api/event/geocode?address=${encodeURIComponent(address)}`,
			useCurrentSessionToken()
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

			return res;
		}

		return { success: false, message: 'Failed to geocode address.' };
	};

	const reverseGeocode = async (lat: number, lng: number) => {
		const res = await makeServerRequest<{ address: string }>(
			`event-reverse-geocode-${lat}-${lng}`,
			`/api/event/geocode?lat=${lat}&lng=${lng}`,
			useCurrentSessionToken()
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

			return res;
		}

		return { success: false, message: 'Failed to reverse geocode coordinates.' };
	};

	return {
		latitude,
		longitude,
		retrieveLocation,
		autocomplete,
		geocode,
		reverseGeocode
	};
}
