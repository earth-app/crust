import { defineStore } from 'pinia';
import type { Event, EventImageSubmission } from 'types/event';
import type { User } from 'types/user';
import {
	makeAPIRequest,
	makeClientAPIRequest,
	makeServerRequest,
	paginatedAPIRequest
} from 'utils';
import { reactive } from 'vue';
import { useAuthStore } from './auth';

const RANDOM_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const isValidEvent = (e: unknown): e is Event => {
	if (!e || typeof e !== 'object' || Array.isArray(e)) return false;
	const ev = e as Partial<Event>;

	if (typeof ev.id !== 'string' || !ev.id) return false;
	if (!ev.host || typeof ev.host !== 'object' || Array.isArray(ev.host)) return false;
	if (typeof (ev.host as Partial<User>).id !== 'string') return false;

	return true;
};

export const useEventStore = defineStore('event', () => {
	const MAX_CACHE_SIZE = 100; // Limit cache to prevent memory leaks
	const cache = reactive(new Map<string, Event | null>());
	const loading = reactive(new Set<string>());
	const fetchQueue = new Map<string, Promise<void>>();

	const attendeesCache = reactive(new Map<string, User[]>());
	const thumbnailCache = reactive(new Map<string, string>());
	const thumbnailMetadataCache = reactive(new Map<string, { author: string; size: number }>());
	const submissionsCache = reactive(new Map<string, EventImageSubmission[]>());
	const randomCache = reactive(new Map<string, { items: Event[]; timestamp: number }>());

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

	const get = (id: string): Event | null | undefined => {
		if (!id) return undefined;
		// While a fetch is in flight and nothing has landed yet, return undefined so
		// consumers stay in the "loading" branch instead of flipping to "not found".
		if (loading.has(id) && !cache.get(id)) return undefined;
		return cache.get(id);
	};

	const has = (id: string): boolean => {
		return cache.has(id);
	};

	const isLoading = (id: string | null | undefined): boolean => {
		if (!id) return false;
		return loading.has(id);
	};

	const getRandomCached = (count: number): Event[] | null => {
		const entry = randomCache.get(`random-${count}`);
		if (entry && Date.now() - entry.timestamp < RANDOM_CACHE_TTL) {
			return entry.items;
		}
		return null;
	};

	const setRandomCached = (count: number, items: Event[]) => {
		randomCache.set(`random-${count}`, { items, timestamp: Date.now() });
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

		loading.add(id);

		// create new fetch promise
		const fetchPromise = (async () => {
			try {
				const authStore = useAuthStore();

				const res = await makeAPIRequest<Event>(
					`event-${id}`,
					`/v2/events/${id}`,
					authStore.sessionToken
				);

				if (valid(res) && isValidEvent(res.data)) {
					evictOldestIfNeeded();
					cache.set(id, res.data);
				} else {
					cache.set(id, null);
					if (valid(res)) {
						// API returned 200 with a payload, but the shape is bad (e.g. host: []
						// from mantle's anon-stripped serializeUser). Treat as not-found so
						// downstream components never see a half-built event.
						console.warn(`Malformed event payload for ${id} — treating as not found`);
					} else if (res.message) {
						console.warn(`Failed to fetch event ${id}:`, res.message);
					}
				}
			} catch (error) {
				cache.set(id, null);
				console.warn(`Failed to fetch event ${id}:`, error);
			} finally {
				loading.delete(id);
				fetchQueue.delete(id);
			}
		})();

		fetchQueue.set(id, fetchPromise);
		await fetchPromise;

		return cache.get(id) || null;
	};

	const setEvents = (events: Event[]) => {
		for (const event of events) {
			if (!isValidEvent(event)) continue;
			// list/random responses carry unreliable per-user fields (is_attending,
			// can_edit); don't let them downgrade an event already loaded via its
			// authoritative single-event fetch — only seed events not yet cached
			if (cache.get(event.id)) continue;
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

			if (valid(res)) {
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

	const fetchThumbnail = async (
		id: string,
		serverRequest: typeof makeServerRequest = makeServerRequest
	): Promise<string | null> => {
		try {
			const authStore = useAuthStore();
			const res = await serverRequest<Blob>(
				`event-thumbnail-${id}`,
				`/api/event/thumbnail?id=${encodeURIComponent(id)}`,
				authStore.sessionToken
			);

			if (valid(res)) {
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

	const fetchThumbnailMetadata = async (
		id: string,
		serverRequest: typeof makeServerRequest = makeServerRequest
	) => {
		try {
			const authStore = useAuthStore();
			const res = await serverRequest<{ author: string; size: number }>(
				`event-thumbnail-metadata-${id}`,
				`/api/event/thumbnail?id=${encodeURIComponent(id)}&metadata=true`,
				authStore.sessionToken
			);

			if (valid(res)) {
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

			if (valid(res)) {
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

		if (valid(res)) {
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

		if (valid(res)) {
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

		if (valid(res)) {
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

	const uploadThumbnail = async (
		id: string,
		file: File,
		serverRequest: typeof makeServerRequest = makeServerRequest
	) => {
		const authStore = useAuthStore();
		const formData = new FormData();
		formData.append('file', file);

		const res = await serverRequest(
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

	const generateThumbnail = async (
		id: string,
		prompt: string,
		serverRequest: typeof makeServerRequest = makeServerRequest
	) => {
		const authStore = useAuthStore();
		const res = await serverRequest<Blob>(
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

		const res = await makeClientAPIRequest<{
			message: string;
			submission_id: string;
			user_id: string;
			event_id: string;
			photo_url: string;
			image: string;
			score: {
				score: number;
				breakdown: { id: string; similarity: number; normalized: number; weighted: number }[];
			};
			created_at: string;
			caption: string;
			scored_at: string;
			timestamp: number;
		}>(`/v2/events/${id}/images`, authStore.sessionToken, {
			method: 'POST',
			body: {
				photo_url: dataUrl
			}
		});

		if (valid(res)) {
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
		isLoading,
		getRandomCached,
		setRandomCached,
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
