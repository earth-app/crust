import type { MaybeRefOrGetter } from 'vue';
import type { Activity } from '~/shared/types/activity';
import type { SortingOption } from '~/shared/types/global';
import type { User, UserJourneyLeaderboardEntry } from '~/shared/types/user';
import {
	getUserDisplayName,
	makeAPIRequest,
	makeClientAPIRequest,
	makeServerRequest,
	paginatedAPIRequest,
	realFullName
} from '~/shared/util';
import { useAuthStore } from '~/stores/auth';
import { useAvatarStore } from '~/stores/avatar';
import { useFriendsStore } from '~/stores/friends';
import { useNotificationStore } from '~/stores/notification';
import { useUserStore } from '~/stores/user';

export function useVisitedSite() {
	const visitedSiteCookie = useCookie('visited_site', {
		sameSite: 'lax',
		secure: true,
		maxAge: 60 * 60 * 24 * 365 * 5 // 5 years
	});
	const visitedSite = computed(() => visitedSiteCookie.value != null);

	const markVisited = () => {
		visitedSiteCookie.value = 'true';
	};

	return {
		visitedSite,
		visitedSiteCookie,
		markVisited
	};
}

// Avatar and user caching is now handled by Pinia stores

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

async function syncSessionToken() {
	const authStore = useAuthStore();
	await authStore.syncSessionToken();
}

export const useAuth = () => {
	const authStore = useAuthStore();
	const avatarStore = useAvatarStore();

	const user = computed(() => authStore.currentUser);
	const avatarUrl = computed(() => user.value?.account?.avatar_url);

	// Computed avatar URLs using the avatar store
	const isRemoteUrl = (url: string | undefined): boolean => {
		if (!url) return false;
		return url.startsWith('http://') || url.startsWith('https://');
	};

	const avatar = computed(() => {
		const url = avatarUrl.value;
		if (!url || !isRemoteUrl(url)) return '/earth-app.png';
		return avatarStore.get(url)?.avatar || '/earth-app.png';
	});

	const avatar32 = computed(() => {
		const url = avatarUrl.value;
		if (!url || !isRemoteUrl(url)) return '/favicon.png';
		return avatarStore.get(url)?.avatar32 || '/favicon.png';
	});

	const avatar128 = computed(() => {
		const url = avatarUrl.value;
		if (!url || !isRemoteUrl(url)) return '/favicon.png';
		return avatarStore.get(url)?.avatar128 || '/favicon.png';
	});

	const preloadedUrls = new Set<string>();
	watch(
		avatarUrl,
		(newUrl) => {
			if (!newUrl || !isRemoteUrl(newUrl)) return;
			if (preloadedUrls.has(newUrl)) return; // Already requested

			preloadedUrls.add(newUrl);
			avatarStore.preloadAvatar(newUrl);
		},
		{ immediate: true }
	);

	const fetchUser = async (force: boolean = false) => {
		return await authStore.fetchCurrentUser(force);
	};

	return {
		user,
		fetchUser,
		avatar,
		avatar32,
		avatar128
	};
};

export async function updateAccount(user: Partial<User['account']>) {
	const authStore = useAuthStore();
	return await makeClientAPIRequest<User>('/v2/users/current', authStore.sessionToken, {
		method: 'PATCH',
		body: user
	});
}

export async function updateFieldPrivacy(privacy: Partial<User['account']['field_privacy']>) {
	const authStore = useAuthStore();
	return await makeClientAPIRequest<User>(
		'/v2/users/current/field_privacy',
		authStore.sessionToken,
		{
			method: 'PATCH',
			body: privacy
		}
	);
}

export async function regenerateAvatar() {
	const authStore = useAuthStore();
	const avatarStore = useAvatarStore();

	const res = await makeClientAPIRequest<Blob>(
		'/v2/users/current/profile_photo',
		authStore.sessionToken,
		{
			method: 'PUT',
			responseType: 'blob'
		}
	);

	// Clear avatar cache to force refetch
	const avatarUrl = authStore.currentUser?.account?.avatar_url;
	if (avatarUrl) {
		avatarStore.clear(avatarUrl);
	}

	return res;
}

export async function setUserActivities(activities: string[]) {
	const authStore = useAuthStore();
	return await makeClientAPIRequest<User>('/v2/users/current/activities', authStore.sessionToken, {
		method: 'PATCH',
		body: activities
	});
}

export async function setAccountType(id: string, type: User['account']['account_type']) {
	const authStore = useAuthStore();
	return await makeClientAPIRequest<User>(
		`/v2/users/${id}/account_type?type=${type.toLowerCase()}`,
		authStore.sessionToken,
		{
			method: 'PUT'
		}
	);
}

// Ocean

export async function getRecommendedActivities(poolLimit: number = 25) {
	const authStore = useAuthStore();
	const res = await makeAPIRequest<Activity[]>(
		'recommended_activities',
		`/v2/users/current/activities/recommend?pool_limit=${poolLimit}`,
		authStore.sessionToken,
		{}
	);

	if (res.success && res.data) {
		if ('message' in res.data) {
			return res;
		}

		// load recommended activities into state
		for (const activity of res.data) {
			useState<Activity | null>(`activity-${activity.id}`, () => activity);
		}
	}

	return res;
}

// Other Users

export async function getUsers(
	limit: number = 25,
	search: string = '',
	sort: SortingOption = 'desc'
) {
	const authStore = useAuthStore();
	return await paginatedAPIRequest<User>(
		`/v2/users`,
		authStore.sessionToken,
		{},
		limit,
		search,
		sort
	);
}

async function getUser(identifier?: string) {
	if (!identifier) return { success: true, data: undefined };

	const authStore = useAuthStore();
	return await makeAPIRequest<User>(
		`user-${identifier}`,
		`/v2/users/${identifier}`,
		authStore.sessionToken
	);
}

export function useUser(identifier: string) {
	const userStore = useUserStore();
	const avatarStore = useAvatarStore();

	const user = computed(() => userStore.get(identifier));

	const fetchUser = async (force: boolean = false) => {
		if (!identifier) return;
		return await userStore.fetchUser(identifier, force);
	};

	const avatarUrl = computed(() => user.value?.account?.avatar_url);

	const isRemoteUrl = (url: string | undefined): boolean => {
		if (!url) return false;
		return url.startsWith('http://') || url.startsWith('https://');
	};

	// Track preloaded URLs to prevent redundant fetches
	const preloadedUrls = new Set<string>();

	if (import.meta.client) {
		watch(
			avatarUrl,
			(newUrl) => {
				if (!newUrl || !isRemoteUrl(newUrl)) return;
				if (preloadedUrls.has(newUrl)) return; // Already requested

				preloadedUrls.add(newUrl);
				avatarStore.preloadAvatar(newUrl);
			},
			{ immediate: true }
		);
	}

	const avatar = computed(() => {
		const url = avatarUrl.value;
		if (!url || !isRemoteUrl(url)) return '/earth-app.png';
		return avatarStore.get(url)?.avatar || '/earth-app.png';
	});
	const avatar32 = computed(() => {
		const url = avatarUrl.value;
		if (!url || !isRemoteUrl(url)) return '/favicon.png';
		return avatarStore.get(url)?.avatar32 || '/favicon.png';
	});
	const avatar128 = computed(() => {
		const url = avatarUrl.value;
		if (!url || !isRemoteUrl(url)) return '/favicon.png';
		return avatarStore.get(url)?.avatar128 || '/favicon.png';
	});

	const chipColor = computed(() => userStore.getChipColor(user.value));
	const maxEventAttendees = computed(() => userStore.getMaxEventAttendees(user.value));

	const attendingEvents = computed(() => userStore.attendingEvents.get(identifier) || []);
	const attendingEventsCount = computed(() => attendingEvents.value.length);
	const fetchAttendingEvents = async () => {
		await userStore.fetchAttendingEvents(identifier);
	};

	const currentEvents = computed(() => userStore.hostingEvents.get(identifier) || []);
	const currentEventsCount = computed(() => currentEvents.value.length);
	const fetchCurrentEvents = async () => {
		await userStore.fetchHostingEvents(identifier);
	};

	const badges = computed(() => userStore.badges.get(identifier) || []);
	const fetchBadges = async () => {
		await userStore.fetchBadges(identifier);
	};

	const eventSubmissions = computed(() => userStore.eventSubmissions.get(identifier) || []);
	const fetchEventSubmissions = async () => {
		await userStore.fetchEventSubmissions(identifier);
	};

	return {
		user,
		fetchUser,
		avatar,
		avatar32,
		avatar128,
		chipColor,
		maxEventAttendees,
		attendingEvents,
		attendingEventsCount,
		fetchAttendingEvents,
		currentEvents,
		currentEventsCount,
		fetchCurrentEvents,
		badges,
		fetchBadges,
		eventSubmissions,
		fetchEventSubmissions
	};
}

// User Notifications

export function useNotifications() {
	const notificationStore = useNotificationStore();

	const notifications = computed(() => notificationStore.notifications);
	const unreadCount = computed(() => notificationStore.unreadCount);
	const hasWarnings = computed(() => notificationStore.hasWarnings);
	const hasErrors = computed(() => notificationStore.hasErrors);

	const fetch = async () => {
		await notificationStore.fetchNotifications();
	};

	return {
		notifications,
		unreadCount,
		hasWarnings,
		hasErrors,
		fetch
	};
}

export async function fetchNotifications() {
	const notificationStore = useNotificationStore();
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
}

export async function markNotificationRead(id: string) {
	const notificationStore = useNotificationStore();
	return await notificationStore.markRead(id);
}

export async function markNotificationUnread(id: string) {
	const notificationStore = useNotificationStore();
	return await notificationStore.markUnread(id);
}

export async function markAllNotificationsRead() {
	const notificationStore = useNotificationStore();
	return await notificationStore.markAllRead();
}

export async function markAllNotificationsUnread() {
	const notificationStore = useNotificationStore();
	return await notificationStore.markAllUnread();
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

// Email Verification

export async function sendVerificationEmail() {
	const authStore = useAuthStore();
	return await makeClientAPIRequest<{ message: string; email: string }>(
		`/v2/users/current/send_email_verification`,
		authStore.sessionToken,
		{
			method: 'POST'
		}
	);
}

export async function verifyEmail(code: string) {
	const authStore = useAuthStore();
	return await makeClientAPIRequest<{ message: string; email: string }>(
		`/v2/users/current/verify_email?code=${code}`,
		authStore.sessionToken,
		{
			method: 'POST'
		}
	);
}

// Password Change

export async function changePassword(currentPassword: string, newPassword: string) {
	const authStore = useAuthStore();
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
}

export async function sendResetPasswordEmail(email: string) {
	return await makeAPIRequest<void>(
		`reset-password-email-${email}`,
		`/v2/users/reset_password?email=${encodeURIComponent(email)}`,
		null,
		{
			method: 'POST'
		}
	);
}

export async function resetPassword(id: string, token: string, newPassword: string) {
	return await makeAPIRequest<{ message: string }>(
		`reset-password-${token}`,
		`/v2/users/${id}/change_password?token=${encodeURIComponent(token)}`,
		null,
		{
			method: 'POST',
			body: {
				new_password: newPassword
			}
		}
	);
}

// Account Deletion

export async function deleteAccount(password: string) {
	const authStore = useAuthStore();
	return await makeClientAPIRequest<void>(`/v2/users/current`, authStore.sessionToken, {
		method: 'DELETE',
		body: {
			password
		}
	});
}

// User Journeys

export async function getCurrentJourney(identifier: string, id: string) {
	if (!id) return { success: true, data: { count: 0 } };

	const authStore = useAuthStore();
	return await makeServerRequest<{ count: number; lastWrite?: number }>(
		`journey-${identifier}`,
		`/api/user/journey?type=${identifier}&id=${id}`,
		authStore.sessionToken
	);
}

export async function tapCurrentJourney(identifier: string, activity?: string) {
	const authStore = useAuthStore();
	return await makeServerRequest<{ count: number }>(
		null,
		`/api/user/journey?type=${identifier}${activity ? `&activity=${activity}` : ''}`,
		authStore.sessionToken,
		{
			method: 'POST'
		}
	);
}

export async function clearCurrentJourney(identifier: string) {
	const authStore = useAuthStore();
	return await makeServerRequest<void>(
		null,
		`/api/user/journey?type=${identifier}`,
		authStore.sessionToken,
		{
			method: 'DELETE'
		}
	);
}

export async function getCurrentJourneyRank(type: string, id: string) {
	const authStore = useAuthStore();
	return await makeServerRequest<{ rank: number }>(
		`journey-rank-${type}`,
		`/api/user/journeyRank?type=${type}&id=${id}`,
		authStore.sessionToken
	);
}

export async function getJourneyLeaderboard(type: string, limit: number = 10) {
	const authStore = useAuthStore();
	return await makeServerRequest<Omit<UserJourneyLeaderboardEntry, 'user'>[]>(
		`journey-leaderboard-${type}-limit-${limit}`,
		`/api/user/journeyLeaderboard?type=${type}&limit=${limit}`,
		authStore.sessionToken
	);
}

export function useJourneyLeaderboard(type: string) {
	const leaderboard = useState<UserJourneyLeaderboardEntry[]>(
		`journey-leaderboard-${type}`,
		() => []
	);

	const fetchLeaderboard = async (limit: number = 10) => {
		const res = await getJourneyLeaderboard(type, limit);
		if (res.success && res.data) {
			const userPromises = res.data.map(async (entry) => {
				const { user, fetchUser } = useUser(entry.id);
				await fetchUser();
				return {
					user: user.value!,
					id: entry.id,
					streak: entry.streak
				};
			});

			leaderboard.value = await Promise.all(userPromises);
		} else {
			leaderboard.value = [];
		}
	};

	if (leaderboard.value.length === 0) {
		fetchLeaderboard();
	}

	return {
		leaderboard,
		fetchLeaderboard
	};
}

// OAuth Utils

const microsoftAuth = () => {
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
		`state=microsoft`
	);
};

const googleAuth = () => {
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
		`state=google`
	);
};

const discordAuth = () => {
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
		`state=discord`
	);
};

const githubAuth = () => {
	const config = useRuntimeConfig();
	const linkUri = `${config.public.baseUrl}/api/auth/callback`;

	const clientId = config.public.githubClientId;
	const scope = 'user:email read:user';

	return (
		`https://github.com/login/oauth/authorize?` +
		`client_id=${clientId}&` +
		`redirect_uri=${encodeURIComponent(linkUri)}&` +
		`scope=${encodeURIComponent(scope)}&` +
		`state=github`
	);
};

const facebookAuth = () => {
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
		`state=facebook`
	);
};

export function authLink(provider: string) {
	switch (provider) {
		case 'google':
			return googleAuth();
		case 'microsoft':
			return microsoftAuth();
		case 'discord':
			return discordAuth();
		case 'github':
			return githubAuth();
		case 'facebook':
			return facebookAuth();
		default:
			throw new Error('Unsupported OAuth provider');
	}
}

// User Friends

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
