import type { Event, EventData } from '~/shared/types/event';
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
					items: res.data.items.filter((event) => new Date(event.date * 1000) >= now),
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

	const currentEvents = useState<Event[] | null>('events-current', () => null);
	const fetchCurrentEvents = async () => {
		const res = await paginatedAPIRequest<Event>(
			'events-current',
			'/v2/events/current',
			useCurrentSessionToken()
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				currentEvents.value = null;
				return res;
			}

			currentEvents.value = res.data;
		} else {
			currentEvents.value = null;
		}

		return res;
	};

	const createEvent = async (eventData: EventData) => {
		const res = await makeAPIRequest<Event>(
			'event-create',
			'/v2/events',
			useCurrentSessionToken(),
			{
				method: 'POST',
				body: eventData
			}
		);

		return res;
	};

	const deleteEvent = async (id: string) => {
		const res = await makeAPIRequest<void>(
			`event-delete-${id}`,
			`/v2/events/${id}`,
			useCurrentSessionToken(),
			{
				method: 'DELETE'
			}
		);

		return res;
	};

	return {
		getEvents,
		currentEvents,
		fetchCurrentEvents,
		createEvent,
		deleteEvent
	};
}

export function useEvent(id: string) {
	const event = useState<Event | null>(`event-${id}`, () => null);

	const fetch = async () => {
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

	if (!event.value) {
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
			`event-attendees-${id}`,
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
		unloadThumbnail
	};
}
