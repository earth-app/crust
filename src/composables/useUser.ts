import { DateTime } from 'luxon';
import { useAuthStore } from 'stores/auth';
import { useAvatarStore } from 'stores/avatar';
import { useFriendsStore } from 'stores/friends';
import { useNotificationStore } from 'stores/notification';
import { useUserStore } from 'stores/user';
import { BadgeMasteryGenerationError, type OAuthProvider } from 'types/user';
import type { MaybeRefOrGetter } from 'vue';

// #region visited site

export function useVisitedSite() {
	const visitedSiteCookie = useCookie<boolean | string | null>('visited_site', {
		sameSite: 'lax',
		secure: true,
		maxAge: 60 * 60 * 24 * 365 * 5 // 5 years
	});

	if (visitedSiteCookie.value != null && visitedSiteCookie.value !== true) {
		visitedSiteCookie.value = true;
	}

	const visitedSite = computed(() => visitedSiteCookie.value != null);

	const markVisited = () => {
		visitedSiteCookie.value = true;
	};

	return {
		visitedSite,
		visitedSiteCookie,
		markVisited
	};
}

// #region avatar and user

export function useDisplayName(
	user: MaybeRefOrGetter<
		| Pick<User, 'full_name' | 'username'>
		| { full_name?: string; username?: string }
		| null
		| undefined
	>,
	opts?: { anonymous?: string }
) {
	const name = computed(() => getUserDisplayName(toValue(user), { anonymous: opts?.anonymous }));
	const handle = computed(() =>
		getUserDisplayName(toValue(user), { at: true, anonymous: opts?.anonymous })
	);
	const fullName = computed(() => realFullName(toValue(user)?.full_name));
	const hasFullName = computed(() => !!fullName.value);

	return { name, handle, fullName, hasFullName };
}

export function useAuth(serverRequest: typeof makeServerRequest = makeServerRequest) {
	const authStore = useAuthStore();
	const avatarStore = useAvatarStore();

	const user = computed(() => authStore.currentUser);
	const avatarUrl = computed(() => user.value?.account?.avatar_url);

	const isRemoteUrl = (url: string | undefined | null): boolean => {
		if (!url) return false;
		return url.startsWith('http://') || url.startsWith('https://');
	};

	// While the blob fetch is in flight, return the remote URL with a size
	const avatar = computed(() => avatarStore.safeUrl(avatarUrl.value, 'avatar'));
	const avatar32 = computed(() => avatarStore.safeUrl(avatarUrl.value, 'avatar32'));
	const avatar128 = computed(() => avatarStore.safeUrl(avatarUrl.value, 'avatar128'));
	const isAvatarLoading = computed(() => avatarStore.isLoading(avatarUrl.value));

	if (import.meta.client) {
		watch(
			avatarUrl,
			(newUrl) => {
				if (!newUrl || !isRemoteUrl(newUrl)) return;
				avatarStore.preloadAvatar(newUrl);
			},
			{ immediate: true }
		);
	}

	const fetchUser = async (force: boolean = false) => {
		return await authStore.fetchCurrentUser(force);
	};

	const sendVerificationEmail = async () => {
		return await makeClientAPIRequest<{ message: string; email: string }>(
			`/v2/users/current/send_email_verification`,
			authStore.sessionToken,
			{
				method: 'POST'
			}
		);
	};

	const verifyEmail = async (code: string) => {
		return await makeClientAPIRequest<{ message: string; email: string }>(
			`/v2/users/current/verify_email?code=${code}`,
			authStore.sessionToken,
			{
				method: 'POST'
			}
		);
	};

	const changePassword = async (currentPassword: string, newPassword: string) => {
		return await makeClientAPIRequest<{ message: string }>(
			`/v2/users/current/change_password?old_password=${encodeURIComponent(currentPassword)}`,
			authStore.sessionToken,
			{
				method: 'POST',
				body: {
					new_password: newPassword
				}
			}
		);
	};

	const sendResetPasswordEmail = async (email: string) => {
		return await makeAPIRequest<void>(
			`reset-password-email-${email}`,
			`/v2/users/reset_password?email=${encodeURIComponent(email)}`,
			null,
			{
				method: 'POST'
			}
		);
	};

	const resetPassword = async (
		id: string,
		token: string,
		newPassword: string
	): Promise<{ success: boolean; message?: string; status?: number }> => {
		const config = useRuntimeConfig();
		const url = `${config.public.apiBaseUrl}/v2/users/${id}/change_password?token=${encodeURIComponent(token)}`;
		try {
			const response = await $fetch.raw<{ message?: string }>(url, {
				method: 'POST',
				body: { new_password: newPassword },
				ignoreResponseError: true
			});
			const status = response.status;
			const body = response._data ?? {};
			if (status >= 200 && status < 300) {
				return { success: true, message: body.message, status };
			}
			return {
				success: false,
				message: body.message || `Failed to reset password (${status})`,
				status
			};
		} catch (e: any) {
			return {
				success: false,
				message: e?.data?.message || e?.message || 'Network error during password reset'
			};
		}
	};

	const deleteAccount = async (password?: string | null) => {
		const body = password ? { password } : {};
		return await makeClientAPIRequest<void>(`/v2/users/current`, authStore.sessionToken, {
			method: 'DELETE',
			body
		});
	};

	const getReauthState = async () => {
		return await makeClientAPIRequest<{
			recently_authenticated: boolean;
			expires_at: number | null;
			window_seconds: number;
		}>(`/v2/users/current/reauth_state`, authStore.sessionToken, {
			method: 'GET'
		});
	};

	const canDeleteWithoutReauth = async () => {
		const res = await getReauthState();
		if (!valid(res)) return false;
		return Boolean(res.data.recently_authenticated);
	};

	const reauthWithPassword = async (password: string) => {
		return await makeClientAPIRequest<{
			recently_authenticated: boolean;
			expires_at: number;
			window_seconds: number;
		}>(`/v2/users/current/reauth/password`, authStore.sessionToken, {
			method: 'POST',
			body: { password }
		});
	};

	const reauthWithOAuth = async (
		provider: OAuthProvider,
		tokens: { id_token?: string; access_token?: string }
	) => {
		return await makeClientAPIRequest<{
			recently_authenticated: boolean;
			expires_at: number;
			window_seconds: number;
			provider: string;
		}>(`/v2/users/current/reauth/oauth`, authStore.sessionToken, {
			method: 'POST',
			body: { provider, ...tokens }
		});
	};

	const fetchCurrentJourney = async (identifier: string, id: string) => {
		if (!id) return { success: true, data: { count: 0 } };

		return await serverRequest<{ count: number; lastWrite?: number }>(
			`journey-${identifier}`,
			`/api/user/journey?type=${encodeURIComponent(identifier)}&id=${encodeURIComponent(id)}`,
			authStore.sessionToken
		);
	};

	const tapCurrentJourney = async (identifier: string, activity?: string) => {
		const activityQuery = activity ? `&activity=${encodeURIComponent(activity)}` : '';

		const res = await serverRequest<{ count: number; incremented: boolean }>(
			null,
			`/api/user/journey?type=${encodeURIComponent(identifier)}${activityQuery}`,
			authStore.sessionToken,
			{
				method: 'POST'
			}
		);

		if (valid(res) && res.data.incremented) {
			window.dispatchEvent(
				new CustomEvent('earth-app:journey-updated', {
					detail: {
						type: identifier,
						activity: activity ?? null,
						count: res.data.count
					}
				})
			);
		}

		return res;
	};

	const clearCurrentJourney = async (identifier: string) => {
		return await serverRequest<void>(
			null,
			`/api/user/journey?type=${encodeURIComponent(identifier)}`,
			authStore.sessionToken,
			{
				method: 'DELETE'
			}
		);
	};

	const fetchCurrentJourneyRank = async (type: string, id: string) => {
		return await serverRequest<{ rank: number }>(
			`journey-rank-${type}`,
			`/api/user/journeyRank?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`,
			authStore.sessionToken
		);
	};

	const updateAccount = async (account: Partial<User['account']>) => {
		return await makeClientAPIRequest<User>('/v2/users/current', authStore.sessionToken, {
			method: 'PATCH',
			body: account
		});
	};

	const updateFieldPrivacy = async (privacy: Partial<User['account']['field_privacy']>) => {
		return await makeClientAPIRequest<User>(
			'/v2/users/current/field_privacy',
			authStore.sessionToken,
			{
				method: 'PATCH',
				body: privacy
			}
		);
	};

	const regenerateAvatar = async (): Promise<{
		success: boolean;
		data?: Blob;
		message?: string;
	}> => {
		// direct $fetch (not makeClientAPIRequest) so we can read FetchError.data on 500;
		// 60s ceiling so the ui never hangs on a stalled sdxl call
		const config = useRuntimeConfig();
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 60_000);

		try {
			const headers: Record<string, string> = {};
			if (authStore.sessionToken) {
				headers['Authorization'] = `Bearer ${authStore.sessionToken}`;
			}

			const blob = await $fetch<Blob>(
				`${config.public.apiBaseUrl}/v2/users/current/profile_photo`,
				{
					method: 'PUT',
					responseType: 'blob',
					headers,
					signal: controller.signal
				}
			);

			// clear avatar cache to force refetch
			const currentAvatarUrl = authStore.currentUser?.account?.avatar_url || avatarUrl.value;
			if (currentAvatarUrl) {
				avatarStore.clear(currentAvatarUrl);
			}

			return { success: true, data: blob };
		} catch (err: any) {
			const aborted = err?.name === 'AbortError' || controller.signal.aborted;
			const fallback = aborted
				? 'Avatar generation timed out - please try again in a moment.'
				: 'Avatar generation failed';
			const message =
				(err?.data && typeof err.data === 'object' && typeof err.data.message === 'string'
					? err.data.message
					: null) ||
				(typeof err?.statusMessage === 'string' ? err.statusMessage : null) ||
				fallback;

			return { success: false, message };
		} finally {
			clearTimeout(timeoutId);
		}
	};

	const setUserActivities = async (activities: string[]) => {
		return await makeClientAPIRequest<User>(
			'/v2/users/current/activities',
			authStore.sessionToken,
			{
				method: 'PATCH',
				body: activities
			}
		);
	};

	const fetchRecommendedActivities = async (poolLimit: number = 25) => {
		const res = await makeAPIRequest<Activity[]>(
			'recommended_activities',
			`/v2/users/current/activities/recommend?pool_limit=${poolLimit}`,
			authStore.sessionToken,
			{}
		);

		if (valid(res)) {
			// load recommended activities into state
			for (const activity of res.data) {
				useState<Activity | null>(`activity-${activity.id}`, () => activity);
			}
		}

		return res;
	};

	return {
		user,
		fetchUser,
		avatar,
		avatar32,
		avatar128,
		isAvatarLoading,
		sendVerificationEmail,
		verifyEmail,
		changePassword,
		sendResetPasswordEmail,
		resetPassword,
		deleteAccount,
		getReauthState,
		canDeleteWithoutReauth,
		reauthWithPassword,
		reauthWithOAuth,
		fetchCurrentJourney,
		tapCurrentJourney,
		clearCurrentJourney,
		fetchCurrentJourneyRank,
		updateAccount,
		updateFieldPrivacy,
		regenerateAvatar,
		setUserActivities,
		fetchRecommendedActivities
	};
}

export function useUsers() {
	const userStore = useUserStore();
	const authStore = useAuthStore();
	const avatarStore = useAvatarStore();

	const users = computed(() => userStore.users);

	const fetch = async (
		page: number = 1,
		limit: number = 25,
		search: string = '',
		sort: SortingOption = 'desc'
	) => {
		const res = await makeAPIRequest<{ items: User[]; total: number }>(
			`users-${search}-${page}-${limit}-${sort}`,
			`/v2/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&sort=${sort}`,
			authStore.sessionToken
		);

		if (valid(res) && Array.isArray(res.data.items)) {
			for (const user of res.data.items) {
				userStore.cache.set(user.id, user);
				if (user.username) {
					userStore.cache.set(user.username, user);
					userStore.cache.set(`@${user.username}`, user);
				}

				avatarStore.preloadAvatar(user.account?.avatar_url);
			}
		}

		return res;
	};

	const fetchAll = async (
		limit: number = 25,
		search: string = '',
		sort: SortingOption = 'desc'
	) => {
		const res = await paginatedAPIRequest<User>(
			`/v2/users`,
			authStore.sessionToken,
			{},
			limit,
			search,
			sort
		);

		if (valid(res)) {
			for (const user of res.data) {
				userStore.cache.set(user.id, user);

				if (user.username) {
					userStore.cache.set(user.username, user);
					userStore.cache.set(`@${user.username}`, user);
				}

				avatarStore.preloadAvatar(user.account?.avatar_url);
			}
		}

		return res;
	};

	return {
		users,
		fetch,
		fetchAll
	};
}

export function useUser(
	identifier?: MaybeRefOrGetter<string | null | undefined>,
	serverRequest?: typeof makeServerRequest
) {
	const userStore = useUserStore();
	const avatarStore = useAvatarStore();
	const currentIdentifier = () => toValue(identifier);
	const user = computed(() => {
		const resolvedIdentifier = currentIdentifier();
		return !resolvedIdentifier ? undefined : userStore.get(resolvedIdentifier);
	});

	const fetchUser = async (force: boolean = false) => {
		const resolvedIdentifier = currentIdentifier();
		if (!resolvedIdentifier) return null;
		return await userStore.fetchUser(resolvedIdentifier, force);
	};

	const avatarUrl = computed(() => user.value?.account?.avatar_url);

	const isRemoteUrl = (url: string | undefined | null): boolean => {
		if (!url) return false;
		return url.startsWith('http://') || url.startsWith('https://');
	};

	if (import.meta.client) {
		watch(
			avatarUrl,
			(newUrl) => {
				if (!newUrl || !isRemoteUrl(newUrl)) return;
				avatarStore.preloadAvatar(newUrl);
			},
			{ immediate: true }
		);
	}

	const avatar = computed(() => avatarStore.safeUrl(avatarUrl.value, 'avatar'));
	const avatar32 = computed(() => avatarStore.safeUrl(avatarUrl.value, 'avatar32'));
	const avatar128 = computed(() => avatarStore.safeUrl(avatarUrl.value, 'avatar128'));
	const isAvatarLoading = computed(() => avatarStore.isLoading(avatarUrl.value));

	const fetchAvatar = async (force: boolean = false) => {
		const url = avatarUrl.value;
		if (!url || !isRemoteUrl(url)) return;

		if (!force) {
			const cached = avatarStore.get(url);
			if (cached) return cached;
		}

		return await avatarStore.fetchAvatarBlobs(url);
	};

	const cosmetics = computed(() => {
		const resolvedIdentifier = currentIdentifier();
		return !resolvedIdentifier
			? { current: null, unlocked: [] }
			: avatarStore.userCosmetics.get(resolvedIdentifier) || { current: null, unlocked: [] };
	});
	const fetchCosmetics = async () => {
		const resolvedIdentifier = currentIdentifier();
		if (!resolvedIdentifier) return null;
		return await avatarStore.fetchCosmeticsForUser(resolvedIdentifier);
	};

	const chipColor = computed(() => userStore.getChipColor(user.value));
	const maxEventAttendees = computed(() => userStore.getMaxEventAttendees(user.value));

	const attendingEvents = computed(() => {
		const resolvedIdentifier = currentIdentifier();
		return !resolvedIdentifier ? [] : userStore.attendingEvents.get(resolvedIdentifier) || [];
	});
	const attendingEventsCount = computed(() => attendingEvents.value.length);
	const fetchAttendingEvents = async () => {
		const resolvedIdentifier = currentIdentifier();
		if (!resolvedIdentifier) return [];
		return await userStore.fetchAttendingEvents(resolvedIdentifier);
	};

	const currentEvents = computed(() => {
		const resolvedIdentifier = currentIdentifier();
		return !resolvedIdentifier ? [] : userStore.hostingEvents.get(resolvedIdentifier) || [];
	});
	const currentEventsCount = computed(() => currentEvents.value.length);
	const fetchCurrentEvents = async () => {
		const resolvedIdentifier = currentIdentifier();
		if (!resolvedIdentifier) return [];
		return await userStore.fetchHostingEvents(resolvedIdentifier);
	};

	const badges = computed(() => {
		const resolvedIdentifier = currentIdentifier();
		return !resolvedIdentifier ? [] : userStore.badges.get(resolvedIdentifier) || [];
	});
	const grantedBadges = computed(() => badges.value.filter((b) => b.granted));
	const fetchBadges = async () => {
		const resolvedIdentifier = currentIdentifier();
		if (!resolvedIdentifier) return [];
		return await userStore.fetchBadges(resolvedIdentifier);
	};

	const eventSubmissions = computed(() => {
		const resolvedIdentifier = currentIdentifier();
		return !resolvedIdentifier ? [] : userStore.eventSubmissions.get(resolvedIdentifier) || [];
	});
	const fetchEventSubmissions = async () => {
		const resolvedIdentifier = currentIdentifier();
		if (!resolvedIdentifier) return [];
		return await userStore.fetchEventSubmissions(resolvedIdentifier);
	};

	const points = computed(() => {
		const resolvedIdentifier = currentIdentifier();
		return !resolvedIdentifier ? 0 : userStore.points.get(resolvedIdentifier) || 0;
	});
	const pointsHistory = computed(() => {
		const resolvedIdentifier = currentIdentifier();
		return !resolvedIdentifier ? [] : userStore.pointsHistory.get(resolvedIdentifier) || [];
	});
	const fetchPoints = async () => {
		const resolvedIdentifier = currentIdentifier();
		if (!resolvedIdentifier) return [0, []] as [number, ImpactPointsChange[]];
		return await userStore.fetchPoints(resolvedIdentifier);
	};

	const quest = computed(() => {
		const resolvedIdentifier = currentIdentifier();
		return !resolvedIdentifier ? null : userStore.quest.get(resolvedIdentifier);
	});
	const fetchUserQuest = async (force: boolean = false) => {
		const resolvedIdentifier = currentIdentifier();
		if (!resolvedIdentifier) return null;
		return await userStore.fetchUserQuest(resolvedIdentifier, force);
	};
	const fetchQuestStep = async (index: number) => {
		const resolvedIdentifier = currentIdentifier();
		if (!resolvedIdentifier) return null;
		return await userStore.fetchQuestStep(resolvedIdentifier, index);
	};
	const startQuest = async (questId: string, override: boolean = false) => {
		const resolvedIdentifier = currentIdentifier();
		if (!resolvedIdentifier) return { message: 'Invalid identifier' };
		return await userStore.startQuest(resolvedIdentifier, questId, override);
	};
	const updateQuest = async (
		stepResponse: {
			type: string;
			index: number;
			altIndex?: number;
			dataUrl?: string;
			[x: string]: any;
		},
		lat: number | null,
		lng: number | null
	) => {
		const resolvedIdentifier = currentIdentifier();
		if (!resolvedIdentifier)
			return { message: 'Invalid identifier', completed: false, validated: false } as {
				message: string;
				completed: boolean;
				validated: boolean;
			};
		return await userStore.updateQuest(resolvedIdentifier, stepResponse, lat, lng, serverRequest);
	};
	const endQuest = async () => {
		const resolvedIdentifier = currentIdentifier();
		if (!resolvedIdentifier) return { message: 'Invalid identifier' };
		return await userStore.endQuest(resolvedIdentifier);
	};
	const questHistory = computed(() => {
		const resolvedIdentifier = currentIdentifier();
		return !resolvedIdentifier
			? new Map<string, QuestHistoryEntry>()
			: userStore.questHistory.get(resolvedIdentifier) || new Map<string, QuestHistoryEntry>();
	});
	const fetchQuestHistory = async (
		opts: { page?: number; limit?: number; search?: string; force?: boolean } = {}
	) => {
		const resolvedIdentifier = currentIdentifier();
		if (!resolvedIdentifier) return new Map<string, QuestHistoryEntry>();
		return await userStore.fetchQuestHistory(resolvedIdentifier, opts);
	};
	const fetchQuestHistoryEntry = async (questId: string, opts: { force?: boolean } = {}) => {
		const resolvedIdentifier = currentIdentifier();
		if (!resolvedIdentifier) return null;
		return await userStore.fetchQuestHistoryEntry(resolvedIdentifier, questId, opts);
	};

	const setAccountType = async (type: User['account']['account_type']) => {
		const resolvedIdentifier = currentIdentifier();
		if (!resolvedIdentifier)
			return Promise.resolve({ success: false, message: 'Invalid identifier' } as any);
		return await userStore.setAccountType(resolvedIdentifier, type);
	};

	const masteryList = computed(() => {
		const resolvedIdentifier = currentIdentifier();
		return !resolvedIdentifier ? null : userStore.masteryLists.get(resolvedIdentifier) || null;
	});
	const fetchMasteryList = async () => {
		const resolvedIdentifier = currentIdentifier();
		if (!resolvedIdentifier) return null;
		return await userStore.fetchMasteryList(resolvedIdentifier);
	};
	const getMasteryStatus = async (badgeId: string) => {
		const resolvedIdentifier = currentIdentifier();
		if (!resolvedIdentifier) return null;
		const resolvedUser = await userStore.fetchUser(resolvedIdentifier);
		const ownerId = resolvedUser?.id || resolvedIdentifier;
		return await userStore.getMasteryStatus(ownerId, badgeId);
	};
	const generateMastery = async (badgeId: string) => {
		const resolvedIdentifier = currentIdentifier();
		if (!resolvedIdentifier) {
			throw new BadgeMasteryGenerationError('unknown', 'Invalid identifier');
		}
		const resolvedUser = await userStore.fetchUser(resolvedIdentifier);
		const ownerId = resolvedUser?.id || resolvedIdentifier;
		return await userStore.generateMastery(ownerId, badgeId);
	};
	const getMasteryQuest = async (badgeId: string) => await userStore.getMasteryQuest(badgeId);
	const isMasteryLocked = (badgeId: string) => userStore.lockedMasteries.has(badgeId);

	return {
		user,
		fetchUser,
		avatar,
		avatar32,
		avatar128,
		isAvatarLoading,
		fetchAvatar,
		cosmetics,
		fetchCosmetics,
		chipColor,
		maxEventAttendees,
		attendingEvents,
		attendingEventsCount,
		fetchAttendingEvents,
		currentEvents,
		currentEventsCount,
		fetchCurrentEvents,
		badges,
		grantedBadges,
		fetchBadges,
		eventSubmissions,
		fetchEventSubmissions,
		points,
		pointsHistory,
		fetchPoints,
		quest,
		fetchUserQuest,
		fetchQuestStep,
		startQuest,
		updateQuest,
		endQuest,
		questHistory,
		fetchQuestHistory,
		fetchQuestHistoryEntry,
		setAccountType,
		masteryList,
		fetchMasteryList,
		getMasteryStatus,
		generateMastery,
		getMasteryQuest,
		isMasteryLocked
	};
}

// #region quests

export function useQuests() {
	const userStore = useUserStore();
	const quests = computed(() => {
		if (userStore.questsList === null) return null;

		return Array.from(userStore.questsList)
			.map((questId) => userStore.questsCache.get(questId))
			.filter((quest): quest is Quest => quest !== undefined);
	});
	const fetchQuest = async (questId: string) => await userStore.fetchQuest(questId);
	const fetchQuests = async () => await userStore.fetchQuestsList();

	const getStepIcon = (step: string) => {
		switch (step) {
			case 'take_photo_location':
				return 'mdi:camera-marker';
			case 'take_photo_classification':
				return 'mdi:camera-enhance';
			case 'take_photo_caption':
				return 'mdi:camera-image';
			case 'take_photo_objects':
				return 'mdi:camera-gopro';
			case 'take_photo_list':
				return 'mdi:camera-burst';
			case 'take_photo_validation':
				return 'mdi:camera-switch';
			case 'draw_picture':
				return 'mdi:brush';
			case 'attend_event':
				return 'mdi:calendar-star';
			case 'transcribe_audio':
				return 'mdi:microphone';
			case 'article_quiz':
				return 'mdi:book-open-variant';
			case 'match_terms':
				return 'mdi:shape';
			case 'order_items':
				return 'mdi:format-list-bulleted';
			case 'describe_text':
				return 'mdi:pencil';
			case 'respond_to_prompt':
				return 'mdi:comment-text';
			case 'activity_read_time':
				return 'mdi:account-clock';
			case 'article_read_time':
				return 'mdi:book-clock-outline';
			case 'submit_event_image':
				return 'ph:device-mobile-camera';
			case 'distance_covered':
				return 'mdi:map-marker-radius';
			case 'scan_barcode':
				return 'mdi:barcode';
			default:
				return 'mdi:account';
		}
	};

	return {
		quests,
		fetchQuest,
		fetchQuests,
		getStepIcon
	};
}

export interface QuestCelebrationPayload {
	questTitle?: string;
	points?: number;
}

const open = ref(false);
const payload = ref<QuestCelebrationPayload>({});

export function useQuestCelebration() {
	return {
		open,
		payload,
		triggerCelebration(p: QuestCelebrationPayload) {
			payload.value = p;
			open.value = true;
		},
		closeCelebration() {
			open.value = false;
		}
	};
}

interface SubmittableStep {
	type: string;
	index: number;
	altIndex?: number;
}

export interface UseStepSubmissionProps {
	step?: SubmittableStep;
	disabled?: boolean;
	submit?: boolean;
	serverRequest?: typeof makeServerRequest;
}

// shared submit/loading/error wiring for timed game step components
export function useStepSubmission(
	props: UseStepSubmissionProps,
	emit: (event: 'submitted') => void
) {
	const { user } = useAuth(props.serverRequest || makeServerRequest);
	const userId = computed(() => user.value?.id);
	const { updateQuest } = useUser(userId, props.serverRequest || makeServerRequest);
	const { lat, lng } = useQuestGeolocation();

	const submitting = ref(false);
	const submitError = ref('');

	async function submit() {
		if (!props.step) return;

		// drop duplicate clicks while a submission is already in flight
		if (submitting.value) return;
		if (props?.disabled || props?.submit === false) {
			emit('submitted');
			return;
		}
		if (!userId.value) {
			submitError.value = 'Your account is still loading…';
			return;
		}
		submitError.value = '';
		submitting.value = true;
		try {
			const res = await updateQuest(
				{
					type: props.step.type,
					index: props.step.index,
					...(props.step.altIndex !== undefined ? { altIndex: props.step.altIndex } : {})
				},
				lat.value,
				lng.value
			);
			if (res.validated) {
				if (res.completed) {
					const { triggerCelebration } = useQuestCelebration();
					triggerCelebration({
						questTitle: undefined,
						points: 0
					});
				}
				await new Promise((r) => setTimeout(r, 800));
				emit('submitted');
			} else {
				submitError.value = res.message || 'Could not save your progress. Please try again.';
			}
		} catch (e: any) {
			submitError.value =
				e?.data?.message ||
				e?.statusMessage ||
				e?.message ||
				'Submission failed. Please try again.';
		} finally {
			submitting.value = false;
		}
	}

	return { submit, submitting, submitError, userId };
}

// #region notifications

export function useNotifications() {
	const notificationStore = useNotificationStore();

	const notifications = computed(() => notificationStore.notifications);
	const unreadCount = computed(() => notificationStore.unreadCount);
	const hasWarnings = computed(() => notificationStore.hasWarnings);
	const hasErrors = computed(() => notificationStore.hasErrors);

	const fetchNotifications = async () => {
		await notificationStore.fetchNotifications();
		return {
			success: true,
			data: {
				unread_count: notificationStore.unreadCount,
				has_warnings: notificationStore.hasWarnings,
				has_errors: notificationStore.hasErrors,
				items: notificationStore.notifications
			}
		};
	};

	const markNotificationRead = async (id: string) => {
		return await notificationStore.markRead(id);
	};

	const markNotificationUnread = async (id: string) => {
		return await notificationStore.markUnread(id);
	};

	const markAllNotificationsRead = async () => {
		return await notificationStore.markAllRead();
	};

	const markAllNotificationsUnread = async () => {
		return await notificationStore.markAllUnread();
	};

	const clearAllNotifications = async () => {
		return await notificationStore.clearAll();
	};

	const fetch = async () => {
		await fetchNotifications();
	};

	const addLiveNotification = (notification: UserNotification) => {
		return notificationStore.addLiveNotification(notification);
	};

	return {
		notifications,
		unreadCount,
		hasWarnings,
		hasErrors,
		fetch,
		fetchNotifications,
		markNotificationRead,
		markNotificationUnread,
		markAllNotificationsRead,
		markAllNotificationsUnread,
		clearAllNotifications,
		addLiveNotification
	};
}

export function useNotification(id: string) {
	const notificationStore = useNotificationStore();
	const notification = computed(() => notificationStore.cache.get(id));

	const fetch = async () => {
		await notificationStore.fetchNotification(id);
	};

	return {
		notification,
		fetch
	};
}

export async function deleteNotification(id: string) {
	const notificationStore = useNotificationStore();
	return await notificationStore.deleteNotification(id);
}

export function useJourneyLeaderboard(
	type: string,
	serverRequest: typeof makeServerRequest = makeServerRequest
) {
	const leaderboard = useState<UserJourneyLeaderboardEntry[]>(
		`journey-leaderboard-${type}`,
		() => []
	);
	const authStore = useAuthStore();
	const currentLimit = ref(10);

	const fetchLeaderboardData = async (limit: number = 10) => {
		return await serverRequest<Omit<UserJourneyLeaderboardEntry, 'user'>[]>(
			`journey-leaderboard-${type}-limit-${limit}`,
			`/api/user/journeyLeaderboard?type=${type}&limit=${limit}`,
			authStore.sessionToken
		);
	};

	const fetchLeaderboard = async (limit: number = 10) => {
		currentLimit.value = limit;
		const res = await fetchLeaderboardData(limit);
		if (valid(res)) {
			const userPromises = res.data.map(async (entry) => {
				const { user, fetchUser } = useUser(entry.id);
				await fetchUser();
				if (!user.value) {
					return null;
				}

				return {
					user: user.value,
					id: entry.id,
					streak: entry.streak
				};
			});

			leaderboard.value = (await Promise.all(userPromises)).filter(
				(entry): entry is UserJourneyLeaderboardEntry => entry !== null
			);
		} else {
			leaderboard.value = [];
		}
	};

	if (import.meta.client) {
		useEventListener(window, 'earth-app:journey-updated', (event: Event) => {
			const journeyEvent = event as CustomEvent<{
				type?: string;
				incremented?: boolean;
			}>;

			if (!journeyEvent.detail?.incremented) return;
			if (journeyEvent.detail.type !== type) return;

			void fetchLeaderboard(currentLimit.value);
		});
	}

	if (leaderboard.value.length === 0) {
		fetchLeaderboard();
	}

	return {
		leaderboard,
		fetchLeaderboard
	};
}

// #region oauth

const microsoftAuth = (state: string) => {
	const config = useRuntimeConfig();
	const linkUri = `${config.public.baseUrl}/api/auth/callback`;

	const clientId = config.public.microsoftClientId;
	const scope = 'openid email profile';

	return (
		`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
		`client_id=${clientId}&` +
		`redirect_uri=${encodeURIComponent(linkUri)}&` +
		`response_type=code&` +
		`scope=${encodeURIComponent(scope)}&` +
		`state=${encodeURIComponent(state)}`
	);
};

const googleAuth = (state: string) => {
	const config = useRuntimeConfig();
	const linkUri = `${config.public.baseUrl}/api/auth/callback`;

	const clientId = config.public.googleClientId;
	const scope = 'openid email profile';

	return (
		`https://accounts.google.com/o/oauth2/v2/auth?` +
		`client_id=${clientId}&` +
		`redirect_uri=${encodeURIComponent(linkUri)}&` +
		`response_type=code&` +
		`scope=${encodeURIComponent(scope)}&` +
		`state=${encodeURIComponent(state)}`
	);
};

const discordAuth = (state: string) => {
	const config = useRuntimeConfig();
	const linkUri = `${config.public.baseUrl}/api/auth/callback`;

	const clientId = config.public.discordClientId;
	const scope = 'identify email';

	return (
		`https://discord.com/api/oauth2/authorize?` +
		`client_id=${clientId}&` +
		`redirect_uri=${encodeURIComponent(linkUri)}&` +
		`response_type=code&` +
		`scope=${encodeURIComponent(scope)}&` +
		`state=${encodeURIComponent(state)}`
	);
};

const githubAuth = (state: string) => {
	const config = useRuntimeConfig();
	const linkUri = `${config.public.baseUrl}/api/auth/callback`;

	const clientId = config.public.githubClientId;
	const scope = 'user:email read:user';

	return (
		`https://github.com/login/oauth/authorize?` +
		`client_id=${clientId}&` +
		`redirect_uri=${encodeURIComponent(linkUri)}&` +
		`scope=${encodeURIComponent(scope)}&` +
		`state=${encodeURIComponent(state)}`
	);
};

const facebookAuth = (state: string) => {
	const config = useRuntimeConfig();
	const linkUri = `${config.public.baseUrl}/api/auth/callback`;

	const clientId = config.public.facebookClientId;
	const scope = 'public_profile email';

	return (
		`https://www.facebook.com/v18.0/dialog/oauth?` +
		`client_id=${clientId}&` +
		`redirect_uri=${encodeURIComponent(linkUri)}&` +
		`response_type=code&` +
		`scope=${encodeURIComponent(scope)}&` +
		`state=${encodeURIComponent(state)}`
	);
};

const appleAuth = (state: string) => {
	const config = useRuntimeConfig();
	const linkUri = `${config.public.baseUrl}/api/auth/callback`;

	const clientId = config.public.appleClientId;
	const scope = 'name email';

	return (
		`https://appleid.apple.com/auth/authorize?` +
		`client_id=${clientId}&` +
		`redirect_uri=${encodeURIComponent(linkUri)}&` +
		`response_type=code&` +
		`scope=${encodeURIComponent(scope)}&` +
		`response_mode=form_post&` +
		`state=${encodeURIComponent(state)}`
	);
};

export function authLink(
	provider: string,
	context: OAuthContext = 'login',
	source: OAuthSource = 'web'
) {
	const state = `${provider}:${source}:${context}`;

	switch (provider) {
		case 'google':
			return googleAuth(state);
		case 'microsoft':
			return microsoftAuth(state);
		case 'discord':
			return discordAuth(state);
		case 'github':
			return githubAuth(state);
		case 'facebook':
			return facebookAuth(state);
		case 'apple':
			return appleAuth(state);
		default:
			throw new Error('Unsupported OAuth provider');
	}
}

// #region user friends

export function useFriends(id?: string) {
	const friendsStore = useFriendsStore();
	const dataId = id || 'current';

	const friends = computed(() => friendsStore.getFriends(dataId));
	const circle = computed(() => friendsStore.getCircle(dataId));

	const fetchFriends = async (limit?: number, search?: string) => {
		await friendsStore.fetchFriends(dataId, limit, search);
	};

	const fetchFriendsPage = async (page: number, limit: number, search: string = '') => {
		return await friendsStore.fetchFriendsPage(dataId, page, limit, search);
	};

	const addFriend = async (friend: string) => {
		return await friendsStore.addFriend(dataId, friend);
	};

	const removeFriend = async (friend: string) => {
		return await friendsStore.removeFriend(dataId, friend);
	};

	const fetchCircle = async (limit?: number) => {
		await friendsStore.fetchCircle(dataId, limit);
	};

	const fetchCirclePage = async (page: number, limit: number) => {
		return await friendsStore.fetchCirclePage(dataId, page, limit);
	};

	const addToCircle = async (friend: string) => {
		return await friendsStore.addToCircle(dataId, friend);
	};

	const removeFromCircle = async (friend: string) => {
		return await friendsStore.removeFromCircle(dataId, friend);
	};

	return {
		friends,
		fetchFriends,
		fetchFriendsPage,
		addFriend,
		removeFriend,
		circle,
		fetchCircle,
		fetchCirclePage,
		addToCircle,
		removeFromCircle
	};
}

// Geolocation

export function useQuestGeolocation() {
	const lat = ref<number | null>(null);
	const lng = ref<number | null>(null);
	const alt = ref<number | null>(null);
	const accuracy = ref<number | null>(null);
	const altAccuracy = ref<number | null>(null);
	const speed = ref<number | null>(null);
	const error = ref<string | null>(null);

	const fetchLocation = () => {
		if (typeof window === 'undefined') return;

		const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
			.Capacitor;
		if (cap?.isNativePlatform?.()) return;

		if (!navigator.geolocation) {
			error.value = 'Geolocation is not supported by your browser.';
			return;
		}

		navigator.geolocation.getCurrentPosition(
			(position) => {
				lat.value = position.coords.latitude;
				lng.value = position.coords.longitude;
				alt.value = position.coords.altitude;
				accuracy.value = position.coords.accuracy;
				altAccuracy.value = position.coords.altitudeAccuracy;
				speed.value = position.coords.speed;
				error.value = null;
			},
			(err) => {
				error.value =
					err.message ||
					'Unable to retrieve your location. Please allow location access and try again.';
			}
		);
	};

	return {
		lat,
		lng,
		alt,
		accuracy,
		altAccuracy,
		speed,
		error,
		fetchLocation
	};
}

// #region badge mastery

export type MasteryButtonState =
	| 'loading'
	| 'locked'
	| 'completed'
	| 'ready'
	| 'cap_reached'
	| 'default';

const MASTERY_BUTTON_ICONS: Record<MasteryButtonState, string> = {
	loading: 'mdi:loading',
	locked: 'mdi:lock',
	completed: 'mdi:star-circle',
	ready: 'mdi:play-circle-outline',
	cap_reached: 'mdi:alert-octagon-outline',
	default: 'mdi:medal-outline'
};

// state-derived context — sky's loading label flips between "Opening..." and
// "Generating..." depending on whether a quest already exists, so label entries
// can be functions of this context (color entries always resolve from state alone)
export type MasteryLabelContext = { questReady: boolean };
export type MasteryButtonLabel = string | ((ctx: MasteryLabelContext) => string);

// generic on color string union so each platform's strict component prop type is preserved;
// sky's IonButton colors (`'medium' | 'tertiary' | ...`) and crust's UButton colors
// (`'neutral' | 'info' | ...`) flow through to the returned props without widening
export type MasteryButtonTheme<C extends string = string> = {
	labels: Record<MasteryButtonState, MasteryButtonLabel>;
	colors: Record<MasteryButtonState, C>;
};

export const CRUST_MASTERY_BUTTON_THEME = {
	labels: {
		loading: 'Loading...',
		locked: 'Mastery Permanently Locked',
		completed: 'View Completed Mastery',
		ready: 'Open Mastery Quest',
		cap_reached: 'Mastery Cap Reached',
		default: 'Master This Badge'
	},
	colors: {
		loading: 'info',
		locked: 'neutral',
		completed: 'tertiary',
		ready: 'warning',
		cap_reached: 'neutral',
		default: 'primary'
	}
} as const satisfies MasteryButtonTheme;

export type MasteryButtonProps<C extends string = string> = {
	state: MasteryButtonState;
	label: string;
	color: C;
	icon: string;
	loading: boolean;
	disabled: boolean;
	outlined: boolean;
};

export type BadgeRarityColor = 'neutral' | 'info' | 'warning' | 'success';

export type BadgeHeaderProps = {
	badge: Badge | UserBadge;
	isGranted: boolean;
	isMastered: boolean;
	rarityColor: BadgeRarityColor | undefined;
};

// rotated while masteryLoading to signal the request is alive
// (gemma-4 inference can run 20-60s; a silent spinner reads as a hang)
const GENERATING_MESSAGES = [
	'Loading...',
	'Generating your quest...',
	'Picking the perfect steps...',
	'Consulting the badge archives...',
	'Tuning difficulty to your profile...',
	'Taking the perfect steps...',
	'Triple-checking your preferences...',
	'Applying the algorithm...',
	'Adjusting the settings...',
	'Checking the requirements...',
	'Polishing the timeline...',
	'Making the final touches...',
	'Almost there...'
];

export function isUserBadge(badge: Badge | UserBadge): badge is UserBadge {
	return 'user_id' in badge;
}

export function useBadgeMastery<T extends MasteryButtonTheme = typeof CRUST_MASTERY_BUTTON_THEME>(
	badge: MaybeRefOrGetter<Badge | UserBadge>,
	theme?: T
) {
	const resolvedTheme = (theme ?? CRUST_MASTERY_BUTTON_THEME) as unknown as T;
	type Color = T['colors'][MasteryButtonState];
	const badgeRef = computed<Badge | UserBadge>(() => toValue(badge));

	const userStore = useUserStore();
	const { user: authUser } = useAuth();

	const masteryLoading = ref(false);
	const masteryStatusLoading = ref(false);
	const masteryStatusFetched = ref(false);
	const masteryLocked = ref(false);
	const masteryQuestReady = ref(false);
	const loadedQuest = ref<Quest | null>(null);

	const isGranted = computed(() => isUserBadge(badgeRef.value) && badgeRef.value.granted);
	const isMastered = computed(() => isGranted.value && !!badgeRef.value.mastered);
	const isCompletedMastery = computed(() => !!badgeRef.value.mastered);

	const isOwnBadge = computed(() => {
		if (!isUserBadge(badgeRef.value)) return false;
		return authUser.value?.id === badgeRef.value.user_id;
	});

	// mastered badges still surface the cta — opening it re-opens the completed timeline
	const canShowMastery = computed(() => {
		if (!isOwnBadge.value) return false;
		if (!('granted' in badgeRef.value) || !badgeRef.value.granted) return false;
		if (badgeRef.value.mastery_exempt) return false;
		return true;
	});

	const rarityColor = computed<BadgeRarityColor | undefined>(() => {
		switch (badgeRef.value.rarity) {
			case 'normal':
				return 'neutral';
			case 'rare':
				return 'info';
			case 'amazing':
				return 'warning';
			case 'green':
				return 'success';
		}
	});

	const grantedAt = computed(() =>
		DateTime.fromISO(
			'granted_at' in badgeRef.value && badgeRef.value.granted_at ? badgeRef.value.granted_at : ''
		).toLocaleString(DateTime.DATETIME_MED)
	);

	const masteredAtFormatted = computed(() => {
		if (!badgeRef.value.mastered_at) return null;
		const dt = DateTime.fromISO(String(badgeRef.value.mastered_at));
		return dt.isValid ? dt.toLocaleString(DateTime.DATETIME_MED) : null;
	});

	// per-user cap snapshot — blocks NEW generation only; once a quest is ready, "continue" is always allowed
	const masteryList = computed(() => {
		const uid = authUser.value?.id;
		if (!uid) return null;
		return userStore.masteryLists.get(uid) ?? null;
	});
	const masteryCapReached = computed(() => {
		const list = masteryList.value;
		if (!list) return false;
		return list.active >= list.cap;
	});
	const masteryExpiresAt = computed(() => {
		const item = masteryList.value?.items.find((i) => i.badge_id === badgeRef.value.id);
		if (!item) return null;
		return DateTime.fromMillis(item.expires_at);
	});
	const masteryExpiresInDays = computed(() => {
		const exp = masteryExpiresAt.value;
		if (!exp) return null;
		const diff = exp.diffNow('days').days;
		return diff > 0 ? Math.ceil(diff) : 0;
	});

	const masteryDisabled = computed(
		() =>
			masteryLoading.value ||
			masteryStatusLoading.value ||
			masteryLocked.value ||
			// only block generation at cap; once the quest is ready (or completed), the button is "open"
			(masteryCapReached.value && !masteryQuestReady.value && !isCompletedMastery.value)
	);

	const masteryButtonState = computed<MasteryButtonState>(() => {
		if (masteryLoading.value) return 'loading';
		if (masteryLocked.value) return 'locked';
		if (isCompletedMastery.value) return 'completed';
		if (masteryQuestReady.value) return 'ready';
		if (masteryCapReached.value) return 'cap_reached';
		return 'default';
	});

	const masteryButton = computed<MasteryButtonProps<Color>>(() => {
		const state = masteryButtonState.value;
		const labelEntry = resolvedTheme.labels[state];
		return {
			state,
			label:
				typeof labelEntry === 'function'
					? labelEntry({ questReady: masteryQuestReady.value })
					: labelEntry,
			color: resolvedTheme.colors[state],
			icon: MASTERY_BUTTON_ICONS[state],
			loading: masteryLoading.value,
			disabled: masteryDisabled.value,
			outlined: masteryLocked.value || masteryCapReached.value
		};
	});

	// bundle for <UserBadgeDetailsHeader v-bind="badgeHeaderProps">
	const badgeHeaderProps = computed<BadgeHeaderProps>(() => ({
		badge: badgeRef.value,
		isGranted: isGranted.value,
		isMastered: isMastered.value,
		rarityColor: rarityColor.value
	}));

	// bundle for <UserBadgeMasteryStatusText v-bind="masteryStatusProps">
	const masteryStatusProps = computed(() => ({
		masteryStatusLoading: masteryStatusLoading.value,
		masteryStatusFetched: masteryStatusFetched.value,
		isCompletedMastery: isCompletedMastery.value,
		masteryLocked: masteryLocked.value,
		masteryQuestReady: masteryQuestReady.value,
		masteryCapReached: masteryCapReached.value,
		masteryExpiresInDays: masteryExpiresInDays.value,
		masteredAtFormatted: masteredAtFormatted.value,
		masteryList: masteryList.value
	}));

	const masteryQuestId = computed(() => `badge_mastery_${badgeRef.value.id}`);

	const masteryProgress = computed(() => {
		const userId = authUser.value?.id;
		if (!userId) return undefined;
		const current = userStore.quest.get(userId);
		if (current?.questId === masteryQuestId.value) return current.progress;
		const history = userStore.questHistory.get(userId);
		const completed = history?.get(masteryQuestId.value);
		return completed?.progress;
	});

	const masteryCompletedAt = computed<number | undefined>(() => {
		const userId = authUser.value?.id;
		if (!userId) return undefined;
		const history = userStore.questHistory.get(userId);
		const completed = history?.get(masteryQuestId.value);
		if (completed?.completedAt) return completed.completedAt;

		// fallback for re-opening from a mastered badge: questHistory may not be loaded yet on
		// this page, but the badge payload always carries mastered_at when mastered=true
		if (badgeRef.value.mastered && badgeRef.value.mastered_at) {
			const ms = DateTime.fromISO(String(badgeRef.value.mastered_at)).toMillis();
			return Number.isFinite(ms) ? ms : undefined;
		}
		return undefined;
	});

	async function loadMasteryStatus() {
		const userId = authUser.value?.id;
		if (!userId) return;
		// skip entirely for mastered — terminal state is already known from badge.mastered
		if (isCompletedMastery.value) {
			masteryStatusFetched.value = true;
			return;
		}
		masteryStatusLoading.value = true;
		try {
			if (userStore.lockedMasteries.has(badgeRef.value.id)) {
				masteryLocked.value = true;
			}
			const status = await userStore.getMasteryStatus(userId, badgeRef.value.id);
			masteryStatusFetched.value = true;
			if (!status) {
				masteryLocked.value = userStore.lockedMasteries.has(badgeRef.value.id);
				return;
			}
			masteryLocked.value = status.locked;
			masteryQuestReady.value = status.generated && !status.mastered && !status.locked;
			if (status.quest) {
				loadedQuest.value = status.quest;
			}
		} catch (e) {
			console.warn('Failed to load badge mastery status', e);
		} finally {
			masteryStatusLoading.value = false;
		}
	}

	// best-effort cap snapshot — cached after first call so subsequent calls are no-ops
	function ensureMasteryListFetched() {
		const uid = authUser.value?.id;
		if (!uid) return;
		if (userStore.masteryLists.has(uid)) return;
		void userStore.fetchMasteryList(uid);
	}

	// rotating reassurance while ai inference runs
	const generatingMessage = ref(GENERATING_MESSAGES[0]);
	let generatingInterval: ReturnType<typeof setInterval> | null = null;
	function startGeneratingTicker() {
		let i = 0;
		generatingMessage.value = GENERATING_MESSAGES[0];
		generatingInterval = setInterval(() => {
			i = (i + 1) % GENERATING_MESSAGES.length;
			generatingMessage.value = GENERATING_MESSAGES[i];
		}, 2500);
	}
	function stopGeneratingTicker() {
		if (generatingInterval) {
			clearInterval(generatingInterval);
			generatingInterval = null;
		}
	}
	watch(masteryLoading, (loading) => {
		if (loading) startGeneratingTicker();
		else stopGeneratingTicker();
	});
	onBeforeUnmount(stopGeneratingTicker);

	return {
		masteryLoading,
		masteryStatusLoading,
		masteryStatusFetched,
		masteryLocked,
		masteryQuestReady,
		loadedQuest,
		generatingMessage,

		isGranted,
		isMastered,
		isCompletedMastery,
		isOwnBadge,
		canShowMastery,
		rarityColor,
		grantedAt,
		masteredAtFormatted,
		masteryList,
		masteryCapReached,
		masteryExpiresAt,
		masteryExpiresInDays,
		masteryDisabled,
		masteryButtonState,
		masteryButton,
		badgeHeaderProps,
		masteryStatusProps,
		masteryQuestId,
		masteryProgress,
		masteryCompletedAt,

		loadMasteryStatus,
		ensureMasteryListFetched
	};
}

export type BadgeMasteryTourOptions = {
	masteryQuestReady: MaybeRefOrGetter<boolean>;
	isInteractive: MaybeRefOrGetter<boolean>;
	onMasteryCtaClick: () => unknown | Promise<unknown>;
	ctaIds?: { cta?: string; help?: string };
};

export function buildBadgeMasteryTour(opts: BadgeMasteryTourOptions) {
	const ctaId = opts.ctaIds?.cta ?? 'badge-mastery-cta';
	const helpId = opts.ctaIds?.help ?? 'badge-mastery-help';
	return computed<SiteTourStep[]>(() => [
		{
			id: ctaId,
			title: 'Badge Mastery',
			description:
				"After earning a badge, you can deepen it with a personalised AI quest tailored to your profile and activities. It's an optional way to turn a badge into a long-form challenge — drawings, photos, audio, reflection.",
			footer: 'Mastery is opt-in. Plenty of users skip it; plenty love the structure.',
			icon: 'mdi:medal-outline',
			highlightPadding: 8
		},
		{
			id: ctaId,
			title: 'One-shot Commitment',
			description:
				'Each Badge Mastery is a single attempt. Resetting it, or starting a different mastery before finishing, will permanently lock this one — you cannot regenerate it.\n\nThere is also a hard cap on active mastery quests at any given time.',
			footer: "You'll see a clear confirmation prompt before generation starts.",
			icon: 'mdi:alert-octagon-outline',
			dim: true,
			condition: () => !!toValue(opts.isInteractive),
			cta: {
				label: toValue(opts.masteryQuestReady) ? 'Continue Mastery' : 'Start Mastery',
				icon: 'mdi:medal-outline',
				color: 'warning',
				advance: false,
				closeOnSuccess: true,
				handler: () => opts.onMasteryCtaClick()
			}
		},
		{
			id: helpId,
			title: 'Need a refresher?',
			description:
				'Tap this help button any time to revisit this tour. Once you finish the mastery, a "Mastered" chip appears next to the badge — visible on your profile too.',
			footer: 'Good luck — and have fun with it!',
			icon: 'mdi:progress-question'
		}
	]);
}

// #region daily quest

// today's quest — deterministic random quest from the user's interests, refreshes daily
// keep this composable thin: it leans on useQuests() + useAuth() + a localStorage flag

export function useDailyQuest() {
	const { user } = useAuth();
	const { quests, fetchQuests } = useQuests();

	// UTC YYYY-MM-DD so the quest flips at the same instant globally
	const dateKey = computed(() => {
		const now = new Date();
		const y = now.getUTCFullYear();
		const m = String(now.getUTCMonth() + 1).padStart(2, '0');
		const d = String(now.getUTCDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	});

	// djb2-style hash; not cryptographic, just stable
	function hashString(input: string): number {
		let h = 5381;
		for (let i = 0; i < input.length; i++) {
			h = ((h << 5) + h + input.charCodeAt(i)) | 0;
		}
		return Math.abs(h);
	}

	const isLoading = computed(() => quests.value === null);

	// candidate pool — skip premium + mobile_only so taps from web actually open something playable
	const pool = computed<Quest[]>(() => {
		const all = quests.value ?? [];
		return all.filter((q) => !q.premium && !q.mobile_only);
	});

	// prefer quests that match the user's interests via the activity_quest_<id> convention
	const interestPool = computed<Quest[]>(() => {
		const interests = user.value?.activities ?? [];
		if (interests.length === 0) return [];
		const ids = new Set(interests.map((a) => `activity_quest_${a.id}`));
		return pool.value.filter((q) => ids.has(q.id));
	});

	const quest = computed<Quest | null>(() => {
		const seedPool = interestPool.value.length > 0 ? interestPool.value : pool.value;
		if (seedPool.length === 0) return null;
		const seed = `${dateKey.value}:${user.value?.id ?? 'anon'}`;
		const idx = hashString(seed) % seedPool.length;
		return seedPool[idx] ?? null;
	});

	// client-only tap flag — never read storage during SSR
	const tappedKey = computed(() => `daily_quest_tapped:${dateKey.value}`);
	const isTapped = ref(false);

	const refreshTapped = () => {
		if (!import.meta.client) return;
		try {
			isTapped.value = window.localStorage.getItem(tappedKey.value) === '1';
		} catch {
			isTapped.value = false;
		}
	};

	onMounted(() => {
		refreshTapped();
		// kick a fetch if the quests list hasn't been hydrated yet
		if (quests.value === null) void fetchQuests();
	});

	// re-check the flag when the date rolls over mid-session
	watch(tappedKey, () => refreshTapped());

	const markTapped = () => {
		if (!import.meta.client) return;
		isTapped.value = true;
		try {
			window.localStorage.setItem(tappedKey.value, '1');
		} catch {
			// quota / private mode — pulse will reappear, no real harm
		}
	};

	return {
		quest,
		isLoading,
		isTapped,
		markTapped,
		dateKey
	};
}

// #region badge unlock listener

// shared singleton state — both crust + sky import this composable. holds the
// pending ribbon queue and exposes push/dismiss so the ribbon component stays a
// pure renderer.
export type BadgeUnlockEntry = {
	badgeId?: string;
	badgeName: string;
	badgeIcon?: string;
	trackerId?: string;
};

const badgeUnlockQueue = ref<BadgeUnlockEntry[]>([]);
const badgeUnlockSeenIds = new Set<string>();

const BADGE_UNLOCK_LAST_SEEN_KEY = 'badges_last_seen_at';
const BADGE_UNLOCK_TITLE_PATTERN = /new badges? unlocked/i;
// "you've unlocked the \"Curious Mind\" badge!" — first capture is the name.
// also tolerates curly quotes the backend may emit on some platforms.
const BADGE_UNLOCK_SINGLE_NAME_PATTERN = /unlocked the ["“]([^"”]+)["”] badge/i;
// "you've unlocked the following badges: name1, name2."
const BADGE_UNLOCK_MULTI_NAMES_PATTERN = /unlocked the following badges:\s*(.+?)\.?$/i;

const readBadgeUnlockLastSeen = (): number => {
	if (!import.meta.client) return 0;
	try {
		const raw = localStorage.getItem(BADGE_UNLOCK_LAST_SEEN_KEY);
		const parsed = raw ? Number(raw) : 0;
		return Number.isFinite(parsed) ? parsed : 0;
	} catch {
		return 0;
	}
};

const writeBadgeUnlockLastSeen = (ms: number) => {
	if (!import.meta.client) return;
	try {
		localStorage.setItem(BADGE_UNLOCK_LAST_SEEN_KEY, String(ms));
	} catch {
		// swallow — private mode / quota
	}
};

const enqueueBadgeUnlockEntry = (entry: BadgeUnlockEntry, dedupeKey?: string) => {
	if (dedupeKey) {
		if (badgeUnlockSeenIds.has(dedupeKey)) return;
		badgeUnlockSeenIds.add(dedupeKey);
	}
	badgeUnlockQueue.value = [...badgeUnlockQueue.value, entry];
};

const resolveBadgeUnlockMeta = (
	name: string,
	currentUserId: string | undefined
): Partial<BadgeUnlockEntry> => {
	if (!currentUserId) return {};
	const userStore = useUserStore();
	const list = (userStore as any).badges?.get?.(currentUserId) as UserBadge[] | undefined;
	if (!list || !Array.isArray(list)) return {};
	const match = list.find(
		(b) => typeof b?.name === 'string' && b.name.toLowerCase() === name.toLowerCase()
	);
	if (!match) return {};
	return { badgeId: match.id, badgeIcon: match.icon, trackerId: match.tracker_id };
};

// parses a notification payload and pushes entries; returns count enqueued
const ingestBadgeUnlockNotification = (
	notification: Pick<UserNotification, 'title' | 'message' | 'id'>,
	currentUserId: string | undefined
): number => {
	if (!notification?.title || !BADGE_UNLOCK_TITLE_PATTERN.test(notification.title)) return 0;

	const message = notification.message || '';
	const names: string[] = [];

	const single = message.match(BADGE_UNLOCK_SINGLE_NAME_PATTERN);
	if (single?.[1]) names.push(single[1].trim());

	if (names.length === 0) {
		const multi = message.match(BADGE_UNLOCK_MULTI_NAMES_PATTERN);
		if (multi?.[1]) {
			multi[1]
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean)
				.forEach((n) => names.push(n));
		}
	}

	if (names.length === 0) return 0;

	let pushed = 0;
	for (const name of names) {
		const meta = resolveBadgeUnlockMeta(name, currentUserId);
		const key = `notif:${notification.id || ''}:${name.toLowerCase()}`;
		const before = badgeUnlockQueue.value.length;
		enqueueBadgeUnlockEntry({ badgeName: name, ...meta }, key);
		if (badgeUnlockQueue.value.length > before) pushed += 1;
	}
	return pushed;
};

// diff fetched badges against the localStorage watermark and enqueue any that
// were granted after we last looked. polling-fallback path for missed ws events.
const ingestBadgeUnlockSnapshot = (badges: UserBadge[]) => {
	if (!badges?.length) return;
	const lastSeen = readBadgeUnlockLastSeen();
	let maxGrantedAt = lastSeen;

	for (const badge of badges) {
		if (!badge?.granted) continue;
		const grantedAtRaw = badge.granted_at;
		const grantedAt =
			typeof grantedAtRaw === 'number' ? grantedAtRaw : grantedAtRaw ? Number(grantedAtRaw) : 0;
		if (!Number.isFinite(grantedAt) || grantedAt <= 0) continue;
		if (grantedAt > maxGrantedAt) maxGrantedAt = grantedAt;
		if (grantedAt <= lastSeen) continue;
		const key = `badge:${badge.id}:${grantedAt}`;
		enqueueBadgeUnlockEntry(
			{
				badgeId: badge.id,
				badgeName: badge.name,
				badgeIcon: badge.icon,
				trackerId: badge.tracker_id
			},
			key
		);
	}

	if (maxGrantedAt > lastSeen) writeBadgeUnlockLastSeen(maxGrantedAt);
};

// pull current user's badges + diff against last_seen
const pollBadgeUnlockOnce = async () => {
	if (!import.meta.client) return;
	const authStore = useAuthStore();
	if (!authStore.sessionToken) return;
	const { user } = useAuth();
	const uid = user.value?.id;
	if (!uid) return;
	try {
		const userStore = useUserStore();
		const fetched = await userStore.fetchBadges(uid);
		ingestBadgeUnlockSnapshot(fetched);
	} catch (err) {
		console.warn('badge-unlock polling fallback failed:', err);
	}
};

let badgeUnlockStarted = false;

export function useBadgeUnlockListener() {
	const push = (entry: BadgeUnlockEntry) => enqueueBadgeUnlockEntry(entry);

	const dismiss = () => {
		if (badgeUnlockQueue.value.length === 0) return;
		badgeUnlockQueue.value = badgeUnlockQueue.value.slice(1);
	};

	// hook called by the websocket plugin for any 'notification' payload. cheap to
	// call indiscriminately — the title regex filters non-badge events first.
	const onIncomingNotification = (notification: UserNotification) => {
		if (!import.meta.client) return;
		const { user } = useAuth();
		ingestBadgeUnlockNotification(notification, user.value?.id);
	};

	// idempotent bootstrap: schedules one poll on auth + one on focus to recover
	// any grants that landed while the ws was offline
	const start = () => {
		if (!import.meta.client || badgeUnlockStarted) return;
		badgeUnlockStarted = true;
		void pollBadgeUnlockOnce();
		const focusHandler = () => void pollBadgeUnlockOnce();
		window.addEventListener('focus', focusHandler);
		window.addEventListener('online', focusHandler);
	};

	return {
		queue: badgeUnlockQueue,
		push,
		dismiss,
		start,
		onIncomingNotification
	};
}

// #region MoodSpark

const MOOD_EMOJIS_RUNTIME = ['😍', '😊', '🤔', '😐', '😟', '😤'] as const;
type MoodEmojiRuntime = (typeof MOOD_EMOJIS_RUNTIME)[number];

// types are file-local; the canonical exported versions live in shared/utils/schemas.ts
type MoodCounts = Record<MoodEmojiRuntime, number>;

type MoodSnapshot = {
	counts: MoodCounts;
	total: number;
	updated_at: number;
};

function moodTodayUtc(): string {
	const d = new Date();
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, '0');
	const day = String(d.getUTCDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

function moodVoteStorageKey(topic: string, date: string): string {
	return `mood_voted:${topic}:${date}`;
}

function emptyMoodCounts(): MoodCounts {
	return MOOD_EMOJIS_RUNTIME.reduce((acc, e) => {
		acc[e] = 0;
		return acc;
	}, {} as MoodCounts);
}

export function useMood(initialTopic: MaybeRefOrGetter<string> = 'today') {
	const authStore = useAuthStore();
	const snapshot = ref<MoodSnapshot | null>(null);
	const isLoading = ref(false);
	const currentTopic = ref(toValue(initialTopic));
	const currentDate = ref(moodTodayUtc());

	// hasVoted is purely a client-side localStorage check; the backend rate-limit is the authoritative defense
	const hasVoted = computed(() => {
		if (!import.meta.client) return false;
		try {
			return (
				window.localStorage.getItem(moodVoteStorageKey(currentTopic.value, currentDate.value)) !==
				null
			);
		} catch {
			return false;
		}
	});

	const fetchSnapshot = async (topic?: string, date?: string) => {
		const t = (topic ?? currentTopic.value).trim().toLowerCase();
		const d = date ?? moodTodayUtc();
		if (!/^[a-z0-9_-]{1,64}$/.test(t)) return;
		currentTopic.value = t;
		currentDate.value = d;
		isLoading.value = true;
		try {
			const res = await makeClientAPIRequest<MoodSnapshot>(`/v2/mood/${t}/${d}`);
			if (valid(res)) {
				const data = res.data;
				snapshot.value = {
					counts: { ...emptyMoodCounts(), ...(data.counts ?? {}) } as MoodCounts,
					total:
						typeof data.total === 'number'
							? data.total
							: Object.values(data.counts ?? {}).reduce((a, b) => a + b, 0),
					updated_at: data.updated_at ?? 0
				};
			} else {
				snapshot.value = { counts: emptyMoodCounts(), total: 0, updated_at: 0 };
			}
		} finally {
			isLoading.value = false;
		}
	};

	const vote = async (
		topic: string,
		emoji: MoodEmojiRuntime
	): Promise<{ success: boolean; snapshot?: MoodSnapshot; error?: string }> => {
		const t = topic.trim().toLowerCase();
		const d = moodTodayUtc();
		if (!/^[a-z0-9_-]{1,64}$/.test(t)) {
			return { success: false, error: 'Invalid topic' };
		}
		if (!(MOOD_EMOJIS_RUNTIME as readonly string[]).includes(emoji)) {
			return { success: false, error: 'Invalid emoji' };
		}

		// localStorage guard avoids a wasted round-trip when the same browser already voted
		const storageKey = moodVoteStorageKey(t, d);
		if (import.meta.client) {
			try {
				if (window.localStorage.getItem(storageKey) !== null) {
					return { success: false, error: 'Already voted from this device' };
				}
			} catch {
				// no localStorage (private mode etc) → fall through and let the backend enforce
			}
		}

		try {
			const res = await makeClientAPIRequest<MoodSnapshot>(
				`/v2/mood/${t}/${d}`,
				authStore.sessionToken,
				{
					method: 'POST',
					body: { emoji }
				}
			);
			if (!valid(res)) {
				return { success: false, error: res.message ?? 'Failed to record vote' };
			}

			const data = res.data;
			const next: MoodSnapshot = {
				counts: { ...emptyMoodCounts(), ...(data.counts ?? {}) } as MoodCounts,
				total:
					typeof data.total === 'number'
						? data.total
						: Object.values(data.counts ?? {}).reduce((a, b) => a + b, 0),
				updated_at: data.updated_at ?? Date.now()
			};

			snapshot.value = next;
			currentTopic.value = t;
			currentDate.value = d;

			if (import.meta.client) {
				try {
					window.localStorage.setItem(storageKey, String(Date.now()));
				} catch {
					// quota / private mode — backend rate limit still wins
				}
			}

			return { success: true, snapshot: next };
		} catch (e: any) {
			return { success: false, error: e?.message ?? 'Failed to record vote' };
		}
	};

	return {
		snapshot,
		isLoading,
		hasVoted,
		vote,
		fetchSnapshot,
		EMOJIS: MOOD_EMOJIS_RUNTIME
	};
}

// #region useFeedWidgets

// deterministic per-day widget picker. seed = (date hash) xor (user-id hash) so each user
// gets a stable rotation across reloads but the slate refreshes daily and varies by user
// WordOfTheDay is intentionally NOT in this rotation - it's standalone on /activities.
// MiniLeaderboard is NOT in this rotation either - the leaderboard is by content type
// (article/prompt/event) and showing a "Top Prompt Streaks" card inline on an activities
// page is jarring. Both kinds stay in the type union for explicit standalone use.
export type FeedWidgetKind =
	| 'MoodSpark'
	| 'MicroPoll'
	| 'MicroQuiz'
	| 'ImpactTracker'
	| 'MiniLeaderboard'
	| 'MicroReflection'
	| 'RapidFlash';

const FEED_WIDGET_POOL: FeedWidgetKind[] = [
	'MoodSpark',
	'MicroPoll',
	'ImpactTracker',
	'MicroReflection',
	'MicroQuiz',
	'RapidFlash'
];

function hashString(input: string): number {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

// every 8th card slot gets a widget. the first slot always wins MoodSpark to maximize exposure
// of the new placement; subsequent slots cycle through the rest of the pool deterministically
export function useFeedWidgets() {
	const { user } = useAuth();

	const slotInterval = 8;
	const seed = computed(() => {
		const dateSeed = hashString(moodTodayUtc());
		const userSeed = user.value?.id ? hashString(user.value.id) : 0;
		return (dateSeed ^ userSeed) >>> 0;
	});

	function widgetForIndex(index: number): FeedWidgetKind | null {
		// 0-indexed: widget slots at 7, 15, 23, ... (so the first row of activities stays pure)
		if (index < slotInterval) return null;
		if ((index + 1) % slotInterval !== 0) return null;

		const slotNumber = Math.floor((index + 1) / slotInterval) - 1;
		// always seed the very first widget slot of the day with MoodSpark
		if (slotNumber === 0) return 'MoodSpark';

		// deterministic pick from the rest of the pool
		const pickIndex = (seed.value + slotNumber * 31) % FEED_WIDGET_POOL.length;
		return FEED_WIDGET_POOL[pickIndex] ?? null;
	}

	return {
		slotInterval,
		widgetForIndex,
		seed
	};
}
