import { decodeOAuthUserHandoff } from 'utils';
import { isValidUser } from '~/stores/user';

export default defineNuxtPlugin((nuxtApp) => {
	const { fetchUser } = useAuth();
	const authStore = useAuthStore();
	const userStore = useUserStore();

	// consume the short-lived oauth user handoff (set by the oauth callback) so currentUser is set
	// directly, mirroring useLogin — removes the dependency on a /v2/users/current round-trip
	const oauthUserCookie = useCookie<string | null>('oauth_user', { default: () => null });
	if (oauthUserCookie.value) {
		const decoded = decodeOAuthUserHandoff(oauthUserCookie.value);
		if (isValidUser(decoded)) authStore.currentUser = decoded;
		oauthUserCookie.value = null; // one-shot handoff
	}

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
