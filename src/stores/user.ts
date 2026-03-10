import { defineStore } from 'pinia';
import type { Event } from '~/shared/types/event';
import { useAuthStore } from './auth';
import { useAvatarStore } from './avatar';

export const useUserStore = defineStore('user', () => {
	const cache = reactive(new Map<string, User>());
	const fetchQueue = new Map<string, Promise<void>>();

	const attendingEvents = reactive(new Map<string, Event[]>());
	const hostingEvents = reactive(new Map<string, Event[]>());
	const badges = reactive(new Map<string, UserBadge[]>());
	const eventSubmissions = reactive(new Map<string, EventImageSubmission[]>());
	const points = reactive(new Map<string, number>());
	const pointsHistory = reactive(new Map<string, ImpactPointsChange[]>());
	const quest = reactive(new Map<string, UserQuestProgress>());
	const questHistory = reactive(new Map<string, Map<string, QuestHistoryEntry>>());
	const questsList = ref<Quest[] | null>(null);

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
		const res = await makeAPIRequest<UserBadge[]>(
			`user-${identifier}-badges`,
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

	const fetchPoints = async (identifier: string): Promise<[number, ImpactPointsChange[]]> => {
		const authStore = useAuthStore();
		const res = await makeAPIRequest<{
			points: number;
			history: {
				reason: string;
				difference: number;
				timestamp?: number;
			}[];
		}>(`user-${identifier}-points`, `/v2/users/${identifier}/points`, authStore.sessionToken);

		if (res.success && res.data && !('message' in res.data)) {
			points.set(identifier, res.data.points);
			pointsHistory.set(identifier, res.data.history);
			return [res.data.points, res.data.history];
		}

		points.set(identifier, 0);
		pointsHistory.set(identifier, []);
		return [0, []];
	};

	const fetchQuest = async (
		identifier: string,
		force: boolean = false
	): Promise<UserQuestProgress | null> => {
		const authStore = useAuthStore();
		const res = await makeAPIRequest<UserQuestProgress>(
			force ? null : `user-${identifier}-quest`,
			`/v2/users/${identifier}/quest`,
			authStore.sessionToken
		);

		if (res.success && res.data && !('message' in res.data)) {
			quest.set(identifier, res.data);
			return res.data;
		}

		quest.delete(identifier);
		return null;
	};

	const fetchQuestStep = async (
		identifier: string,
		index: number
	): Promise<QuestProgressEntry | null> => {
		const authStore = useAuthStore();
		const res = await makeAPIRequest<QuestProgressEntry>(
			`user-${identifier}-quest-step-${index}`,
			`/v2/users/${identifier}/quest/step/${index}`,
			authStore.sessionToken
		);

		if (res.success && res.data && !('message' in res.data)) {
			return res.data;
		}

		return null;
	};

	const startQuest = async (
		identifier: string,
		questId: string,
		override: boolean = false // override existing progress, if any
	): Promise<{ message: string }> => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<{ message: string }>(
			`/v2/users/${identifier}/quest?quest_id=${questId}&override=${override}`,
			authStore.sessionToken,
			{
				method: 'POST'
			}
		);

		if (res.success && res.data && !('message' in res.data)) return res.data;
		return { message: res.data?.message || res.message || 'Failed to start quest' };
	};

	const updateQuest = async (
		identifier: string,
		stepResponse: {
			type: string;
			index: number;
			altIndex?: number;
			dataUrl?: string;
			[x: string]: any;
		},
		lat: number | null,
		lng: number | null
	): Promise<{ message: string; completed: boolean; validated: boolean }> => {
		const authStore = useAuthStore();

		const res = await makeServerRequest<{
			message: string;
			completed: boolean;
			validated: boolean;
		}>(null, '/api/user/updateQuest', authStore.sessionToken, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${authStore.sessionToken}`,
				'X-Latitude': String(lat ?? 0),
				'X-Longitude': String(lng ?? 0)
			},
			body: stepResponse
		});

		if (!res.success || !res.data) {
			return {
				message: res.data?.message || res.message || 'Failed to update quest',
				completed: false,
				validated: false
			};
		}

		if (res.data.validated) {
			await fetchQuest(identifier, true);
		}

		return res.data;
	};

	const endQuest = async (identifier: string): Promise<{ message: string }> => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<{ message: string }>(
			`/v2/users/${identifier}/quest`,
			authStore.sessionToken,
			{
				method: 'DELETE'
			}
		);

		if (res.success && res.data && !('message' in res.data)) return res.data;
		return { message: res.data?.message || res.message || 'Failed to end quest' };
	};

	const fetchQuestHistory = async (identifier: string): Promise<Map<string, QuestHistoryEntry>> => {
		const authStore = useAuthStore();
		const res = await makeAPIRequest<{
			total: number;
			history: { [questId: string]: QuestHistoryEntry };
		}>(
			`user-${identifier}-quest-history`,
			`/v2/users/${identifier}/quest/history`,
			authStore.sessionToken
		);

		if (res.success && res.data && !('message' in res.data)) {
			const map = new Map(Object.entries(res.data.history));
			questHistory.set(identifier, map);
			return map;
		}

		const map = new Map();
		questHistory.set(identifier, map);
		return map;
	};

	const fetchQuestsList = async (): Promise<Quest[]> => {
		const authStore = useAuthStore();
		const res = await makeAPIRequest<{ total: number; quests: Quest[] }>(
			'quests',
			'/v2/users/quests',
			authStore.sessionToken
		);

		if (res.success && res.data && !('message' in res.data)) {
			questsList.value = res.data.quests;
			return res.data.quests;
		}

		questsList.value = [];
		return [];
	};

	const clear = (identifier?: string) => {
		if (identifier) {
			cache.delete(identifier);
			attendingEvents.delete(identifier);
			hostingEvents.delete(identifier);
			badges.delete(identifier);
			eventSubmissions.delete(identifier);
			points.delete(identifier);
			pointsHistory.delete(identifier);
			quest.delete(identifier);
			questHistory.delete(identifier);
		} else {
			cache.clear();
			attendingEvents.clear();
			hostingEvents.clear();
			badges.clear();
			eventSubmissions.clear();
			points.clear();
			pointsHistory.clear();
			quest.clear();
			questHistory.clear();
			questsList.value = null;
		}
	};

	return {
		cache,
		attendingEvents,
		hostingEvents,
		badges,
		eventSubmissions,
		points,
		pointsHistory,
		quest,
		questHistory,
		questsList,
		get,
		has,
		getChipColor,
		getMaxEventAttendees,
		fetchUser,
		fetchAttendingEvents,
		fetchHostingEvents,
		fetchBadges,
		fetchEventSubmissions,
		fetchPoints,
		fetchQuest,
		fetchQuestStep,
		startQuest,
		updateQuest,
		endQuest,
		fetchQuestHistory,
		fetchQuestsList,
		clear
	};
});
