import type { MaybeRefOrGetter } from 'vue';
import type { Activity } from '~/shared/types/activity';
import type { SortingOption } from '~/shared/types/global';
import type { User, UserNotification } from '~/shared/types/user';
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
	const visitedSite = computed(() => visitedSiteCookie.value === 'true');

	const markVisited = () => {
		visitedSiteCookie.value = 'true';
	};

	return {
		visitedSite,
		visitedSiteCookie,
		markVisited
	};
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

export async function useCurrentUser() {
	const token = useCurrentSessionToken();
	if (!token) {
		return { success: false, message: 'Unauthenticated. Please log in to continue.' };
	}

	// Don't use caching to ensure fresh user data on each request
	// This prevents stale state issues on hard refresh
	const result = await makeClientAPIRequest<User>('/v2/users/current', token);
	if (!result.success && 'code' in (result.data || {}) && (result.data as any).code === 401) {
		// remove invalid token
		useCurrentSessionToken(null);
	}

	return result;
}

export const useAuth = () => {
	const user = useState<User | null | undefined>('user', () => undefined);

	const fetchUser = async (force: boolean = false) => {
		if (import.meta.client && force) {
			await syncSessionToken();
		}

		// check if token exists before fetching
		const currentToken = useCurrentSessionToken();
		if (!currentToken) {
			user.value = null;
			return;
		}

		if (!force && user.value !== undefined && user.value !== null) return; // only fetch if uninitialized or forced

		const res = await useCurrentUser();
		if (res.success && res.data) {
			if ('message' in res.data) {
				// API returned an error message
				user.value = null;
				console.error('Failed to fetch current user:', res.data.message);
				return;
			}

			user.value = res.data;
		} else {
			console.error('Failed to fetch current user:', res.message);
			user.value = null;
		}
	};

	// if user is not loaded, fetch it
	if (user.value === undefined) {
		if (import.meta.server) {
			try {
				fetchUser();
			} catch (e) {
				console.error('Error fetching user on server:', e);
			}
		} else {
			// On client, immediately fetch to minimize flash
			fetchUser();
		}
	}

	const avatarUrl = computed(() => user.value?.account?.avatar_url);
	const blobUrls = ref<{
		avatar: string | null;
		avatar32: string | null;
		avatar128: string | null;
	} | null>(null);

	const isRemoteUrl = (url: string | undefined): boolean => {
		if (!url) return false;
		return url.startsWith('http://') || url.startsWith('https://');
	};

	const fetchAuthenticatedImage = async (url: string): Promise<string | null> => {
		try {
			const token = useCurrentSessionToken();
			const headers: HeadersInit = {};
			if (token) {
				headers['Authorization'] = `Bearer ${token}`;
			}

			const response = await fetch(url, { headers });
			if (response.ok) {
				const blob = await response.blob();
				return URL.createObjectURL(blob);
			}
			return null;
		} catch {
			return null;
		}
	};

	if (import.meta.client) {
		watch(
			avatarUrl,
			async (url, _) => {
				if (blobUrls.value) {
					const avatar = blobUrls.value.avatar;
					const avatar32 = blobUrls.value.avatar32;
					const avatar128 = blobUrls.value.avatar128;

					if (avatar?.startsWith('blob:')) URL.revokeObjectURL(avatar);
					if (avatar32?.startsWith('blob:')) URL.revokeObjectURL(avatar32);
					if (avatar128?.startsWith('blob:')) URL.revokeObjectURL(avatar128);
				}

				if (!url || !isRemoteUrl(url)) {
					blobUrls.value = {
						avatar: '/earth-app.png',
						avatar32: '/favicon.png',
						avatar128: '/favicon.png'
					};
					return;
				}

				// Set to null while loading
				blobUrls.value = {
					avatar: null,
					avatar32: null,
					avatar128: null
				};

				// fetch images with authentication
				const [avatarBlob, avatar32Blob, avatar128Blob] = await Promise.all([
					fetchAuthenticatedImage(url),
					fetchAuthenticatedImage(`${url}?size=32`),
					fetchAuthenticatedImage(`${url}?size=128`)
				]);

				blobUrls.value = {
					avatar: avatarBlob || '/earth-app.png',
					avatar32: avatar32Blob || '/favicon.png',
					avatar128: avatar128Blob || '/earth-app.png'
				};
			},
			{ immediate: true }
		);
	}

	const avatar = computed(() => {
		if (blobUrls.value) return blobUrls.value.avatar || undefined;
		return undefined;
	});
	const avatar32 = computed(() => {
		if (blobUrls.value) return blobUrls.value.avatar32 || undefined;
		return undefined;
	});
	const avatar128 = computed(() => {
		if (blobUrls.value) return blobUrls.value.avatar128 || undefined;
		return undefined;
	});

	return {
		user,
		fetchUser,
		avatar,
		avatar32,
		avatar128
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
		`users-${search}-${limit}`,
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

	if (identifier === 'current') {
		return await useCurrentUser();
	}

	return await makeAPIRequest<User>(
		`user-${identifier}`,
		`/v2/users/${identifier}`,
		useCurrentSessionToken()
	);
}

export function useUser(identifier: string) {
	const user = useState<User | null | undefined>(`user-${identifier}`, () => undefined);

	const fetchUser = async () => {
		if (!identifier) return;
		if (user.value !== undefined) return; // Only fetch if truly uninitialized

		try {
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
		}
	};

	// If user is not loaded, fetch it
	if (user.value === undefined) {
		fetchUser();
	}

	const avatarUrl = computed(() => user.value?.account?.avatar_url);
	const blobUrls = useState<{
		avatar: string | null;
		avatar32: string | null;
		avatar128: string | null;
	} | null>(`user-avatar-blobs-${identifier}`, () => null);

	const isRemoteUrl = (url: string | undefined): boolean => {
		if (!url) return false;
		return url.startsWith('http://') || url.startsWith('https://');
	};

	const fetchAuthenticatedImage = async (url: string): Promise<string | null> => {
		try {
			const token = useCurrentSessionToken();
			const headers: HeadersInit = {};
			if (token) {
				headers['Authorization'] = `Bearer ${token}`;
			}

			const response = await fetch(url, { headers });
			if (response.ok) {
				const blob = await response.blob();
				return URL.createObjectURL(blob);
			}
			return null;
		} catch {
			return null;
		}
	};

	if (import.meta.client) {
		watch(
			avatarUrl,
			async (url, _) => {
				if (blobUrls.value) {
					const avatar = blobUrls.value.avatar;
					const avatar32 = blobUrls.value.avatar32;
					const avatar128 = blobUrls.value.avatar128;

					if (avatar?.startsWith('blob:')) URL.revokeObjectURL(avatar);
					if (avatar32?.startsWith('blob:')) URL.revokeObjectURL(avatar32);
					if (avatar128?.startsWith('blob:')) URL.revokeObjectURL(avatar128);
				}

				if (!url || !isRemoteUrl(url)) {
					blobUrls.value = {
						avatar: '/earth-app.png',
						avatar32: '/favicon.png',
						avatar128: '/favicon.png'
					};
					return;
				}

				// Set to null while loading
				blobUrls.value = {
					avatar: null,
					avatar32: null,
					avatar128: null
				};

				const [avatarBlob, avatar32Blob, avatar128Blob] = await Promise.all([
					fetchAuthenticatedImage(url),
					fetchAuthenticatedImage(`${url}?size=32`),
					fetchAuthenticatedImage(`${url}?size=128`)
				]);

				blobUrls.value = {
					avatar: avatarBlob || '/earth-app.png',
					avatar32: avatar32Blob || '/favicon.png',
					avatar128: avatar128Blob || '/earth-app.png'
				};
			},
			{ immediate: true }
		);
	}

	const avatar = computed(() => {
		if (blobUrls.value) return blobUrls.value.avatar || undefined;
		return undefined;
	});
	const avatar32 = computed(() => {
		if (blobUrls.value) return blobUrls.value.avatar32 || undefined;
		return undefined;
	});
	const avatar128 = computed(() => {
		if (blobUrls.value) return blobUrls.value.avatar128 || undefined;
		return undefined;
	});

	return {
		user,
		fetchUser,
		avatar,
		avatar32,
		avatar128
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
		`/api/user/journey/clear?type=${identifier}`,
		useCurrentSessionToken(),
		{
			method: 'POST'
		}
	);
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
			`friends-${dataId}`,
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
			`user-circle-${dataId}`,
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
