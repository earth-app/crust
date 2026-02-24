import {
	type Event,
	type EventAutocompleteSuggestion,
	type EventData,
	type EventImageSubmission
} from '~/shared/types/event';
import type { User } from '~/shared/types/user';
import { makeAPIRequest, makeClientAPIRequest, makeServerRequest } from '~/shared/utils/util';
import { useAuthStore } from '~/stores/auth';
import { useEventStore } from '~/stores/event';

export function useEvents() {
	const authStore = useAuthStore();
	const eventStore = useEventStore();

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
			authStore.sessionToken
		);
		if (res.success && res.data) {
			if ('message' in res.data) {
				throw new Error(res.data.message);
			}

			// Load events into store
			eventStore.setEvents(res.data.items);

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
		return await eventStore.createEvent(eventData);
	};

	const deleteEvent = async (id: string) => {
		return await eventStore.deleteEvent(id);
	};

	const getRandom = async (count: number = 5) => {
		const res = await makeClientAPIRequest<Event[]>(
			`/v2/events/random?count=${count}`,
			authStore.sessionToken
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

			// load individual events into store
			eventStore.setEvents(res.data);
		}

		return res;
	};

	const getRecent = async (count: number = 5) => {
		const res = await makeAPIRequest<{ items: Event[] }>(
			`recent-events-${count}`,
			`/v2/events?sort=desc&limit=${count}`,
			authStore.sessionToken
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

			// load individual events into store
			eventStore.setEvents(res.data.items);
		}

		return res;
	};

	const getRecommended = async (count: number = 5) => {
		const { user, fetchUser } = useAuth();
		await fetchUser(true);

		const pool = await getRandom(Math.min(count * 3, 15)).then((res) =>
			res.success ? res.data : res.message
		);

		const res = await makeServerRequest<Event[]>(
			`user-${user.value!.id}-event_recommendations`,
			`/api/event/recommend`,
			authStore.sessionToken,
			{
				method: 'POST',
				body: { user: user.value, count, pool }
			}
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

			// load recommended events into store
			eventStore.setEvents(res.data);
		}

		return res;
	};

	const getUpcoming = async (count: number = 5) => {
		const res = await makeAPIRequest<{ items: Event[] }>(
			`upcoming-events-${count}`,
			`/v2/events?sort=desc&limit=${count}&filter_is_upcoming=true`,
			authStore.sessionToken
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

			// load individual events into store
			eventStore.setEvents(res.data.items);
		}

		return res;
	};

	return {
		getEvents,
		createEvent,
		deleteEvent,
		getRandom,
		getRecent,
		getRecommended,
		getUpcoming
	};
}

export function useEvent(id: string) {
	const eventStore = useEventStore();
	const authStore = useAuthStore();

	const event = computed(() => eventStore.get(id) || null);

	const fetch = async () => {
		if (!id || id === '') {
			return { success: false, message: 'Invalid event ID' };
		}

		const result = await eventStore.fetchEvent(id);
		return result
			? { success: true, data: result }
			: { success: false, message: 'Event not found' };
	};

	if (!eventStore.has(id)) {
		fetch();
	}

	const updateEvent = async (updatedEvent: Partial<EventData>) =>
		await eventStore.patchEvent({ id, ...updatedEvent });

	const deleteEvent = async () => await eventStore.deleteEvent(id);

	const attendees = useState<User[] | null>(`event-attendees-${id}`, () => null);
	const fetchAttendees = async () =>
		await eventStore.fetchAttendees(id).then((data) => (attendees.value = data));

	const signUpForEvent = async () => {
		const res = await eventStore.signUpForEvent(id);

		if (res.success) {
			// refetch event to get updated data from store
			await eventStore.fetchEvent(id, true);
			attendees.value = null;
			await fetchAttendees();
		}

		return res;
	};

	const leaveEvent = async () => {
		const res = await eventStore.leaveEvent(id);

		if (res.success) {
			// refetch event to get updated data from store
			await eventStore.fetchEvent(id, true);
			attendees.value = null;
			await fetchAttendees();
		}

		return res;
	};

	const thumbnail = useState<string | null>(`event-thumbnail-${id}`, () => null);
	const fetchThumbnail = async () => {
		const res = await makeServerRequest<Blob>(
			`event-thumbnail-${id}`,
			`/api/event/thumbnail?id=${encodeURIComponent(id)}`,
			authStore.sessionToken
		);

		if (res.success && res.data) {
			const url = URL.createObjectURL(res.data);
			thumbnail.value = url;
		} else {
			thumbnail.value = null;
		}

		return res;
	};

	const thumbnailAuthor = useState<string | null>(`event-thumbnail-author-${id}`, () => null);
	const thumbnailSize = useState<number | null>(`event-thumbnail-size-${id}`, () => null);

	const fetchThumbnailMetadata = async () => {
		const data = await eventStore.fetchThumbnailMetadata(id);

		thumbnailAuthor.value = data?.author || null;
		thumbnailSize.value = data?.size || null;

		return data;
	};

	const uploadThumbnail = async (file: File) => {
		const res = await eventStore.uploadThumbnail(id, file);

		if (res.success) {
			await fetchThumbnail();
			await fetchThumbnailMetadata();
		}

		return res;
	};

	const generateThumbnail = async () => {
		if (!event.value) {
			await fetch();
		}

		const res = await eventStore.generateThumbnail(id, event.value?.name ?? '');

		if (res.success) {
			await fetchThumbnail();
			await fetchThumbnailMetadata();
		}

		return res;
	};

	const deleteThumbnail = async () => {
		const res = await makeServerRequest(
			`event-thumbnail-delete-${id}`,
			`/api/event/thumbnail?id=${encodeURIComponent(id)}`,
			authStore.sessionToken,
			{
				method: 'DELETE'
			}
		);

		if (res.success) {
			eventStore.clearThumbnail(id);
			thumbnail.value = null;
			thumbnailAuthor.value = null;
			thumbnailSize.value = null;
		}

		return res;
	};

	const unloadThumbnail = () => {
		if (thumbnail.value) {
			URL.revokeObjectURL(thumbnail.value);
			thumbnail.value = null;
		}
	};

	const cancelEvent = async () => await eventStore.cancelEvent(id);
	const uncancelEvent = async () => await eventStore.uncancelEvent(id);

	const submissions = useState<EventImageSubmission[] | null>(
		`event-image-submissions-${id}`,
		() => null
	);
	const fetchSubmissions = async () => {
		const data = await eventStore.fetchSubmissions(id);
		submissions.value = data;
		return data;
	};

	const fetchSubmissionsForUser = async (user: string) =>
		await eventStore.fetchSubmissionsForUser(id, user);

	const submitImage = async (file: File) => {
		const res = await eventStore.submitImage(id, file);

		if (res.success) {
			await fetchSubmissions();
		}

		return res;
	};

	const getSimilar = async (count: number = 5) => {
		if (!event.value) {
			await fetch();
		}

		if (!event.value) {
			return { success: false, message: 'Event not found' };
		}

		const eventStore = useEventStore();
		const authStore = useAuthStore();
		const { getRandom } = useEvents();

		const pool = await getRandom(Math.min(count * 3, 15)).then((res) =>
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
			`event-${event.value.id}-similar_events`,
			`/api/event/similar`,
			authStore.sessionToken,
			{
				method: 'POST',
				body: { event: event.value, count, pool }
			}
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

			// load similar events into store
			eventStore.setEvents(res.data);
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
		uncancelEvent,
		submissions,
		fetchSubmissions,
		fetchSubmissionsForUser,
		submitImage,
		getSimilar
	};
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
		const authStore = useAuthStore();
		const res = await makeServerRequest<EventAutocompleteSuggestion[]>(
			`event-autocomplete-${input}-${latitude.value ?? 'null'}-${longitude.value ?? 'null'}`,
			`/api/event/autocomplete?input=${encodeURIComponent(
				input
			)}&sessionToken=${encodeURIComponent(sessionToken)}${
				latitude.value !== null && longitude.value !== null
					? `&latitude=${latitude.value}&longitude=${longitude.value}`
					: ''
			}`,
			authStore.sessionToken
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
		const authStore = useAuthStore();
		const res = await makeServerRequest<{ latitude: number; longitude: number }>(
			`event-geocode-${address}`,
			`/api/event/geocode?address=${encodeURIComponent(address)}`,
			authStore.sessionToken
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
		const authStore = useAuthStore();
		const res = await makeServerRequest<{ address: string }>(
			`event-reverse-geocode-${lat}-${lng}`,
			`/api/event/geocode?lat=${lat}&lng=${lng}`,
			authStore.sessionToken
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
