export default defineNuxtPlugin(async (nuxtApp) => {
	// Initialize user authentication state on app load (client-side only)
	const { user, fetchUser } = useAuth();

	if (user.value === undefined) {
		try {
			await fetchUser(true);
		} catch (error) {
			console.error('Failed to initialize user authentication:', error);
		}
	}
});
