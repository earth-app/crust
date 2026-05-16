import { defineStore } from 'pinia';
import type { Event } from 'types/event';
import { computed, reactive, ref } from 'vue';
import { useAuthStore } from './auth';
import { useAvatarStore } from './avatar';

export const useUserStore = defineStore('user', () => {
	const cache = reactive(new Map<string, User>());
	const users = computed(() => {
		const seen = new Set<string>();
		const entries: User[] = [];

		for (const user of cache.values()) {
			if (seen.has(user.id)) continue;
			seen.add(user.id);
			entries.push(user);
		}

		return entries;
	});
	const fetchQueue = new Map<string, Promise<void>>();

	const attendingEvents = reactive(new Map<string, Event[]>());
	const hostingEvents = reactive(new Map<string, Event[]>());
	const badges = reactive(new Map<string, UserBadge[]>());
	const eventSubmissions = reactive(new Map<string, EventImageSubmission[]>());
	const points = reactive(new Map<string, number>());
	const pointsHistory = reactive(new Map<string, ImpactPointsChange[]>());
	const quest = reactive(new Map<string, UserQuestProgress | null>());
	const questHistory = reactive(new Map<string, Map<string, QuestHistoryEntry>>());
	const questSyncVersions = reactive(new Map<string, number>());
	const questsList = ref<Set<string> | null>(null);
	const questsCache = reactive(new Map<string, Quest>());

	type QuestProgressPayload = {
		type: string;
		index: number;
		altIndex?: number;
		dataUrl?: string;
		[x: string]: any;
	};

	const cloneQuestProgress = (
		progress: (QuestProgressEntry | QuestProgressEntry[])[] = []
	): (QuestProgressEntry | QuestProgressEntry[])[] =>
		progress.map((entry) =>
			Array.isArray(entry) ? entry.map((altEntry) => ({ ...altEntry })) : { ...entry }
		);

	const createQuestProgressEntry = (
		stepResponse: QuestProgressPayload,
		submittedAt: number
	): QuestProgressEntry => {
		const { dataUrl, ...rest } = stepResponse;
		return {
			...(rest as Omit<QuestProgressEntry, 'submittedAt'>),
			submittedAt,
			...(dataUrl ? { data: dataUrl } : {})
		};
	};

	const getQuestStepAtIndex = (questDefinition: Quest, index: number): QuestStep => {
		const step = questDefinition.steps[index];
		return (Array.isArray(step) ? step[0] : step) as QuestStep;
	};

	const getNextIncompleteStepIndex = (
		questDefinition: Quest,
		progress: (QuestProgressEntry | QuestProgressEntry[])[]
	): number => {
		for (let index = 0; index < questDefinition.steps.length; index++) {
			const step = questDefinition.steps[index];
			const slot = progress[index];

			if (Array.isArray(step)) {
				if (!Array.isArray(slot) || slot.length === 0) return index;
			} else if (!slot || Array.isArray(slot)) {
				return index;
			}
		}

		return -1;
	};

	const setLoadedQuestState = (identifier: string, nextQuestState: UserQuestProgress | null) => {
		quest.set(identifier, nextQuestState);
	};

	const getQuestSyncVersion = (identifier: string) => questSyncVersions.get(identifier) || 0;

	const bumpQuestSyncVersion = (identifier: string) => {
		const nextVersion = getQuestSyncVersion(identifier) + 1;
		questSyncVersions.set(identifier, nextVersion);
		return nextVersion;
	};

	const applyLocalQuestProgress = (
		identifier: string,
		stepResponse: QuestProgressPayload,
		completed: boolean
	) => {
		const currentQuest = quest.get(identifier);
		if (!currentQuest) return;

		const nextProgress = cloneQuestProgress(currentQuest.progress);
		const entry = createQuestProgressEntry(stepResponse, Date.now());

		if (stepResponse.altIndex !== undefined) {
			const existingSlot = nextProgress[stepResponse.index];
			const nextEntries = Array.isArray(existingSlot)
				? [...existingSlot]
				: existingSlot
					? [{ ...existingSlot }]
					: [];
			const existingIndex = nextEntries.findIndex((p) => p.altIndex === stepResponse.altIndex);
			if (existingIndex >= 0) {
				nextEntries[existingIndex] = entry;
			} else {
				nextEntries.push(entry);
			}
			nextProgress[stepResponse.index] = nextEntries;
		} else {
			nextProgress[stepResponse.index] = entry;
		}

		const nextStepIndex = getNextIncompleteStepIndex(currentQuest.quest, nextProgress);
		const isCompleted = completed || nextStepIndex === -1;

		if (isCompleted) {
			const completedAt = entry.submittedAt;
			const nextHistory = new Map(questHistory.get(identifier) || []);
			nextHistory.set(currentQuest.questId, {
				quest: currentQuest.quest,
				questId: currentQuest.questId,
				completedAt,
				progress: nextProgress
			});
			questHistory.set(identifier, nextHistory);
			quest.set(identifier, null);
			bumpQuestSyncVersion(identifier);
			return;
		}

		const currentStepIndex =
			nextStepIndex === -1 ? currentQuest.quest.steps.length - 1 : nextStepIndex;
		const nextStep = getQuestStepAtIndex(currentQuest.quest, currentStepIndex);
		quest.set(identifier, {
			...currentQuest,
			currentStep: nextStep,
			currentStepIndex,
			completed: false,
			progress: nextProgress
		});
		bumpQuestSyncVersion(identifier);
	};

	const get = (identifier: string): User | undefined => {
		if (!identifier) return undefined;
		return cache.get(identifier);
	};

	const has = (identifier: string): boolean => {
		if (!identifier) return false;
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

				if (valid(res)) {
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
		if (!identifier) {
			attendingEvents.set(identifier, []);
			return [];
		}
		const authStore = useAuthStore();
		const res = await paginatedAPIRequest<Event>(
			`/v2/users/${identifier}/events/attending`,
			authStore.sessionToken
		);

		if (valid(res)) {
			attendingEvents.set(identifier, res.data);
			return res.data;
		}

		attendingEvents.set(identifier, []);
		return [];
	};

	const fetchHostingEvents = async (identifier: string): Promise<Event[]> => {
		if (!identifier) {
			hostingEvents.set(identifier, []);
			return [];
		}
		const authStore = useAuthStore();
		const res = await paginatedAPIRequest<Event>(
			`/v2/users/${identifier}/events`,
			authStore.sessionToken
		);

		if (valid(res)) {
			hostingEvents.set(identifier, res.data);
			return res.data;
		}

		hostingEvents.set(identifier, []);
		return [];
	};

	const fetchBadges = async (identifier: string): Promise<UserBadge[]> => {
		if (!identifier) {
			badges.set(identifier, []);
			return [];
		}
		const authStore = useAuthStore();
		const res = await makeAPIRequest<UserBadge[]>(
			`user-${identifier}-badges`,
			`/v2/users/${identifier}/badges`,
			authStore.sessionToken
		);

		if (valid(res)) {
			badges.set(identifier, res.data);
			return res.data;
		}

		badges.set(identifier, []);
		return [];
	};

	const fetchEventSubmissions = async (identifier: string): Promise<EventImageSubmission[]> => {
		if (!identifier) {
			eventSubmissions.set(identifier, []);
			return [];
		}
		const authStore = useAuthStore();
		const res = await paginatedAPIRequest<EventImageSubmission>(
			`/v2/users/${identifier}/events/images`,
			authStore.sessionToken
		);

		if (valid(res)) {
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
		if (!identifier) {
			points.set(identifier, 0);
			pointsHistory.set(identifier, []);
			return [0, []];
		}
		const authStore = useAuthStore();
		const res = await makeAPIRequest<{
			points: number;
			history: {
				reason: string;
				difference: number;
				timestamp?: number;
			}[];
		}>(`user-${identifier}-points`, `/v2/users/${identifier}/points`, authStore.sessionToken);

		if (valid(res)) {
			points.set(identifier, res.data.points);
			pointsHistory.set(identifier, res.data.history);
			return [res.data.points, res.data.history];
		}

		points.set(identifier, 0);
		pointsHistory.set(identifier, []);
		return [0, []];
	};

	const fetchUserQuest = async (
		identifier: string,
		force: boolean = false
	): Promise<UserQuestProgress | null> => {
		if (!identifier) {
			quest.delete(identifier);
			return null;
		}

		if (quest.has(identifier)) {
			return quest.get(identifier) || null;
		}

		const authStore = useAuthStore();
		const requestVersion = getQuestSyncVersion(identifier);
		const res = await makeAPIRequest<UserQuestProgress>(
			force ? null : `user-${identifier}-quest`,
			`/v2/users/${identifier}/quest`,
			authStore.sessionToken
		);

		if (valid(res)) {
			if (getQuestSyncVersion(identifier) === requestVersion) {
				quest.set(identifier, res.data);
			}
			return res.data;
		}

		if (getQuestSyncVersion(identifier) === requestVersion) {
			quest.set(identifier, null);
		}

		return quest.get(identifier) || null;
	};

	const fetchQuestStep = async (
		identifier: string,
		index: number
	): Promise<QuestProgressEntry | null> => {
		if (!identifier) return null;
		const authStore = useAuthStore();
		const res = await makeAPIRequest<QuestProgressEntry>(
			`user-${identifier}-quest-step-${index}`,
			`/v2/users/${identifier}/quest/step/${index}`,
			authStore.sessionToken
		);

		if (valid(res)) {
			return res.data;
		}

		return null;
	};

	const startQuest = async (
		identifier: string,
		questId: string,
		override: boolean = false // override existing progress, if any
	): Promise<{ message: string }> => {
		if (!identifier) return { message: 'Invalid identifier' };
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<{ message: string }>(
			`/v2/users/${identifier}/quest?quest_id=${questId}&override=${override}`,
			authStore.sessionToken,
			{
				method: 'POST',
				allowMessageResponse: true
			}
		);

		if (valid(res)) {
			let newQuest: Quest | null = questsCache.get(questId) || null;
			if (!newQuest) {
				newQuest = await fetchQuest(questId);
				if (!newQuest) {
					console.warn(`Started quest ${questId} but failed to fetch quest details`);
				}
			}

			if (newQuest) {
				const firstStep = getQuestStepAtIndex(newQuest, 0);
				setLoadedQuestState(identifier, {
					quest: newQuest,
					questId: questId,
					currentStep: firstStep,
					currentStepIndex: 0,
					completed: false,
					progress: []
				});
				bumpQuestSyncVersion(identifier);
			}
			return res.data;
		}

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
			applyLocalQuestProgress(identifier, stepResponse, res.data.completed);
		}

		return res.data;
	};

	const endQuest = async (identifier: string): Promise<{ message: string }> => {
		if (!identifier) return { message: 'Invalid identifier' };
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<{ message: string }>(
			`/v2/users/${identifier}/quest`,
			authStore.sessionToken,
			{
				method: 'DELETE',
				allowMessageResponse: true
			}
		);

		if (valid(res)) {
			setLoadedQuestState(identifier, null);
			bumpQuestSyncVersion(identifier);
			return res.data;
		}

		return { message: res.data?.message || res.message || 'Failed to end quest' };
	};

	const fetchQuestHistory = async (identifier: string): Promise<Map<string, QuestHistoryEntry>> => {
		if (!identifier) {
			const map = new Map();
			questHistory.set(identifier, map);
			return map;
		}

		if (questHistory.has(identifier)) {
			return questHistory.get(identifier) || new Map();
		}

		const authStore = useAuthStore();
		const requestVersion = getQuestSyncVersion(identifier);
		const res = await makeAPIRequest<{
			total: number;
			history: { [questId: string]: QuestHistoryEntry };
		}>(
			`user-${identifier}-quest-history`,
			`/v2/users/${identifier}/quest/history`,
			authStore.sessionToken
		);

		if (valid(res)) {
			const map = new Map(Object.entries(res.data.history));
			if (getQuestSyncVersion(identifier) === requestVersion) {
				questHistory.set(identifier, map);
				return map;
			}

			return questHistory.get(identifier) || map;
		}

		const map = new Map();
		if (getQuestSyncVersion(identifier) === requestVersion) {
			questHistory.set(identifier, map);
			return map;
		}

		return questHistory.get(identifier) || map;
	};

	const fetchQuestsList = async (): Promise<Quest[]> => {
		const authStore = useAuthStore();
		const res = await makeAPIRequest<{ total: number; quests: Quest[] }>(
			'quests',
			'/v2/users/quests',
			authStore.sessionToken
		);

		if (valid(res)) {
			const nextQuests = new Set<string>();
			for (const quest of res.data.quests) {
				nextQuests.add(quest.id);
				questsCache.set(quest.id, quest);
			}
			questsList.value = nextQuests;
			return res.data.quests;
		}

		questsList.value = new Set();
		return [];
	};

	const fetchQuest = async (questId: string): Promise<Quest | null> => {
		const authStore = useAuthStore();
		const res = await makeAPIRequest<Quest>(
			`quest-${questId}`,
			`/v2/users/quests?id=${questId}`,
			authStore.sessionToken
		);

		const quest = valid(res) ? res.data : null;
		if (quest) {
			questsCache.set(quest.id, quest);
			if (questsList.value) {
				questsList.value.add(quest.id);
			}
		}

		return quest;
	};

	const setAccountType = async (identifier: string, type: User['account']['account_type']) => {
		if (!identifier)
			return Promise.resolve({ success: false, message: 'Invalid identifier' } as any);
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<User>(
			`/v2/users/${identifier}/account_type?type=${type.toLowerCase()}`,
			authStore.sessionToken,
			{
				method: 'PUT'
			}
		);

		if (valid(res)) {
			cache.set(res.data.id, res.data);

			if (res.data.username) {
				cache.set(res.data.username, res.data);
				cache.set(`@${res.data.username}`, res.data);
			}

			if (
				identifier &&
				identifier !== res.data.id &&
				identifier !== res.data.username &&
				identifier !== `@${res.data.username}`
			) {
				cache.set(identifier, res.data);
			}

			const avatarStore = useAvatarStore();
			avatarStore.preloadAvatar(res.data.account?.avatar_url);
		}

		return res;
	};

	const clear = (identifier?: string) => {
		if (identifier) {
			bumpQuestSyncVersion(identifier);
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
			for (const key of questSyncVersions.keys()) {
				questSyncVersions.set(key, getQuestSyncVersion(key) + 1);
			}
			questsCache.clear();
			questsList.value = null;
		}
	};

	return {
		cache,
		users,
		attendingEvents,
		hostingEvents,
		badges,
		eventSubmissions,
		points,
		pointsHistory,
		quest,
		questHistory,
		questsList,
		questsCache,
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
		fetchUserQuest,
		fetchQuestStep,
		startQuest,
		updateQuest,
		endQuest,
		fetchQuestHistory,
		fetchQuestsList,
		fetchQuest,
		setAccountType,
		clear
	};
});
