import type { ButtonProps } from '@nuxt/ui';
import { useAuthStore } from 'stores/auth';
import { useNotificationStore } from 'stores/notification';
import { useUserStore } from 'stores/user';
import type { UserNotification } from 'types/user';

export default defineNuxtPlugin((nuxtApp) => {
	const toast = useToast();
	const router = useRouter();
	const config = useRuntimeConfig();
	const notificationStore = useNotificationStore();

	let ws: WebSocket | null = null;
	// "https://" -> "wss://"
	const websocketRoot = config.public.cloudBaseUrl.replace(/http/g, 'ws');

	// defer to idle to increase hydration speed
	const scheduleIdle = (cb: () => void) => {
		if (typeof window === 'undefined') return;
		const ric = (window as any).requestIdleCallback as
			| ((cb: IdleRequestCallback, opts?: IdleRequestOptions) => number)
			| undefined;
		if (ric) ric(() => cb(), { timeout: 2_000 });
		else setTimeout(cb, 0);
	};

	nuxtApp.hook('app:mounted', () => {
		const setup = () => {
			const { user } = useAuth();
			const authStore = useAuthStore();
			const userStore = useUserStore();

			// reconnect bookkeeping
			let connectedUserId: string | null = null;
			let reconnectAttempts = 0;
			let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
			let teardown = false;
			const MAX_RECONNECT_ATTEMPTS = 8;
			const BASE_DELAY_MS = 1_000;
			const MAX_DELAY_MS = 30_000;

			const clearReconnectTimer = () => {
				if (reconnectTimer) {
					clearTimeout(reconnectTimer);
					reconnectTimer = null;
				}
			};

			const scheduleReconnect = (userId: string) => {
				if (teardown) return;
				if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
					console.warn('WebSocket reconnect attempts exhausted; giving up until refocus.');
					return;
				}
				const delay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * Math.pow(2, reconnectAttempts));
				reconnectAttempts += 1;
				clearReconnectTimer();
				reconnectTimer = setTimeout(() => {
					reconnectTimer = null;
					// user may have logged out or switched while we were waiting
					if (teardown || !user.value || user.value.id !== userId) return;
					attemptConnect(userId, authStore.sessionToken);
				}, delay);
			};

			const attemptConnect = (userId: string, token: string | null) => {
				connect(userId, token).catch((error) => {
					console.error('Failed to establish WebSocket connection:', error);
					scheduleReconnect(userId);
				});
			};

			const connect = async (userId: string, token: string | null) => {
				const { ticket } = await $fetch<{ ticket: string }>(
					`${config.public.cloudBaseUrl}/ws/users/${userId}/ticket`,
					{
						headers: {
							Authorization: `Bearer ${token}`
						}
					}
				);

				ws = new WebSocket(
					`${websocketRoot}/ws/users/${userId}/notifications?ticket=${encodeURIComponent(ticket)}`
				);

				ws.onopen = () => {
					console.log(`WebSocket connection established to users:${userId}`);
					reconnectAttempts = 0;
					clearReconnectTimer();
					// catch up on notifications that arrived while we were disconnected
					notificationStore.fetchNotifications(true).catch((err) => {
						console.warn('Post-reconnect notification fetch failed:', err);
					});
				};

				ws.onmessage = (event: MessageEvent) => {
					const message = JSON.parse(event.data) satisfies { type: string; data: any };
					if (!message.type) {
						console.warn('Received WebSocket message without type:', message);
						return;
					}

					switch (message.type) {
						case 'notification': {
							const notification = message.data as UserNotification;

							notificationStore.addLiveNotification(notification);

							// fan badge-unlock notifications into the floating ribbon queue.
							// the listener regex-filters by title so generic events are no-ops
							try {
								const { onIncomingNotification } = useBadgeUnlockListener();
								onIncomingNotification(notification);
							} catch (err) {
								console.warn('badge-unlock listener failed:', err);
							}

							const actions: ButtonProps[] = [
								{
									label: 'Show Notification',
									trailingIcon: 'mdi:open-in-new',
									color: 'neutral',
									onClick: () => {
										router.push(`/profile/notifications/${notification.id}`);
									}
								}
							];

							if (notification.link) {
								actions.push({
									label: 'Go to Link',
									trailingIcon: 'mdi:arrow-right-circle',
									color: 'primary',
									onClick: () => {
										navigateTo(notification.link!, {
											external: notification.link?.startsWith('http')
										});
									}
								});
							}

							toast.add({
								title: notification.title,
								description: notification.message,
								icon: 'mdi:bell-ring',
								color: notification.type,
								actions
							});
							break;
						}
						case 'quest_progress': {
							const userId = user.value?.id;
							if (!userId) break;
							const payload =
								(message.data as {
									questId?: string;
									completed?: boolean;
									questReward?: number;
								}) || {};

							// resolve the quest title before the caches are cleared
							const activeQuest = userStore.quest.get(userId);
							const questTitle = payload.questId
								? ((activeQuest?.questId === payload.questId
										? activeQuest?.quest?.title
										: undefined) ??
									userStore.questHistory.get(userId)?.get(payload.questId)?.quest?.title ??
									userStore.questsCache.get(payload.questId)?.title)
								: undefined;

							// drop stale caches first so a refetch is forced even though the
							// fetcher early-returns on `cache.has()`. then re-pull.
							userStore.quest.delete(userId);
							userStore.questHistory.delete(userId);
							void userStore.fetchUserQuest(userId, true);
							void userStore.fetchQuestHistory(userId, { force: true });
							if (payload.completed) {
								const { triggerCelebration } = useQuestCelebration();
								triggerCelebration({
									questId: payload.questId,
									questTitle,
									points: payload.questReward ?? 0
								});
							}
							break;
						}
						default: {
							console.warn('Received unknown WebSocket message type:', message.type);
							break;
						}
					}
				};

				ws.onclose = (event: CloseEvent) => {
					console.log('WebSocket connection closed', event.code, event.reason);
					ws = null;
					// 1000 = normal close (we initiated). anything else is unexpected -> retry.
					if (!teardown && event.code !== 1000 && user.value?.id === userId) {
						scheduleReconnect(userId);
					}
				};

				ws.onerror = (error: Event) => {
					console.error('WebSocket error:', error);
				};
			};

			const disconnect = () => {
				clearReconnectTimer();
				reconnectAttempts = 0;
				if (ws) {
					ws.close(1000, 'client-initiated');
					ws = null;
				}
				connectedUserId = null;
			};

			const stopWatch = watch(
				user,
				(currentUser) => {
					if (!currentUser) {
						disconnect();
						return;
					}

					if (connectedUserId && connectedUserId !== currentUser.id) {
						// different user logged in - close the old connection first
						disconnect();
					}

					if (!ws && !reconnectTimer) {
						connectedUserId = currentUser.id;
						reconnectAttempts = 0;
						attemptConnect(currentUser.id, authStore.sessionToken);
					}
				},
				{ immediate: true }
			);

			// when the tab regains focus or comes back online, force a reconnect attempt
			// even if we'd exhausted the backoff schedule (user is paying attention now)
			const refocus = () => {
				if (teardown || !user.value) return;
				if (ws && ws.readyState === WebSocket.OPEN) return;
				reconnectAttempts = 0;
				clearReconnectTimer();
				attemptConnect(user.value.id, authStore.sessionToken);
			};
			window.addEventListener('focus', refocus);
			window.addEventListener('online', refocus);
			const visibilityHandler = () => {
				if (document.visibilityState === 'visible') refocus();
			};
			document.addEventListener('visibilitychange', visibilityHandler);

			// only tear down on actual tab/window close, not on SPA navigations
			window.addEventListener('beforeunload', () => {
				teardown = true;
				stopWatch();
				disconnect();
				window.removeEventListener('focus', refocus);
				window.removeEventListener('online', refocus);
				document.removeEventListener('visibilitychange', visibilityHandler);
			});
		};
		scheduleIdle(setup);
	});

	return {
		provide: {
			ws: computed(() => ws)
		}
	};
});
