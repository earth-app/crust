import { defineStore } from 'pinia';
import type { UserNotification } from 'types/user';
import { invalidateAPICache, makeAPIRequest, makeClientAPIRequest } from 'utils';
import { computed, reactive, ref } from 'vue';
import { useAuthStore } from './auth';

export const useNotificationStore = defineStore('notification', () => {
	const notifications = ref<UserNotification[]>([]);
	const unreadCount = ref(0);
	const hasWarnings = ref(false);
	const hasErrors = ref(false);
	const isLoading = ref(false);
	const fetchPromise = ref<Promise<void> | null>(null);

	const cache = reactive(new Map<string, UserNotification>());

	const unreadNotifications = computed(() => notifications.value.filter((n) => !n.read));
	const readNotifications = computed(() => notifications.value.filter((n) => n.read));

	const fetchNotifications = async (force: boolean = false) => {
		const authStore = useAuthStore();
		if (!authStore.sessionToken) {
			notifications.value = [];
			unreadCount.value = 0;
			hasWarnings.value = false;
			hasErrors.value = false;
			return;
		}

		if (fetchPromise.value && !force) {
			await fetchPromise.value;
			return;
		}

		if (force) {
			invalidateAPICache('notifications-current');
		}

		isLoading.value = true;

		fetchPromise.value = (async () => {
			try {
				const res = await makeAPIRequest<{
					unread_count: number;
					has_warnings: boolean;
					has_errors: boolean;
					items: UserNotification[];
				}>('notifications-current', '/v2/users/current/notifications', authStore.sessionToken);

				if (valid(res)) {
					notifications.value = res.data.items;

					for (const n of res.data.items) {
						cache.set(n.id, n);
					}

					unreadCount.value = res.data.unread_count;
					hasWarnings.value = res.data.has_warnings;
					hasErrors.value = res.data.has_errors;
				}
			} catch (error) {
				console.warn('Failed to fetch notifications:', error);
			} finally {
				isLoading.value = false;
				fetchPromise.value = null;
			}
		})();

		await fetchPromise.value;
	};

	const fetchNotification = async (id: string): Promise<UserNotification | null> => {
		const authStore = useAuthStore();

		if (import.meta.client) {
			await refreshNuxtData(`notification-${id}`);
		}

		const res = await makeAPIRequest<UserNotification>(
			`notification-${id}`,
			`/v2/users/current/notifications/${id}`,
			authStore.sessionToken
		);

		if (valid(res)) {
			cache.set(id, res.data);
			return res.data;
		}

		return null;
	};

	const markRead = async (id: string) => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<void>(
			`/v2/users/current/notifications/${id}/mark_read`,
			authStore.sessionToken,
			{ method: 'POST' }
		);

		if (res.success) {
			const notification = notifications.value.find((n) => n.id === id);
			if (notification) {
				// only adjust the count on a real unread→read transition
				if (!notification.read) {
					unreadCount.value = Math.max(0, unreadCount.value - 1);
				}
				notification.read = true;
			}

			const cached = cache.get(id);
			if (cached) {
				cached.read = true;
			}

			invalidateAPICache(`notification-${id}`);
			invalidateAPICache('notifications-current');

			if (import.meta.client) {
				await refreshNuxtData(`notification-${id}`);
				await refreshNuxtData('notifications-current');
			}
		}

		return res;
	};

	const markUnread = async (id: string) => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<void>(
			`/v2/users/current/notifications/${id}/mark_unread`,
			authStore.sessionToken,
			{ method: 'POST' }
		);

		if (res.success) {
			const notification = notifications.value.find((n) => n.id === id);
			if (notification) {
				// only adjust the count on a real read→unread transition
				if (notification.read) {
					unreadCount.value += 1;
				}
				notification.read = false;
			}

			const cached = cache.get(id);
			if (cached) {
				cached.read = false;
			}

			invalidateAPICache(`notification-${id}`);
			invalidateAPICache('notifications-current');
		}

		return res;
	};

	const markAllRead = async () => {
		const authStore = useAuthStore();

		const previous = notifications.value.map((n) => ({ id: n.id, read: n.read }));
		const previousUnread = unreadCount.value;

		for (const n of notifications.value) {
			n.read = true;
			const cached = cache.get(n.id);
			if (cached) {
				cached.read = true;
			}
		}
		unreadCount.value = 0;
		invalidateAPICache('notifications-current');

		const res = await makeClientAPIRequest<void>(
			`/v2/users/current/notifications/mark_all_read`,
			authStore.sessionToken,
			{ method: 'POST' }
		);

		if (!res.success) {
			for (const { id, read } of previous) {
				const n = notifications.value.find((x) => x.id === id);
				if (n) n.read = read;
				const cached = cache.get(id);
				if (cached) cached.read = read;
			}
			unreadCount.value = previousUnread;
		}

		return res;
	};

	const markAllUnread = async () => {
		const authStore = useAuthStore();

		const previous = notifications.value.map((n) => ({ id: n.id, read: n.read }));
		const previousUnread = unreadCount.value;

		for (const n of notifications.value) {
			n.read = false;
			const cached = cache.get(n.id);
			if (cached) {
				cached.read = false;
			}
		}
		unreadCount.value = notifications.value.length;
		invalidateAPICache('notifications-current');

		const res = await makeClientAPIRequest<void>(
			`/v2/users/current/notifications/mark_all_unread`,
			authStore.sessionToken,
			{ method: 'POST' }
		);

		if (!res.success) {
			for (const { id, read } of previous) {
				const n = notifications.value.find((x) => x.id === id);
				if (n) n.read = read;
				const cached = cache.get(id);
				if (cached) cached.read = read;
			}
			unreadCount.value = previousUnread;
		}

		return res;
	};

	const deleteNotification = async (id: string) => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<void>(
			`/v2/users/current/notifications/${id}`,
			authStore.sessionToken,
			{ method: 'DELETE' }
		);

		if (res.success) {
			const removed = notifications.value.find((n) => n.id === id);
			notifications.value = notifications.value.filter((n) => n.id !== id);
			cache.delete(id);
			if (removed && !removed.read) {
				unreadCount.value = Math.max(0, unreadCount.value - 1);
			}
			invalidateAPICache(`notification-${id}`);
			invalidateAPICache('notifications-current');
		}

		return res;
	};

	const clearAll = async () => {
		const authStore = useAuthStore();

		const previous = notifications.value.slice();
		const previousUnread = unreadCount.value;

		notifications.value = [];
		unreadCount.value = 0;
		cache.clear();
		invalidateAPICache('notifications-current');

		const res = await makeClientAPIRequest<void>(
			`/v2/users/current/notifications/clear`,
			authStore.sessionToken,
			{ method: 'DELETE' }
		);

		if (!res.success) {
			notifications.value = previous;
			unreadCount.value = previousUnread;
			for (const n of previous) {
				cache.set(n.id, n);
			}
		}

		return res;
	};

	const addLiveNotification = (notification: UserNotification) => {
		if (notifications.value.some((n) => n.id === notification.id)) return;

		notifications.value = [notification, ...notifications.value];
		cache.set(notification.id, notification);
		if (!notification.read) {
			unreadCount.value += 1;
		}
		if (notification.type === 'warning') hasWarnings.value = true;
		if (notification.type === 'error') hasErrors.value = true;

		invalidateAPICache('notifications-current');
	};

	return {
		notifications,
		unreadCount,
		hasWarnings,
		hasErrors,
		isLoading,
		cache,
		unreadNotifications,
		readNotifications,
		fetchNotifications,
		fetchNotification,
		markRead,
		markUnread,
		markAllRead,
		markAllUnread,
		deleteNotification,
		clearAll,
		addLiveNotification
	};
});
