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
	const visitedSite = useState<boolean>('visited-site', () => false);

	const markVisited = () => {
		visitedSite.value = true;
	};

	return {
		visitedSite,
		markVisited
	};
}

// Display name composable (moved from src/composables/useDisplayName.ts)
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

export async function useCurrentUser() {
	const token = useCurrentSessionToken();
	if (!token) {
		return { success: false, message: 'Unauthenticated. Please log in to continue.' };
	}

	const result = await makeAPIRequest<User>('user-current', '/v2/users/current', token);
	if (!result.success && 'code' in (result.data || {}) && (result.data as any).code === 401) {
		// remove invalid token
		useCurrentSessionToken(null);
	}

	return result;
}

export const useAuth = () => {
	const user = useState<User | null | undefined>('user', () => undefined);
	const token = useCurrentSessionToken();

	if (!token) {
		// only set to null if it hasn't been initialized yet to avoid flashing
		if (user.value === undefined) {
			user.value = null;
		}

		return {
			user,
			fetchUser: async () => {},
			avatar: computed(() => '/earth-app.png'),
			avatar32: computed(() => '/favicon.png'),
			avatar128: computed(() => '/earth-app.png')
		};
	}

	const fetchUser = async (force: boolean = false) => {
		if (!force && user.value !== undefined) return; // only fetch if truly uninitialized or forced

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

	// if user is not loaded, fetch it in the next tick to avoid async context issues
	if (user.value === undefined) {
		if (import.meta.server) {
			try {
				fetchUser();
			} catch (e) {
				console.error('Error fetching user on server:', e);
			}
		} else {
			fetchUser();
		}
	}

	const avatarUrl = computed(() => user.value?.account?.avatar_url);
	const validatedUrls = ref<{ avatar: string; avatar32: string; avatar128: string } | null>(null);

	if (import.meta.client) {
		watch(
			avatarUrl,
			async (url) => {
				if (!url) {
					validatedUrls.value = {
						avatar: '/earth-app.png',
						avatar32: '/favicon.png',
						avatar128: '/favicon.png'
					};
					return;
				}

				try {
					const response = await fetch(url, { method: 'HEAD' });
					if (response.ok) {
						validatedUrls.value = {
							avatar: url,
							avatar32: `${url}?size=32`,
							avatar128: `${url}?size=128`
						};
					} else {
						// 404 or other error - use fallbacks
						validatedUrls.value = {
							avatar: '/earth-app.png',
							avatar32: '/favicon.png',
							avatar128: '/favicon.png'
						};
					}
				} catch {
					// network error - use fallbacks
					validatedUrls.value = {
						avatar: '/earth-app.png',
						avatar32: '/favicon.png',
						avatar128: '/favicon.png'
					};
				}
			},
			{ immediate: true }
		);
	}

	const avatar = computed(() => {
		if (validatedUrls.value) return validatedUrls.value.avatar;
		return avatarUrl.value || '/earth-app.png';
	});
	const avatar32 = computed(() => {
		if (validatedUrls.value) return validatedUrls.value.avatar32;
		return avatarUrl.value ? `${avatarUrl.value}?size=32` : '/favicon.png';
	});
	const avatar128 = computed(() => {
		if (validatedUrls.value) return validatedUrls.value.avatar128;
		return avatarUrl.value ? `${avatarUrl.value}?size=128` : '/earth-app.png';
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
		null,
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
		null,
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
			if (res.success && res.data && 'id' in res.data) {
				user.value = res.data;
			} else {
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
	const validatedUrls = ref<{ avatar: string; avatar32: string; avatar128: string } | null>(null);

	if (import.meta.client) {
		watch(
			avatarUrl,
			async (url) => {
				if (!url) {
					validatedUrls.value = {
						avatar: '/earth-app.png',
						avatar32: '/favicon.png',
						avatar128: '/favicon.png'
					};
					return;
				}

				try {
					const response = await fetch(url, { method: 'HEAD' });
					if (response.ok) {
						validatedUrls.value = {
							avatar: url,
							avatar32: `${url}?size=32`,
							avatar128: `${url}?size=128`
						};
					} else {
						// 404 or other error - use fallbacks
						validatedUrls.value = {
							avatar: '/earth-app.png',
							avatar32: '/favicon.png',
							avatar128: '/favicon.png'
						};
					}
				} catch {
					// network error - use fallbacks
					validatedUrls.value = {
						avatar: '/earth-app.png',
						avatar32: '/favicon.png',
						avatar128: '/favicon.png'
					};
				}
			},
			{ immediate: true }
		);
	}

	const avatar = computed(() => {
		if (validatedUrls.value) return validatedUrls.value.avatar;
		return avatarUrl.value || '/earth-app.png';
	});
	const avatar32 = computed(() => {
		if (validatedUrls.value) return validatedUrls.value.avatar32;
		return avatarUrl.value ? `${avatarUrl.value}?size=32` : '/favicon.png';
	});
	const avatar128 = computed(() => {
		if (validatedUrls.value) return validatedUrls.value.avatar128;
		return avatarUrl.value ? `${avatarUrl.value}?size=128` : '/earth-app.png';
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
					useState<UserNotification>(`notification-${n.id}`, () => n);
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
		const { notifications, unreadCount } = useNotifications();
		const notification = notifications.value.find((n) => n.id === id);
		if (notification) {
			notification.read = true;
			unreadCount.value = Math.max(0, unreadCount.value - 1);
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
