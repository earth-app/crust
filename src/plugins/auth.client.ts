export default defineNuxtPlugin(async (_) => {
	const { user, fetchUser } = useAuth();

	if (user.value === undefined) {
		try {
			await fetchUser(true);
		} catch (error) {
			console.error('Failed to initialize user authentication:', error);
		}
	}
});
