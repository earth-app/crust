import type { Event, EventData } from '~/shared/types/event';
import type { User } from '~/shared/types/user';
import { makeAPIRequest, makeClientAPIRequest, paginatedAPIRequest } from '~/shared/util';

export function useEvents() {
	const getEvents = async (
		page: number = 1,
		limit: number = 50,
		search: string = '',
		upcoming: boolean = true
	) => {
		const res = await makeAPIRequest<Event[]>(
			`events-${page}-${limit}-${search}-${upcoming}`,
			`/v2/events?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`,
			useCurrentSessionToken()
		);
		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

			if (upcoming) {
				const now = new Date();
				return res.data.filter((event) => new Date(event.date) >= now);
			} else {
				return res.data;
			}
		}

		return res;
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

	const fetchEvent = async () => {
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
		fetchEvent();
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

	return {
		event,
		fetchEvent,
		updateEvent,
		deleteEvent,
		attendees,
		fetchAttendees,
		signUpForEvent,
		leaveEvent
	};
}
