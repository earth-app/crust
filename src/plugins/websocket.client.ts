import type { UserNotification } from '~/shared/types/user';

export default defineNuxtPlugin((_) => {
	const toast = useToast();
	const router = useRouter();
	const config = useRuntimeConfig();

	let ws: WebSocket | null = null;

	// Initialize WebSocket when user is available
	onMounted(() => {
		const { user } = useAuth();

		const stopWatch = watch(
			user,
			(currentUser) => {
				if (currentUser && !ws) {
					const userId = currentUser.id;
					ws = new WebSocket(`wss://${config.public.cloudBaseUrl}/ws/users:${userId}`);

					ws.onopen = () => {
						console.log(`WebSocket connection established to users:${userId}`);
					};

					ws.onmessage = (event) => {
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

					ws.onerror = (error) => {
						console.error('WebSocket error:', error);
					};
				}
			},
			{ immediate: true }
		);

		// Clean up on unmount
		onUnmounted(() => {
			stopWatch();
			if (ws) {
				ws.close();
				ws = null;
			}
		});
	});

	return {
		provide: {
			ws: computed(() => ws)
		}
	};
});
