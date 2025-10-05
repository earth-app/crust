import type { Activity } from '~/shared/types/activity';
import type { User, UserNotification } from '~/shared/types/user';
import { makeAPIRequest, makeClientAPIRequest, paginatedAPIRequest } from '~/shared/util';
import { useCurrentSessionToken } from './useLogin';

export async function useCurrentUser() {
	const token = useCurrentSessionToken();
	if (!token) {
		return { success: false, message: 'Unauthenticated. Please log in to continue.' };
	}

	return await makeAPIRequest<User>('user-current', '/v2/users/current', token);
}

export async function useCurrentAvatar() {
	const token = useCurrentSessionToken();
	if (!token) {
		return { success: false, message: 'Unauthenticated. Please log in to continue.' };
	}

	return await makeAPIRequest<Blob>('avatar-current', '/v2/users/current/profile_photo', token, {
		responseType: 'blob'
	});
}

export const useAuth = () => {
	const user = useState<User | null>('user', () => null);
	const photo = import.meta.client
		? useState<Blob | null>('avatar', () => null)
		: ref<Blob | null>(null);

	const token = useCurrentSessionToken();
	if (!token) return { user, photo, fetchUser: async () => {}, fetchPhoto: async () => {} };

	const fetchUser = async () => {
		if (user.value) return;

		const res = await useCurrentUser();
		if (res.success && res.data && 'id' in res.data) {
			user.value = res.data;
		} else {
			user.value = null;
			console.error('Failed to fetch current user:', res.data?.message || res.message);
		}
	};

	// If user is not loaded, fetch it
	if (!user.value) {
		fetchUser();
	}

	const fetchPhoto = async () => {
		if (photo.value) return;

		const res = await useCurrentAvatar();
		if (res.success && res.data && res.data instanceof Blob) {
			photo.value = res.data;
		} else {
			photo.value = null;
			console.error('Failed to fetch current user avatar:', res.message);
		}
	};

	// If photo is not loaded, fetch it
	if (!photo.value) {
		fetchPhoto();
	}

	return {
		user,
		fetchUser,
		photo,
		fetchPhoto
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
	return await makeAPIRequest<Activity[]>(
		null,
		`/v2/users/current/activities/recommend?pool_limit=${poolLimit}`,
		useCurrentSessionToken(),
		{}
	);
}

// Other Users

export async function getUsers(limit: number = 25, search: string = '') {
	return await paginatedAPIRequest<User>(
		`users-${search}-${limit}`,
		`/v2/users`,
		useCurrentSessionToken(),
		{},
		limit,
		search
	);
}

export async function getUser(identifier?: string) {
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

export async function getUserAvatar(identifier?: string) {
	if (!identifier) return { success: true, data: undefined };

	if (identifier === 'current') {
		return await useCurrentAvatar();
	}

	return await makeAPIRequest<Blob>(
		`avatar-${identifier}`,
		`/v2/users/${identifier}/profile_photo`,
		useCurrentSessionToken(),
		{
			responseType: 'blob'
		}
	);
}

export function useUser(identifier: string) {
	const user = useState<User | null | undefined>(`user-${identifier}`, () => undefined);
	const photo = import.meta.client
		? useState<Blob | null>(`photo-${identifier}`, () => null)
		: ref<Blob | null>(null);

	const fetchUser = async () => {
		if (!identifier) return;
		if (user.value) return;

		try {
			const res = await getUser(identifier);
			if (res.success && res.data && 'id' in res.data) {
				user.value = res.data;
			} else {
				user.value = null;
			}
		} catch (error) {
			console.warn(`Failed to fetch user ${identifier}:`, error);
		}
	};

	// If user is not loaded, fetch it
	if (!user.value) {
		fetchUser();
	}

	const fetchPhoto = async () => {
		if (!identifier) return;
		if (photo.value) return;

		try {
			const res = await getUserAvatar(identifier);
			if (res.success && res.data && res.data instanceof Blob) {
				photo.value = res.data;
			}
		} catch (error) {
			console.warn(`Failed to fetch photo for user ${identifier}:`, error);
		}
	};

	// If photo is not loaded, fetch it
	if (!photo.value) {
		fetchPhoto();
	}

	return {
		user,
		fetchUser,
		photo,
		fetchPhoto
	};
}

// User Notifications

export function useNotifications() {
	const notifications = useState<UserNotification[]>('notifications', () => []);
	const unreadCount = useState<number>('notifications-unread-count', () => 0);
	const hasWarnings = useState<boolean>('notifications-has-warnings', () => false);
	const hasErrors = useState<boolean>('notifications-has-errors', () => false);

	const fetch = async () => {
		const res = await fetchNotifications();
		if (res.success && res.data && 'items' in res.data) {
			notifications.value = res.data.items;

			// load individual notifications
			if (import.meta.client)
				notifications.value.forEach((n) => {
					useNotification(n.id);
				});

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
		notifications.value = notifications.value.map((n) => {
			if (n.id === id) {
				n.read = true;
			}
			return n;
		});
		unreadCount.value = Math.max(0, unreadCount.value - 1);
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
		notifications.value = notifications.value.map((n) => {
			if (n.id === id) {
				n.read = false;
			}
			return n;
		});
		unreadCount.value += 1;
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
		notifications.value = notifications.value.map((n) => {
			n.read = true;
			return n;
		});
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
		notifications.value = notifications.value.map((n) => {
			n.read = false;
			return n;
		});
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
