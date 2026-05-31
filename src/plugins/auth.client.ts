export default defineNuxtPlugin((nuxtApp) => {
	const { fetchUser } = useAuth();
	const authStore = useAuthStore();
	const userStore = useUserStore();

	nuxtApp.hook('app:mounted', async () => {
		try {
			await fetchUser();
		} catch (error) {
			console.error('Failed to initialize user authentication:', error);
		}
	});

	// any time the auth user appears (login, session refresh), wipe stale null entries
	watch(
		() => authStore.currentUser?.id,
		(id) => {
			if (id) userStore.invalidateSelf();
		},
		{ immediate: true }
	);
});
