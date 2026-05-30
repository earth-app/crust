import { defineStore } from 'pinia';
import type { Event } from 'types/event';
import { BadgeMasteryGenerationError, type BadgeMasteryStatus, type MasteryList } from 'types/user';
import { computed, reactive, ref } from 'vue';
import { useAuthStore } from './auth';
import { useAvatarStore } from './avatar';

// reject anything that doesn't look like a real user at the store boundary
export const isValidUser = (u: unknown): u is User => {
	if (!u || typeof u !== 'object' || Array.isArray(u)) return false;
	const usr = u as Partial<User>;
	return typeof usr.id === 'string' && !!usr.id && typeof usr.username === 'string';
};

export const useUserStore = defineStore('user', () => {
	const cache = reactive(new Map<string, User | null>());
	const loading = reactive(new Set<string>());
	const users = computed(() => {
		const seen = new Set<string>();
		const entries: User[] = [];

		for (const user of cache.values()) {
			if (!user) continue;
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

	const masteryStatuses = reactive(new Map<string, BadgeMasteryStatus>());
	const masteryLoading = reactive(new Set<string>());
	const lockedMasteries = reactive(new Set<string>());
	// per-user mastery list (cap + items); populated by fetchMasteryList. badges page reads
	// from here directly, card.vue uses it to disable the generate cta at the cap
	const masteryLists = reactive(new Map<string, MasteryList>());
	const masteryListLoading = reactive(new Set<string>());

	const masteryKey = (userId: string, badgeId: string) => `${userId}:${badgeId}`;
	const masteryQuestId = (badgeId: string) => `badge_mastery_${badgeId}`;

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

	const get = (identifier: string): User | null | undefined => {
		if (!identifier) return undefined;
		// While a fetch is in flight and nothing valid has been seen yet,
		// return `undefined` so consumers stay in the "loading" branch
		// instead of flipping to "not found" mid-refetch.
		if (loading.has(identifier) && !cache.get(identifier)) return undefined;
		return cache.get(identifier);
	};

	const has = (identifier: string): boolean => {
		if (!identifier) return false;
		return cache.has(identifier);
	};

	const isLoading = (identifier: string | null | undefined): boolean => {
		if (!identifier) return false;
		return loading.has(identifier);
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

		loading.add(identifier);

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

				if (valid(res) && isValidUser(res.data)) {
					cache.set(identifier, res.data);

					const avatarStore = useAvatarStore();
					avatarStore.preloadAvatar(res.data.account?.avatar_url);
				} else {
					cache.set(identifier, null);
					if (valid(res)) {
						console.warn(`Malformed user payload for ${identifier} — treating as not found`);
					} else if (res.message) {
						console.warn(`Failed to fetch user ${identifier}:`, res.message);
					}
				}
			} catch (error) {
				cache.set(identifier, null);
				console.warn(`Failed to fetch user ${identifier}:`, error);
			} finally {
				loading.delete(identifier);
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

	const getChipColor = (user: User | null | undefined) => {
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

	const getMaxEventAttendees = (user: User | null | undefined): number => {
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
		lng: number | null,
		serverRequest: typeof makeServerRequest = makeServerRequest
	): Promise<{ message: string; completed: boolean; validated: boolean }> => {
		const authStore = useAuthStore();

		const res = await serverRequest<{
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

	const getMasteryStatus = async (
		userId: string,
		badgeId: string
	): Promise<BadgeMasteryStatus | null> => {
		if (!userId || !badgeId) return null;
		const authStore = useAuthStore();
		const cacheKey = masteryKey(userId, badgeId);
		masteryLoading.add(cacheKey);
		try {
			const res = await makeAPIRequest<BadgeMasteryStatus>(
				`user-${userId}-badge-${badgeId}-mastery`,
				`/v2/users/${userId}/badges/${badgeId}/mastery`,
				authStore.sessionToken
			);

			if (valid(res)) {
				masteryStatuses.set(cacheKey, res.data);
				if (res.data.locked) lockedMasteries.add(badgeId);
				if (res.data.quest) questsCache.set(res.data.quest.id, res.data.quest);
				return res.data;
			}

			return null;
		} finally {
			masteryLoading.delete(cacheKey);
		}
	};

	const fetchMasteryList = async (userId: string): Promise<MasteryList | null> => {
		if (!userId) return null;
		const authStore = useAuthStore();
		masteryListLoading.add(userId);
		try {
			const res = await makeAPIRequest<MasteryList>(
				`user-${userId}-mastery-list`,
				`/v2/users/${userId}/badges/masteries`,
				authStore.sessionToken
			);
			if (valid(res)) {
				masteryLists.set(userId, res.data);
				// cache the quest objects so the badges page can open them without re-fetch
				for (const item of res.data.items) {
					questsCache.set(item.quest.id, item.quest);
				}
				return res.data;
			}
			return null;
		} finally {
			masteryListLoading.delete(userId);
		}
	};

	const generateMastery = async (userId: string, badgeId: string): Promise<Quest> => {
		if (!userId || !badgeId) {
			throw new BadgeMasteryGenerationError('unknown', 'Invalid identifier');
		}
		if (lockedMasteries.has(badgeId)) {
			throw new BadgeMasteryGenerationError('locked', 'Mastery permanently locked');
		}
		// preflight cap check using cached list when available; saves a round trip when the
		// user clearly can't generate (server still rejects authoritatively as a backstop)
		const cachedList = masteryLists.get(userId);
		if (cachedList && cachedList.active >= cachedList.cap) {
			throw new BadgeMasteryGenerationError(
				'cap_reached',
				`Active mastery cap reached (${cachedList.cap}). Complete or wait for one to expire.`,
				400
			);
		}

		const authStore = useAuthStore();
		const config = useRuntimeConfig();
		const url = `${config.public.apiBaseUrl}/v2/users/${userId}/badges/${badgeId}/mastery/generate`;
		const cacheKey = masteryKey(userId, badgeId);
		masteryLoading.add(cacheKey);

		try {
			const quest = await $fetch<Quest>(url, {
				method: 'POST',
				headers: authStore.sessionToken
					? { Authorization: `Bearer ${authStore.sessionToken}` }
					: undefined
			});

			questsCache.set(quest.id, quest);
			if (questsList.value) {
				questsList.value.add(quest.id);
			}

			const nextStatus: BadgeMasteryStatus = {
				generated: true,
				locked: false,
				mastered: false,
				mastered_at: null,
				quest
			};
			masteryStatuses.set(cacheKey, nextStatus);
			// refresh the cap snapshot - fire-and-forget so the badges page sees the new slot
			fetchMasteryList(userId);

			return quest;
		} catch (error: any) {
			const status =
				error?.status ?? error?.statusCode ?? error?.response?.status ?? error?.data?.code;
			const message =
				error?.data?.message || error?.message || 'Failed to generate badge mastery quest.';

			if (status === 410) {
				lockedMasteries.add(badgeId);
				const current = masteryStatuses.get(cacheKey);
				masteryStatuses.set(cacheKey, {
					generated: current?.generated ?? false,
					locked: true,
					mastered: current?.mastered ?? false,
					mastered_at: current?.mastered_at ?? null,
					exempt: current?.exempt ?? false,
					quest: current?.quest ?? null
				});
				throw new BadgeMasteryGenerationError('locked', message, 410);
			}
			if (status === 400) {
				// mantle2 collapses two upstream reasons into a single 400: exempt badge OR
				// active-mastery cap reached. discriminate on the message so the ui can show
				// the right toast (and avoid wrongly marking the badge as exempt for cap hits)
				if (/cap reached/i.test(message)) {
					// refresh the cached list so the disabled state sticks even if preflight missed
					fetchMasteryList(userId);
					throw new BadgeMasteryGenerationError('cap_reached', message, 400);
				}
				const current = masteryStatuses.get(cacheKey);
				masteryStatuses.set(cacheKey, {
					generated: current?.generated ?? false,
					locked: current?.locked ?? false,
					mastered: current?.mastered ?? false,
					mastered_at: current?.mastered_at ?? null,
					exempt: true,
					quest: current?.quest ?? null
				});
				throw new BadgeMasteryGenerationError('exempt', message, 400);
			}
			if (status === 409) {
				throw new BadgeMasteryGenerationError('conflict', message, 409);
			}
			if (status === 500) {
				throw new BadgeMasteryGenerationError('ai_failed', message, 500);
			}

			throw new BadgeMasteryGenerationError('unknown', message, status);
		} finally {
			masteryLoading.delete(cacheKey);
		}
	};

	const getMasteryQuest = async (badgeId: string): Promise<Quest | null> => {
		if (!badgeId) return null;
		const id = masteryQuestId(badgeId);
		const cached = questsCache.get(id);
		if (cached) return cached;
		return await fetchQuest(id);
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
			loading.delete(identifier);
			attendingEvents.delete(identifier);
			hostingEvents.delete(identifier);
			badges.delete(identifier);
			eventSubmissions.delete(identifier);
			points.delete(identifier);
			pointsHistory.delete(identifier);
			quest.delete(identifier);
			questHistory.delete(identifier);
			const prefix = `${identifier}:`;
			for (const key of [...masteryStatuses.keys()]) {
				if (key.startsWith(prefix)) masteryStatuses.delete(key);
			}
			for (const key of [...masteryLoading]) {
				if (key.startsWith(prefix)) masteryLoading.delete(key);
			}
			masteryLists.delete(identifier);
			masteryListLoading.delete(identifier);
		} else {
			cache.clear();
			loading.clear();
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
			masteryStatuses.clear();
			masteryLoading.clear();
			masteryLists.clear();
			masteryListLoading.clear();
			lockedMasteries.clear();
		}
	};

	return {
		cache,
		loading,
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
		isLoading,
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
		masteryStatuses,
		masteryLoading,
		masteryLists,
		masteryListLoading,
		lockedMasteries,
		getMasteryStatus,
		generateMastery,
		fetchMasteryList,
		getMasteryQuest,
		setAccountType,
		clear
	};
});
