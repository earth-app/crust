export default defineNuxtPlugin((nuxtApp) => {
	const { fetchUser } = useAuth();

	nuxtApp.hook('app:mounted', async () => {
		try {
			await fetchUser();
		} catch (error) {
			console.error('Failed to initialize user authentication:', error);
		}
	});
});
