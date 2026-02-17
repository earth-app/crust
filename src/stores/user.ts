import { defineStore } from 'pinia';
import type { Event, EventImageSubmission } from '~/shared/types/event';
import type { User, UserBadge } from '~/shared/types/user';
import { makeAPIRequest, makeClientAPIRequest, paginatedAPIRequest } from '~/shared/util';
import { useAuthStore } from './auth';
import { useAvatarStore } from './avatar';

export const useUserStore = defineStore('user', () => {
	const cache = reactive(new Map<string, User>());
	const fetchQueue = new Map<string, Promise<void>>();

	const attendingEvents = reactive(new Map<string, Event[]>());
	const hostingEvents = reactive(new Map<string, Event[]>());
	const badges = reactive(new Map<string, UserBadge[]>());
	const eventSubmissions = reactive(new Map<string, EventImageSubmission[]>());

	const get = (identifier: string): User | undefined => {
		return cache.get(identifier);
	};

	const has = (identifier: string): boolean => {
		return cache.has(identifier);
	};

	const fetchUser = async (identifier: string, force: boolean = false): Promise<User | null> => {
		if (!identifier) return null;

		if (cache.has(identifier) && !force && !fetchQueue.has(identifier)) {
			return cache.get(identifier)!;
		}

		const existingFetch = fetchQueue.get(identifier);
		if (existingFetch && !force) {
			await existingFetch;
			return cache.get(identifier) || null;
		}

		// create new fetch promise
		const fetchPromise = (async () => {
			try {
				const authStore = useAuthStore();

				if (force && import.meta.client) {
					await refreshNuxtData(`user-${identifier}`);
				}

				const res = await makeAPIRequest<User>(
					`user-${identifier}`,
					`/v2/users/${identifier}`,
					authStore.sessionToken
				);

				if (res.success && res.data) {
					if ('message' in res.data) {
						console.warn(`Failed to fetch user ${identifier}:`, res.data.message);
						return;
					}

					cache.set(identifier, res.data);

					const avatarStore = useAvatarStore();
					avatarStore.preloadAvatar(res.data.account?.avatar_url);
				} else {
					console.warn(`Failed to fetch user ${identifier}:`, res.message);
				}
			} catch (error) {
				console.warn(`Failed to fetch user ${identifier}:`, error);
			} finally {
				fetchQueue.delete(identifier);
			}
		})();

		fetchQueue.set(identifier, fetchPromise);
		await fetchPromise;

		return cache.get(identifier) || null;
	};

	const fetchAttendingEvents = async (identifier: string): Promise<Event[]> => {
		const authStore = useAuthStore();
		const res = await paginatedAPIRequest<Event>(
			`/v2/users/${identifier}/events/attending`,
			authStore.sessionToken
		);

		if (res.success && res.data && !('message' in res.data)) {
			attendingEvents.set(identifier, res.data);
			return res.data;
		}

		attendingEvents.set(identifier, []);
		return [];
	};

	const fetchHostingEvents = async (identifier: string): Promise<Event[]> => {
		const authStore = useAuthStore();
		const res = await paginatedAPIRequest<Event>(
			`/v2/users/${identifier}/events`,
			authStore.sessionToken
		);

		if (res.success && res.data && !('message' in res.data)) {
			hostingEvents.set(identifier, res.data);
			return res.data;
		}

		hostingEvents.set(identifier, []);
		return [];
	};

	const fetchBadges = async (identifier: string): Promise<UserBadge[]> => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<UserBadge[]>(
			`/v2/users/${identifier}/badges`,
			authStore.sessionToken
		);

		if (res.success && res.data && !('message' in res.data)) {
			badges.set(identifier, res.data);
			return res.data;
		}

		badges.set(identifier, []);
		return [];
	};

	const fetchEventSubmissions = async (identifier: string): Promise<EventImageSubmission[]> => {
		const authStore = useAuthStore();
		const res = await paginatedAPIRequest<EventImageSubmission>(
			`/v2/users/${identifier}/events/images`,
			authStore.sessionToken
		);

		if (res.success && res.data && !('message' in res.data)) {
			eventSubmissions.set(identifier, res.data);
			return res.data;
		}

		eventSubmissions.set(identifier, []);
		return [];
	};

	const getChipColor = (user: User | undefined) => {
		if (!user) return undefined;

		switch (user.account?.account_type) {
			case 'PRO':
				return 'secondary';
			case 'WRITER':
				return 'primary';
			case 'ORGANIZER':
				return 'warning';
			case 'ADMINISTRATOR':
				return 'error';
		}
	};

	const getMaxEventAttendees = (user: User | undefined): number => {
		if (!user) return 0;

		switch (user.account?.account_type) {
			case 'PRO':
			case 'WRITER':
				return 5000;
			case 'ORGANIZER':
				return 1_000_000;
			case 'ADMINISTRATOR':
				return Infinity;
			default:
				return 1000;
		}
	};

	const clear = (identifier?: string) => {
		if (identifier) {
			cache.delete(identifier);
			attendingEvents.delete(identifier);
			hostingEvents.delete(identifier);
			badges.delete(identifier);
			eventSubmissions.delete(identifier);
		} else {
			cache.clear();
			attendingEvents.clear();
			hostingEvents.clear();
			badges.clear();
			eventSubmissions.clear();
		}
	};

	return {
		cache,
		attendingEvents,
		hostingEvents,
		badges,
		eventSubmissions,
		get,
		has,
		getChipColor,
		getMaxEventAttendees,
		fetchUser,
		fetchAttendingEvents,
		fetchHostingEvents,
		fetchBadges,
		fetchEventSubmissions,
		clear
	};
});
