import { useBackendStore } from 'stores/backend';
import { decodeOAuthUserHandoff } from 'utils';
import { isValidUser } from '~/stores/user';

export default defineNuxtPlugin((nuxtApp) => {
	const { fetchUser } = useAuth();
	const authStore = useAuthStore();
	const userStore = useUserStore();

	const oauthUserCookie = useCookie<string | null>('oauth_user', { default: () => null });
	if (oauthUserCookie.value) {
		const decoded = decodeOAuthUserHandoff(oauthUserCookie.value);
		if (isValidUser(decoded)) authStore.currentUser = decoded;
		oauthUserCookie.value = null; // one-shot handoff
	}

	nuxtApp.hook('app:mounted', async () => {
		const backendStore = useBackendStore();
		await backendStore.preflight();
		if (backendStore.isBlocked) return;

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
