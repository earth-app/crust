import { useAuthStore } from 'stores/auth';
import type { UserNotification } from 'types/user';

export default defineNuxtPlugin((nuxtApp) => {
	const toast = useToast();
	const router = useRouter();
	const config = useRuntimeConfig();

	let ws: WebSocket | null = null;
	// "https://" -> "wss://"
	const websocketRoot = config.public.cloudBaseUrl.replace(/http/g, 'ws');

	// Initialize WebSocket when the app is mounted
	nuxtApp.hook('app:mounted', () => {
		const { user } = useAuth();
		const authStore = useAuthStore();

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

						toast.add({
							title: notification.title,
							description: notification.message,
							icon: 'mdi:bell-ring',
							color: notification.type,
							actions: notification.link
								? [
										{
											label: 'View',
											trailingIcon: 'mdi:arrow-right-circle',
											color: 'neutral',
											onClick: () => {
												router.push(notification.link!);
											}
										}
									]
								: undefined
						});
						break;
					}
					default: {
						console.warn('Received unknown WebSocket message type:', message.type);
						break;
					}
				}
			};

			ws.onclose = () => {
				console.log('WebSocket connection closed');
			};

			ws.onerror = (error: Event) => {
				console.error('WebSocket error:', error);
			};
		};

		let connectedUserId: string | null = null;

		const disconnect = () => {
			if (ws) {
				ws.close();
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
					// different user logged in — close the old connection first
					disconnect();
				}

				if (!ws) {
					connectedUserId = currentUser.id;
					connect(currentUser.id, authStore.sessionToken).catch((error) => {
						console.error('Failed to establish WebSocket connection:', error);
						connectedUserId = null;
					});
				}
			},
			{ immediate: true }
		);

		// only tear down on actual tab/window close, not on SPA navigations
		window.addEventListener('beforeunload', () => {
			stopWatch();
			disconnect();
		});
	});

	return {
		provide: {
			ws: computed(() => ws)
		}
	};
});
