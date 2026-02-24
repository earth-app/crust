import { defineStore } from 'pinia';
import type { UserNotification } from '~/shared/types/user';
import { makeAPIRequest, makeClientAPIRequest } from '~/shared/utils/util';
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

		isLoading.value = true;

		fetchPromise.value = (async () => {
			try {
				const res = await makeAPIRequest<{
					unread_count: number;
					has_warnings: boolean;
					has_errors: boolean;
					items: UserNotification[];
				}>('notifications-current', '/v2/users/current/notifications', authStore.sessionToken);

				if (res.success && res.data && 'items' in res.data) {
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

		if (res.success && res.data && 'id' in res.data) {
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
				notification.read = true;
				unreadCount.value = Math.max(0, unreadCount.value - 1);
			}

			const cached = cache.get(id);
			if (cached) {
				cached.read = true;
			}

			// refresh cached data
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
				notification.read = false;
				unreadCount.value += 1;
			}

			const cached = cache.get(id);
			if (cached) {
				cached.read = false;
			}
		}

		return res;
	};

	const markAllRead = async () => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<void>(
			`/v2/users/current/notifications/mark_all_read`,
			authStore.sessionToken,
			{ method: 'POST' }
		);

		if (res.success) {
			for (const n of notifications.value) {
				n.read = true;
				const cached = cache.get(n.id);
				if (cached) {
					cached.read = true;
				}
			}
			unreadCount.value = 0;
		}

		return res;
	};

	const markAllUnread = async () => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<void>(
			`/v2/users/current/notifications/mark_all_unread`,
			authStore.sessionToken,
			{ method: 'POST' }
		);

		if (res.success) {
			for (const n of notifications.value) {
				n.read = false;
				const cached = cache.get(n.id);
				if (cached) {
					cached.read = false;
				}
			}
			unreadCount.value = notifications.value.length;
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
			notifications.value = notifications.value.filter((n) => n.id !== id);
			cache.delete(id);
		}

		return res;
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
		deleteNotification
	};
});
