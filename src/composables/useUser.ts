import type { MaybeRefOrGetter } from 'vue';
import type { Activity } from '~/shared/types/activity';
import type { Event } from '~/shared/types/event';
import type { SortingOption } from '~/shared/types/global';
import type { User, UserBadge, UserNotification } from '~/shared/types/user';
import {
	getUserDisplayName,
	makeAPIRequest,
	makeClientAPIRequest,
	makeServerRequest,
	paginatedAPIRequest,
	realFullName
} from '~/shared/util';
import { useCurrentSessionToken } from './useLogin';

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

// Make the cache reactive so computed properties know when it updates
const globalAvatarCache = reactive(
	new Map<string, { avatar: string; avatar32: string; avatar128: string }>()
);

const avatarFetchQueue = new Map<
	string,
	Promise<{ avatar: string; avatar32: string; avatar128: string }>
>();

const userFetchQueue = new Map<string, Promise<void>>();
let authFetchQueue: Promise<void> | null = null;

async function fetchAvatarBlobsForUrl(
	url: string
): Promise<{ avatar: string; avatar32: string; avatar128: string }> {
	// Check global cache first
	const cached = globalAvatarCache.get(url);
	if (cached) {
		return cached;
	}

	// Check if already fetching this URL
	const existing = avatarFetchQueue.get(url);
	if (existing) {
		return existing;
	}

	// Initialize cache with loading placeholders immediately
	const initialCache = {
		avatar: '/earth-app.png',
		avatar32: '/favicon.png',
		avatar128: '/favicon.png'
	};
	globalAvatarCache.set(url, initialCache);

	// Create new fetch promise
	const fetchPromise = (async () => {
		try {
			const token = useCurrentSessionToken();
			const headers: HeadersInit = {};
			if (token) headers['Authorization'] = `Bearer ${token}`;

			// Fetch all sizes in parallel but update cache as each completes
			const fetchAndUpdate = async (
				size: 'avatar' | 'avatar32' | 'avatar128',
				sizeParam?: string
			) => {
				try {
					const fetchUrl = sizeParam ? `${url}?size=${sizeParam}` : url;
					const response = await fetch(fetchUrl, { headers });
					if (response.ok) {
						const blob = await response.blob();
						const objectUrl = URL.createObjectURL(blob);
						// Update cache immediately for this size
						const current = globalAvatarCache.get(url)!;
						globalAvatarCache.set(url, { ...current, [size]: objectUrl });
					}
				} catch (error) {
					console.warn(`Failed to fetch ${size} for ${url}:`, error);
				}
			};

			// Fetch all sizes in parallel
			await Promise.all([
				fetchAndUpdate('avatar'),
				fetchAndUpdate('avatar32', '32'),
				fetchAndUpdate('avatar128', '128')
			]);

			return globalAvatarCache.get(url)!;
		} catch (error) {
			console.warn(`Failed to fetch avatars for ${url}:`, error);
			return initialCache;
		} finally {
			// Clean up queue (but keep cache!)
			avatarFetchQueue.delete(url);
		}
	})();

	avatarFetchQueue.set(url, fetchPromise);
	return fetchPromise;
}

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
	if (import.meta.server) return;

	try {
		const response = await $fetch<{ session_token: string | null }>('/api/auth/session');
		if (response.session_token) {
			useCurrentSessionToken(response.session_token);
		}
	} catch (error) {
		console.error('Failed to sync session token:', error);
	}
}

export const useAuth = () => {
	const base = useUser('current');

	const fetchUser = async (force: boolean = false) => {
		if (import.meta.client && force) {
			await syncSessionToken();
		}

		return base.fetchUser();
	};

	return {
		...base,
		fetchUser
	};
};

export async function updateAccount(user: Partial<User['account']>) {
	return await makeClientAPIRequest<User>('/v2/users/current', useCurrentSessionToken(), {
		method: 'PATCH',
		body: user
	});
}

export async function updateFieldPrivacy(privacy: Partial<User['account']['field_privacy']>) {
	return await makeClientAPIRequest<User>(
		'/v2/users/current/field_privacy',
		useCurrentSessionToken(),
		{
			method: 'PATCH',
			body: privacy
		}
	);
}

export async function regenerateAvatar() {
	return await makeClientAPIRequest<Blob>(
		'/v2/users/current/profile_photo',
		useCurrentSessionToken(),
		{
			method: 'PUT',
			responseType: 'blob'
		}
	);
}

export async function setUserActivities(activities: string[]) {
	return await makeClientAPIRequest<User>(
		'/v2/users/current/activities',
		useCurrentSessionToken(),
		{
			method: 'PATCH',
			body: activities
		}
	);
}

export async function setAccountType(id: string, type: User['account']['account_type']) {
	return await makeClientAPIRequest<User>(
		`/v2/users/${id}/account_type?type=${type.toLowerCase()}`,
		useCurrentSessionToken(),
		{
			method: 'PUT'
		}
	);
}

// Ocean

export async function getRecommendedActivities(poolLimit: number = 25) {
	const res = await makeAPIRequest<Activity[]>(
		'recommended_activities',
		`/v2/users/current/activities/recommend?pool_limit=${poolLimit}`,
		useCurrentSessionToken(),
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
	return await paginatedAPIRequest<User>(
		`/v2/users`,
		useCurrentSessionToken(),
		{},
		limit,
		search,
		sort
	);
}

async function getUser(identifier?: string) {
	if (!identifier) return { success: true, data: undefined };

	return await makeAPIRequest<User>(
		`user-${identifier}`,
		`/v2/users/${identifier}`,
		useCurrentSessionToken()
	);
}

export function useUser(identifier: string) {
	const user = useState<User | null | undefined>(`user-${identifier}`, () => undefined);

	const fetchUser = async (force: boolean = false) => {
		if (!identifier) return;

		// Skip if already loaded and not forcing refresh
		if (user.value !== undefined && !force) return;

		// Check if already fetching this user
		const existingFetch = userFetchQueue.get(identifier);
		if (existingFetch && !force) {
			await existingFetch;
			return;
		}

		// Create new fetch promise
		const fetchPromise = (async () => {
			try {
				// Clear cache if forcing refresh
				if (force && import.meta.client) {
					await refreshNuxtData(`user-${identifier}`);
				}

				const res = await getUser(identifier);
				if (res.success && res.data) {
					if ('message' in res.data) {
						console.warn(`Failed to fetch user ${identifier}:`, res.data.message);
						user.value = null;
						return;
					}

					user.value = res.data;
				} else {
					console.warn(`Failed to fetch user ${identifier}:`, res.message);
					user.value = null;
				}
			} catch (error) {
				console.warn(`Failed to fetch user ${identifier}:`, error);
				user.value = null; // Set to null on error
			} finally {
				// Clean up queue
				userFetchQueue.delete(identifier);
			}
		})();

		userFetchQueue.set(identifier, fetchPromise);
		await fetchPromise;

		return user.value;
	};

	// If user is not loaded, fetch it (only on client side after mount)
	if (import.meta.client && user.value === undefined) {
		fetchUser();
	}

	const avatarUrl = computed(() => user.value?.account?.avatar_url);

	const isRemoteUrl = (url: string | undefined): boolean => {
		if (!url) return false;
		return url.startsWith('http://') || url.startsWith('https://');
	};

	// Trigger avatar fetch if not in cache
	if (import.meta.client && user.value) {
		const url = avatarUrl.value;
		if (url && isRemoteUrl(url) && !globalAvatarCache.has(url)) {
			fetchAvatarBlobsForUrl(url);
		}
	}

	// Watch for user changes to trigger avatar fetch (e.g., after async user load)
	if (import.meta.client) {
		watch(
			avatarUrl,
			(newUrl) => {
				if (newUrl && isRemoteUrl(newUrl) && !globalAvatarCache.has(newUrl)) {
					fetchAvatarBlobsForUrl(newUrl);
				}
			},
			{ immediate: true }
		);
	}

	const avatar = computed(() => {
		const url = avatarUrl.value;
		if (!url || !isRemoteUrl(url)) return '/earth-app.png';
		return globalAvatarCache.get(url)?.avatar || '/earth-app.png';
	});
	const avatar32 = computed(() => {
		const url = avatarUrl.value;
		if (!url || !isRemoteUrl(url)) return '/favicon.png';
		return globalAvatarCache.get(url)?.avatar32 || '/favicon.png';
	});
	const avatar128 = computed(() => {
		const url = avatarUrl.value;
		if (!url || !isRemoteUrl(url)) return '/favicon.png';
		return globalAvatarCache.get(url)?.avatar128 || '/favicon.png';
	});

	const chipColor = computed(() => {
		if (!user.value) return undefined;

		switch (user.value.account?.account_type) {
			case 'PRO':
				return 'secondary';
			case 'WRITER':
				return 'primary';
			case 'ORGANIZER':
				return 'warning';
			case 'ADMINISTRATOR':
				return 'error';
		}
	});

	const maxEventAttendees = computed(() => {
		if (!user.value) return 0;

		switch (user.value.account?.account_type) {
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
	});

	const attendingEvents = useState<Event[]>(`events-attending-${identifier}`, () => []);
	const attendingEventsCount = useState<number>(`events-attending-count-${identifier}`, () => 0);
	const fetchAttendingEvents = async () => {
		const res = await paginatedAPIRequest<Event>(
			`/v2/users/${identifier}/events/attending`,
			useCurrentSessionToken()
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				attendingEvents.value = [];
				return res;
			}

			attendingEvents.value = res.data;
			attendingEventsCount.value = res.data.length;
		} else {
			attendingEvents.value = [];
			attendingEventsCount.value = 0;
		}

		return res;
	};

	if (attendingEvents.value.length === 0) {
		fetchAttendingEvents();
	}

	const currentEvents = useState<Event[]>(`events-hosting-${identifier}`, () => []);
	const currentEventsCount = useState<number>(`events-hosting-count-${identifier}`, () => 0);
	const fetchCurrentEvents = async () => {
		const res = await paginatedAPIRequest<Event>(
			`/v2/users/${identifier}/events`,
			useCurrentSessionToken()
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				currentEvents.value = [];
				return res;
			}

			currentEvents.value = res.data;
			currentEventsCount.value = res.data.length;
		} else {
			currentEvents.value = [];
			currentEventsCount.value = 0;
		}

		return res;
	};

	if (currentEvents.value.length === 0) {
		fetchCurrentEvents();
	}

	const badges = useState<UserBadge[]>(`user-badges-${identifier}`, () => []);
	const fetchBadges = async () => {
		const res = await makeClientAPIRequest<UserBadge[]>(
			`/v2/users/${identifier}/badges`,
			useCurrentSessionToken()
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				badges.value = [];
				return res;
			}

			badges.value = res.data;
		} else {
			badges.value = [];
		}

		return res;
	};

	if (badges.value.length === 0) {
		fetchBadges();
	}

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
		fetchBadges
	};
}

// User Notifications

export function useNotifications() {
	const notifications = useState<UserNotification[]>('notifications', () => []);
	const unreadCount = useState<number>('notifications-unread-count', () => 0);
	const hasWarnings = useState<boolean>('notifications-has-warnings', () => false);
	const hasErrors = useState<boolean>('notifications-has-errors', () => false);

	const fetch = async () => {
		const token = useCurrentSessionToken();
		if (!token) {
			notifications.value = [];
			unreadCount.value = 0;
			hasWarnings.value = false;
			hasErrors.value = false;
			return;
		}

		const res = await fetchNotifications();
		if (res.success && res.data && 'items' in res.data) {
			notifications.value = res.data.items;

			// load individual notifications into state cache
			if (import.meta.client) {
				for (const n of res.data.items) {
					const state = useState<UserNotification | null | undefined>(`notification-${n.id}`);
					state.value = n;
				}
			}

			unreadCount.value = res.data.unread_count;
			hasWarnings.value = res.data.has_warnings;
			hasErrors.value = res.data.has_errors;
		}
	};

	if (notifications.value.length === 0) {
		fetch();
	}

	return {
		notifications,
		unreadCount,
		hasWarnings,
		hasErrors,
		fetch
	};
}

export async function fetchNotifications() {
	return await makeAPIRequest<{
		unread_count: number;
		has_warnings: boolean;
		has_errors: boolean;
		items: UserNotification[];
	}>('notifications-current', '/v2/users/current/notifications', useCurrentSessionToken());
}

export async function markNotificationRead(id: string) {
	const res = await makeClientAPIRequest<void>(
		`/v2/users/current/notifications/${id}/mark_read`,
		useCurrentSessionToken(),
		{
			method: 'POST'
		}
	);

	if (res.success) {
		const { notifications, unreadCount, fetch } = useNotifications();
		const notification = notifications.value.find((n) => n.id === id);
		if (notification) {
			notification.read = true;
			unreadCount.value = Math.max(0, unreadCount.value - 1);
		}

		// Update individual notification state regardless of whether it's in the array
		if (import.meta.client) {
			const individualNotification = useState<UserNotification | null | undefined>(
				`notification-${id}`
			);
			if (individualNotification.value) {
				individualNotification.value.read = true;
			}
		}

		// Refresh cached data and re-fetch notifications to ensure all views are updated
		if (import.meta.client) {
			await refreshNuxtData(`notification-${id}`);
			await refreshNuxtData('notifications-current');
			await fetch(); // Re-fetch to sync state
		}
	}

	return res;
}

export async function markNotificationUnread(id: string) {
	const res = await makeClientAPIRequest<void>(
		`/v2/users/current/notifications/${id}/mark_unread`,
		useCurrentSessionToken(),
		{
			method: 'POST'
		}
	);

	if (res.success) {
		const { notifications, unreadCount } = useNotifications();
		const notification = notifications.value.find((n) => n.id === id);
		if (notification) {
			notification.read = false;
			unreadCount.value += 1;

			if (import.meta.client) {
				const state = useState<UserNotification | null | undefined>(`notification-${id}`);
				state.value = notification;
			}
		}
	}

	return res;
}

export async function markAllNotificationsRead() {
	const res = await makeClientAPIRequest<void>(
		`/v2/users/current/notifications/mark_all_read`,
		useCurrentSessionToken(),
		{
			method: 'POST'
		}
	);

	if (res.success) {
		const { notifications, unreadCount } = useNotifications();
		for (const n of notifications.value) {
			n.read = true;

			if (import.meta.client) {
				const state = useState<UserNotification | null | undefined>(`notification-${n.id}`);
				state.value = n;
			}
		}
		unreadCount.value = 0;
	}

	return res;
}

export async function markAllNotificationsUnread() {
	const res = await makeClientAPIRequest<void>(
		`/v2/users/current/notifications/mark_all_unread`,
		useCurrentSessionToken(),
		{
			method: 'POST'
		}
	);

	if (res.success) {
		const { notifications, unreadCount } = useNotifications();
		for (const n of notifications.value) {
			n.read = false;

			if (import.meta.client) {
				const state = useState<UserNotification | null | undefined>(`notification-${n.id}`);
				state.value = n;
			}
		}
		unreadCount.value = notifications.value.length;
	}

	return res;
}

export function useNotification(id: string) {
	const notification = useState<UserNotification | null | undefined>(
		`notification-${id}`,
		() => undefined
	);

	const fetch = async () => {
		// Refresh cached data to ensure we get the latest notification
		if (import.meta.client) {
			await refreshNuxtData(`notification-${id}`);
		}

		const res = await makeAPIRequest<UserNotification>(
			`notification-${id}`,
			`/v2/users/current/notifications/${id}`,
			useCurrentSessionToken()
		);
		if (res.success && res.data && 'id' in res.data) {
			notification.value = res.data;
		} else {
			notification.value = null;
		}
	};

	if (!notification.value) {
		fetch();
	}

	return {
		notification,
		fetch
	};
}

export async function deleteNotification(id: string) {
	return await makeClientAPIRequest<void>(
		`/v2/users/current/notifications/${id}`,
		useCurrentSessionToken(),
		{
			method: 'DELETE'
		}
	);
}

// Email Verification

export async function sendVerificationEmail() {
	return await makeClientAPIRequest<{ message: string; email: string }>(
		`/v2/users/current/send_email_verification`,
		useCurrentSessionToken(),
		{
			method: 'POST'
		}
	);
}

export async function verifyEmail(code: string) {
	return await makeClientAPIRequest<{ message: string; email: string }>(
		`/v2/users/current/verify_email?code=${code}`,
		useCurrentSessionToken(),
		{
			method: 'POST'
		}
	);
}

// Password Change

export async function changePassword(currentPassword: string, newPassword: string) {
	return await makeClientAPIRequest<{ message: string }>(
		`/v2/users/current/change_password?old_password=${encodeURIComponent(currentPassword)}`,
		useCurrentSessionToken(),
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
	return await makeClientAPIRequest<void>(`/v2/users/current`, useCurrentSessionToken(), {
		method: 'DELETE',
		body: {
			password
		}
	});
}

// User Journeys

export async function getCurrentJourney(identifier: string, id: string) {
	if (!id) return { success: true, data: { count: 0 } };

	return await makeServerRequest<{ count: number; lastWrite?: number }>(
		`journey-${identifier}`,
		`/api/user/journey?type=${identifier}&id=${id}`,
		useCurrentSessionToken()
	);
}

export async function tapCurrentJourney(identifier: string, activity?: string) {
	return await makeServerRequest<{ count: number }>(
		null,
		`/api/user/journey?type=${identifier}${activity ? `&activity=${activity}` : ''}`,
		useCurrentSessionToken(),
		{
			method: 'POST'
		}
	);
}

export async function clearCurrentJourney(identifier: string) {
	return await makeServerRequest<void>(
		null,
		`/api/user/journey?type=${identifier}`,
		useCurrentSessionToken(),
		{
			method: 'DELETE'
		}
	);
}

export async function getCurrentJourneyRank(identifier: string, id: string) {
	return await makeServerRequest<{ rank: number }>(
		`journey-rank-${identifier}`,
		`/api/user/journeyRank?type=${identifier}&id=${id}`,
		useCurrentSessionToken()
	);
}

export async function getJourneyLeaderboard(identifier: string, limit: number = 10) {
	return await makeServerRequest<{ id: string; streak: number }[]>(
		`journey-leaderboard-${identifier}-limit-${limit}`,
		`/api/user/journeyLeaderboard?type=${identifier}&limit=${limit}`,
		useCurrentSessionToken()
	);
}

export function useJourneyLeaderboard(identifier: string) {
	const leaderboard = useState<{ user: User; id: string; streak: number }[]>(
		`journey-leaderboard-${identifier}`,
		() => []
	);

	const fetchLeaderboard = async (limit: number = 10) => {
		const res = await getJourneyLeaderboard(identifier, limit);
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
	const dataId = id || 'current';

	// friends functions

	const friends = useState<User[]>(`user-friends-${dataId}`, () => []);
	const fetchFriends = async (limit?: number, search?: string) => {
		const token = useCurrentSessionToken();
		if (!token) {
			friends.value = [];
			return;
		}

		const res = await paginatedAPIRequest<User>(
			`/v2/users/${dataId}/friends`,
			token,
			{},
			limit ?? 100,
			search
		);
		if (res.success && res.data) {
			if ('message' in res.data) {
				console.error('Failed to fetch friends:', res.data.message);
				friends.value = [];
				return;
			}

			friends.value = res.data;
		} else {
			console.error('Failed to fetch friends:', res.message);
			friends.value = [];
		}
	};

	const fetchFriendsPage = async (page: number, limit: number, search: string = '') => {
		const token = useCurrentSessionToken();
		if (!token) {
			return { success: false, message: 'Unauthenticated. Please log in to continue.' };
		}

		return await makeAPIRequest<{ items: User[]; total: number }>(
			`friends-${dataId}-page-${page}-limit-${limit}-search-${search}`,
			`/v2/users/${dataId}/friends?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`,
			token
		);
	};

	const addFriend = async (friend: string) => {
		const token = useCurrentSessionToken();
		if (!token) {
			return { success: false, message: 'Unauthenticated. Please log in to continue.' };
		}

		const res = await makeClientAPIRequest<{ user: User; friend: User; is_mutual: boolean }>(
			`/v2/users/${dataId}/friends?friend=${encodeURIComponent(friend)}`,
			token,
			{
				method: 'PUT'
			}
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

			const friend = res.data.friend;
			friends.value.push(friend);
		}

		return res;
	};

	const removeFriend = async (friend: string) => {
		const token = useCurrentSessionToken();
		if (!token) {
			return { success: false, message: 'Unauthenticated. Please log in to continue.' };
		}

		const res = await makeClientAPIRequest<{ user: User; friend: User; is_mutual: boolean }>(
			`/v2/users/${dataId}/friends?friend=${encodeURIComponent(friend)}`,
			token,
			{
				method: 'DELETE'
			}
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

			const friend = res.data.friend;
			friends.value = friends.value.filter((f) => f.id !== friend.id);
			circle.value = circle.value.filter((f) => f.id !== friend.id);
		}

		return res;
	};

	if (friends.value.length === 0) {
		fetchFriends();
	}

	// circle functions

	const circle = useState<User[]>(`user-circle-${dataId}`, () => []);
	const fetchCircle = async (limit?: number) => {
		const token = useCurrentSessionToken();
		if (!token) {
			circle.value = [];
			return;
		}

		const res = await paginatedAPIRequest<User>(
			`/v2/users/${dataId}/circle`,
			token,
			{},
			limit ?? 100
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				console.error('Failed to fetch circle:', res.data.message);
				circle.value = [];
				return;
			}

			circle.value = res.data;
		} else {
			console.error('Failed to fetch circle:', res.message);
			circle.value = [];
		}
	};

	const fetchCirclePage = async (page: number, limit: number) => {
		const token = useCurrentSessionToken();
		if (!token) {
			return { success: false, message: 'Unauthenticated. Please log in to continue.' };
		}

		return await makeAPIRequest<{ items: User[]; total: number }>(
			`circle-${dataId}-page-${page}-limit-${limit}`,
			`/v2/users/${dataId}/circle?page=${page}&limit=${limit}`,
			token
		);
	};

	const addToCircle = async (friend: string) => {
		const token = useCurrentSessionToken();
		if (!token) {
			return { success: false, message: 'Unauthenticated. Please log in to continue.' };
		}

		const res = await makeClientAPIRequest<{ user: User; friend: User; is_mutual: boolean }>(
			`/v2/users/${dataId}/circle?friend=${encodeURIComponent(friend)}`,
			token,
			{
				method: 'PUT'
			}
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

			const friend = res.data.friend;
			circle.value.push(friend);
		}

		return res;
	};

	const removeFromCircle = async (friend: string) => {
		const token = useCurrentSessionToken();
		if (!token) {
			return { success: false, message: 'Unauthenticated. Please log in to continue.' };
		}

		const res = await makeClientAPIRequest<{ user: User; friend: User; is_mutual: boolean }>(
			`/v2/users/${dataId}/circle?friend=${encodeURIComponent(friend)}`,
			token,
			{
				method: 'DELETE'
			}
		);

		if (res.success && res.data) {
			if ('message' in res.data) {
				return res;
			}

			const friend = res.data.friend;
			circle.value = circle.value.filter((f) => f.id !== friend.id);
		}

		return res;
	};

	if (circle.value.length === 0) {
		fetchCircle();
	}

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
