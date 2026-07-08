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

	// sky omits cloud config entirely, so we detect it by its absence
	const isSky = !config.public.cloudBaseUrl;
	const crustBase =
		(config.public.crustBaseUrl as string | undefined) || 'https://app.earth-app.com';

	let ws: WebSocket | null = null;

	// "https://" -> "wss://" (crust only; sky receives the resolved url from the ticket route)
	const websocketRoot = config.public.cloudBaseUrl
		? config.public.cloudBaseUrl.replace(/http/g, 'ws')
		: '';

	// defer to idle to increase hydration speed
	const scheduleIdle = (cb: () => void) => {
		if (typeof window === 'undefined') return;
		const ric = (window as any).requestIdleCallback as
			((cb: IdleRequestCallback, opts?: IdleRequestOptions) => number) | undefined;
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
			let connecting = false;

			let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
			let lastActivityAt = 0;

			const MAX_RECONNECT_ATTEMPTS = 8;
			const BASE_DELAY_MS = 1_000;
			const MAX_DELAY_MS = 30_000;
			const PING_INTERVAL_MS = 25_000;
			// no inbound traffic (notification or pong) for this long => treat the socket as dead
			const LIVENESS_TIMEOUT_MS = 60_000;

			const clearReconnectTimer = () => {
				if (reconnectTimer) {
					clearTimeout(reconnectTimer);
					reconnectTimer = null;
				}
			};

			const clearHeartbeat = () => {
				if (heartbeatTimer) {
					clearInterval(heartbeatTimer);
					heartbeatTimer = null;
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
				if (ws || connecting) return;

				connecting = true;
				connect(userId, token)
					.catch((error) => {
						console.error('Failed to establish WebSocket connection:', error);
						scheduleReconnect(userId);
					})
					.finally(() => {
						connecting = false;
					});
			};

			const connect = async (userId: string, token: string | null) => {
				// falsy token would post "Bearer null" to the ticket route (-> 401);
				// wait for the token-watch below to reconnect once it hydrates
				if (!token) return;

				let wsUrl: string;
				if (isSky) {
					// sky carries no cloud config — fetch the ticket + resolved ws url through crust
					const res = await $fetch<{ ticket: string; url: string }>(
						`${crustBase}/api/user/wsTicket?id=${encodeURIComponent(userId)}`,
						{ headers: { Authorization: `Bearer ${token}` } }
					);
					wsUrl = `${res.url}?ticket=${encodeURIComponent(res.ticket)}`;
				} else {
					const { ticket } = await $fetch<{ ticket: string }>(
						`${config.public.cloudBaseUrl}/ws/users/${userId}/ticket`,
						{ headers: { Authorization: `Bearer ${token}` } }
					);
					wsUrl = `${websocketRoot}/ws/users/${userId}/notifications?ticket=${encodeURIComponent(ticket)}`;
				}

				// the user may have logged out / switched, or the tab torn down, while we
				// awaited the ticket — bail rather than open a now-orphaned socket.
				if (teardown || !user.value || user.value.id !== userId) return;

				ws = new WebSocket(wsUrl);

				ws.onopen = () => {
					console.log(`WebSocket connection established to users:${userId}`);
					reconnectAttempts = 0;
					clearReconnectTimer();

					lastActivityAt = Date.now();
					clearHeartbeat();
					heartbeatTimer = setInterval(() => {
						if (!ws) return;
						if (Date.now() - lastActivityAt > LIVENESS_TIMEOUT_MS) {
							console.warn('WebSocket heartbeat timed out; forcing reconnect.');
							clearHeartbeat();
							try {
								// non-1000 close routes through onclose -> scheduleReconnect
								ws.close(4000, 'heartbeat-timeout');
							} catch {
								// wedged socket may never fire onclose — reconnect defensively
								ws = null;
								if (!teardown && user.value?.id === userId) scheduleReconnect(userId);
							}
							return;
						}
						try {
							ws.send(JSON.stringify({ type: 'ping' }));
						} catch (err) {
							console.warn('WebSocket ping failed:', err);
						}
					}, PING_INTERVAL_MS);

					// catch up on notifications that arrived while we were disconnected
					notificationStore.fetchNotifications(true).catch((err) => {
						console.warn('Post-reconnect notification fetch failed:', err);
					});
				};

				ws.onmessage = (event: MessageEvent) => {
					// any inbound frame (notification or pong) proves the socket is alive
					lastActivityAt = Date.now();

					const message = JSON.parse(event.data) satisfies { type: string; data: any };
					if (!message.type) {
						console.warn('Received WebSocket message without type:', message);
						return;
					}

					switch (message.type) {
						case 'pong':
							// heartbeat acknowledgement — liveness already refreshed above
							break;
						case 'notification': {
							const notification = message.data as UserNotification;

							// dedupe by id — a redelivery (or a transient duplicate socket) must not
							// surface the ribbon/toast twice. the store ignores known ids and reports
							// whether this one was new.
							const isNew = notificationStore.addLiveNotification(notification);
							if (!isNew) break;

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

							// sky owns its own (capacitor) toasting; only crust raises the Nuxt UI toast
							if (!isSky) {
								toast.add({
									title: notification.title,
									description: notification.message,
									icon: 'mdi:bell-ring',
									color: notification.type,
									actions
								});
							}

							// nudge any open quest-challenge banner to refetch — a challenge
							// accept/decline/advance from the other side arrives as a notification.
							window.dispatchEvent(new CustomEvent('earth-app:quest-progress'));
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

							// resolve the quest title before we mutate the caches
							const activeQuest = userStore.quest.get(userId);
							const questTitle = payload.questId
								? ((activeQuest?.questId === payload.questId
										? activeQuest?.quest?.title
										: undefined) ??
									userStore.questHistory.get(userId)?.get(payload.questId)?.quest?.title ??
									userStore.questsCache.get(payload.questId)?.title)
								: undefined;

							if (payload.completed) {
								userStore.completeActiveQuest(userId, payload.questId);

								const { triggerCelebration } = useQuestCelebration();
								triggerCelebration({
									questId: payload.questId,
									questTitle,
									points: payload.questReward ?? 0
								});
							} else {
								void userStore.fetchUserQuest(userId, true);
							}

							void userStore.fetchQuestHistory(userId, { force: true });

							window.dispatchEvent(new CustomEvent('earth-app:quest-progress'));
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
					clearHeartbeat();
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
				clearHeartbeat();
				reconnectAttempts = 0;
				// any connect() still awaiting its ticket will see the cleared user/teardown
				// state post-await and bail, so it's safe to release the guard here.
				connecting = false;
				if (ws) {
					ws.close(1000, 'client-initiated');
					ws = null;
				}
				connectedUserId = null;
			};

			const stopWatch = watch(
				[user, () => authStore.sessionToken],
				([currentUser, token]) => {
					if (!currentUser) {
						disconnect();
						return;
					}

					if (connectedUserId && connectedUserId !== currentUser.id) {
						// different user logged in - close the old connection first
						disconnect();
					}

					// sky cold-launch restores `user` before the token hydrates; connecting
					// now ships "Bearer null" — wait for a real token (this re-fires on it)
					if (typeof token !== 'string' || token.length === 0) return;

					if (!ws && !reconnectTimer) {
						connectedUserId = currentUser.id;
						reconnectAttempts = 0;
						attemptConnect(currentUser.id, token);
					}
				},
				{ immediate: true }
			);

			const refocus = () => {
				if (teardown || !user.value) return;
				if (ws || connecting) return;

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
