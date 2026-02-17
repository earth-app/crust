import { defineStore } from 'pinia';
import type { Event, EventImageSubmission } from '~/shared/types/event';
import type { User } from '~/shared/types/user';
import {
	makeAPIRequest,
	makeClientAPIRequest,
	makeServerRequest,
	paginatedAPIRequest
} from '~/shared/util';
import { useAuthStore } from './auth';

export const useEventStore = defineStore('event', () => {
	const MAX_CACHE_SIZE = 100; // Limit cache to prevent memory leaks
	const cache = reactive(new Map<string, Event>());
	const fetchQueue = new Map<string, Promise<void>>();

	const attendeesCache = reactive(new Map<string, User[]>());
	const thumbnailCache = reactive(new Map<string, string>());
	const thumbnailMetadataCache = reactive(new Map<string, { author: string; size: number }>());
	const submissionsCache = reactive(new Map<string, EventImageSubmission[]>());

	// LRU cache eviction
	const evictOldestIfNeeded = () => {
		if (cache.size >= MAX_CACHE_SIZE) {
			const firstKey = cache.keys().next().value;
			if (firstKey) {
				cache.delete(firstKey);
				attendeesCache.delete(firstKey);
				thumbnailCache.delete(firstKey);
				thumbnailMetadataCache.delete(firstKey);
				submissionsCache.delete(firstKey);
			}
		}
	};

	const get = (id: string): Event | undefined => {
		return cache.get(id);
	};

	const has = (id: string): boolean => {
		return cache.has(id);
	};

	const getAttendees = (id: string): User[] | undefined => {
		return attendeesCache.get(id);
	};

	const getThumbnail = (id: string): string | undefined => {
		return thumbnailCache.get(id);
	};

	const getThumbnailMetadata = (id: string): { author: string; size: number } | undefined => {
		return thumbnailMetadataCache.get(id);
	};

	const getSubmissions = (id: string): EventImageSubmission[] | undefined => {
		return submissionsCache.get(id);
	};

	const fetchEvent = async (id: string, force: boolean = false): Promise<Event | null> => {
		if (!id) return null;

		if (cache.has(id) && !force && !fetchQueue.has(id)) {
			return cache.get(id)!;
		}

		const existingFetch = fetchQueue.get(id);
		if (existingFetch && !force) {
			await existingFetch;
			return cache.get(id) || null;
		}

		// If force is true and there's an existing fetch, wait for it to complete first
		// to avoid race conditions
		if (force && existingFetch) {
			await existingFetch;
		}

		// create new fetch promise
		const fetchPromise = (async () => {
			try {
				const authStore = useAuthStore();

				const res = await makeAPIRequest<Event>(
					`event-${id}`,
					`/v2/events/${id}`,
					authStore.sessionToken
				);

				if (res.success && res.data) {
					if ('message' in res.data) {
						console.warn(`Failed to fetch event ${id}:`, res.data.message);
						return;
					}

					evictOldestIfNeeded();
					cache.set(id, res.data);
				} else {
					console.warn(`Failed to fetch event ${id}:`, res.message);
				}
			} catch (error) {
				console.warn(`Failed to fetch event ${id}:`, error);
			} finally {
				fetchQueue.delete(id);
			}
		})();

		fetchQueue.set(id, fetchPromise);
		await fetchPromise;

		return cache.get(id) || null;
	};

	const setEvents = (events: Event[]) => {
		for (const event of events) {
			cache.set(event.id, event);
		}
	};

	const updateEvent = (id: string, updates: Partial<Event>) => {
		const event = cache.get(id);
		if (event) {
			cache.set(id, { ...event, ...updates });
		}
	};

	const fetchAttendees = async (id: string): Promise<User[]> => {
		try {
			const authStore = useAuthStore();
			const res = await paginatedAPIRequest<User>(
				`/v2/events/${id}/attendees`,
				authStore.sessionToken
			);

			if (res.success && res.data && !('message' in res.data)) {
				attendeesCache.set(id, res.data);
				return res.data;
			}

			attendeesCache.set(id, []);
			return [];
		} catch (error) {
			console.warn(`Failed to fetch attendees for event ${id}:`, error);
			attendeesCache.set(id, []);
			return [];
		}
	};

	const fetchThumbnail = async (id: string): Promise<string | null> => {
		try {
			const authStore = useAuthStore();
			const res = await makeServerRequest<Blob>(
				`event-thumbnail-${id}`,
				`/api/event/thumbnail?id=${encodeURIComponent(id)}`,
				authStore.sessionToken
			);

			if (res.success && res.data) {
				const url = URL.createObjectURL(res.data);
				thumbnailCache.set(id, url);
				return url;
			}

			return null;
		} catch (error) {
			console.warn(`Failed to fetch thumbnail for event ${id}:`, error);
			return null;
		}
	};

	const fetchThumbnailMetadata = async (id: string) => {
		try {
			const authStore = useAuthStore();
			const res = await makeServerRequest<{ author: string; size: number }>(
				`event-thumbnail-metadata-${id}`,
				`/api/event/thumbnail?id=${encodeURIComponent(id)}&metadata=true`,
				authStore.sessionToken
			);

			if (res.success && res.data && !('message' in res.data)) {
				thumbnailMetadataCache.set(id, res.data);
				return res.data;
			}

			return null;
		} catch (error) {
			console.warn(`Failed to fetch thumbnail metadata for event ${id}:`, error);
			return null;
		}
	};

	const fetchSubmissions = async (id: string): Promise<EventImageSubmission[]> => {
		try {
			const authStore = useAuthStore();
			const res = await paginatedAPIRequest<EventImageSubmission>(
				`/v2/events/${id}/images`,
				authStore.sessionToken
			);

			if (res.success && res.data && !('message' in res.data)) {
				submissionsCache.set(id, res.data);
				return res.data;
			}

			submissionsCache.set(id, []);
			return [];
		} catch (error) {
			console.warn(`Failed to fetch submissions for event ${id}:`, error);
			submissionsCache.set(id, []);
			return [];
		}
	};

	const fetchSubmissionsForUser = async (id: string, user: string) => {
		const res = await paginatedAPIRequest<EventImageSubmission>(
			`/v2/users/${user}/events/images/${id}`,
			useCurrentSessionToken()
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				console.error(`Failed to fetch submissions for user ${user}:`, res.data.message);
			}

			submissionsCache.set(`${id}-${user}`, res.data);
			return res.data;
		}

		console.error(`Failed to fetch submissions for user ${user}:`, res.message);
		submissionsCache.set(`${id}-${user}`, []);
		return [];
	};

	const clearThumbnail = (id: string) => {
		const url = thumbnailCache.get(id);
		if (url) {
			URL.revokeObjectURL(url);
			thumbnailCache.delete(id);
		}
	};

	const clear = (id?: string) => {
		if (id) {
			cache.delete(id);
			attendeesCache.delete(id);
			clearThumbnail(id);
			thumbnailMetadataCache.delete(id);
			submissionsCache.delete(id);
		} else {
			cache.clear();
			attendeesCache.clear();

			for (const [, url] of thumbnailCache) {
				URL.revokeObjectURL(url);
			}

			thumbnailCache.clear();
			thumbnailMetadataCache.clear();
			submissionsCache.clear();
		}
	};

	const createEvent = async (event: any) => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<Event>('/v2/events', authStore.sessionToken, {
			method: 'POST',
			body: event
		});

		if (res.success && res.data && !('message' in res.data)) {
			cache.set(res.data.id, res.data);
		}

		return res;
	};

	const patchEvent = async (event: any) => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<Event>(
			`/v2/events/${event.id}`,
			authStore.sessionToken,
			{
				method: 'PATCH',
				body: event
			}
		);

		if (res.success && res.data && !('message' in res.data)) {
			cache.set(res.data.id, res.data);
		}

		return res;
	};

	const deleteEvent = async (id: string) => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<void>(`/v2/events/${id}`, authStore.sessionToken, {
			method: 'DELETE'
		});

		if (res.success) {
			clear(id);
		}

		return res;
	};

	const signUpForEvent = async (id: string) => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<void>(
			`/v2/events/${id}/signup`,
			authStore.sessionToken,
			{
				method: 'POST'
			}
		);

		if (res.success) {
			attendeesCache.delete(id);

			const event = cache.get(id);
			if (event) {
				cache.set(id, { ...event, attendee_count: (event.attendee_count || 0) + 1 });
			}
		}

		return res;
	};

	const leaveEvent = async (id: string) => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<void>(`/v2/events/${id}/leave`, authStore.sessionToken, {
			method: 'POST'
		});

		if (res.success) {
			attendeesCache.delete(id);

			const event = cache.get(id);
			if (event && event.attendee_count) {
				cache.set(id, { ...event, attendee_count: event.attendee_count - 1 });
			}
		}

		return res;
	};

	const cancelEvent = async (id: string) => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<void>(
			`/v2/events/${id}/cancel`,
			authStore.sessionToken,
			{
				method: 'POST'
			}
		);

		if (res.success) {
			const event = cache.get(id);
			if (event && event.fields) {
				cache.set(id, { ...event, fields: { ...event.fields, cancelled: true } });
			}
		}

		return res;
	};

	const uncancelEvent = async (id: string) => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<void>(
			`/v2/events/${id}/uncancel`,
			authStore.sessionToken,
			{
				method: 'POST'
			}
		);

		if (res.success) {
			const event = cache.get(id);
			if (event && event.fields) {
				cache.set(id, { ...event, fields: { ...event.fields, cancelled: false } });
			}
		}

		return res;
	};

	const uploadThumbnail = async (id: string, file: File) => {
		const authStore = useAuthStore();
		const formData = new FormData();
		formData.append('file', file);

		const res = await makeServerRequest(
			`event-thumbnail-upload-${id}`,
			`/api/event/thumbnail?id=${encodeURIComponent(id)}`,
			authStore.sessionToken,
			{
				method: 'POST',
				body: formData
			}
		);

		return res;
	};

	const generateThumbnail = async (id: string, prompt: string) => {
		const authStore = useAuthStore();
		const res = await makeServerRequest<Blob>(
			`event-thumbnail-generate-${id}`,
			`/api/event/thumbnail?id=${id}&name=${encodeURIComponent(prompt)}&generate=true`,
			authStore.sessionToken,
			{
				method: 'POST'
			}
		);

		return res;
	};

	const submitImage = async (id: string, file: File) => {
		const authStore = useAuthStore();

		const dataUrl = await new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				resolve(reader.result as string);
			};
			reader.onerror = (error) => {
				reject(error);
			};
			reader.readAsDataURL(file);
		});

		const res = await makeClientAPIRequest<EventImageSubmission>(
			`/v2/events/${id}/images`,
			authStore.sessionToken,
			{
				method: 'POST',
				body: {
					photo_url: dataUrl
				}
			}
		);

		if (res.success && res.data && !('message' in res.data)) {
			const submissions = submissionsCache.get(id) || [];
			submissionsCache.set(id, [res.data, ...submissions]);
		}

		return res;
	};

	return {
		cache,
		attendeesCache,
		thumbnailCache,
		thumbnailMetadataCache,
		submissionsCache,
		get,
		has,
		getAttendees,
		getThumbnail,
		getThumbnailMetadata,
		getSubmissions,
		fetchEvent,
		setEvents,
		updateEvent,
		fetchAttendees,
		fetchThumbnail,
		fetchThumbnailMetadata,
		fetchSubmissions,
		fetchSubmissionsForUser,
		clearThumbnail,
		createEvent,
		patchEvent,
		deleteEvent,
		signUpForEvent,
		leaveEvent,
		cancelEvent,
		uncancelEvent,
		uploadThumbnail,
		generateThumbnail,
		submitImage,
		clear
	};
});
