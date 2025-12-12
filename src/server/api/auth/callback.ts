import { exchangeCodeForToken } from '../../utils';

export default defineEventHandler(async (event) => {
	const query = getQuery(event);
	const { code, state } = query;

	const sessionToken = getCookie(event, 'session_token');
	const loggedIn = !!sessionToken;
	const redirectPage = loggedIn ? 'profile' : 'login';

	if (!state || Array.isArray(state) || typeof state !== 'string') {
		return sendRedirect(event, `/${redirectPage}?error=no_provider`);
	}

	if (!code || Array.isArray(code) || typeof code !== 'string') {
		return sendRedirect(event, `/${redirectPage}?error=no_code`);
	}

	try {
		const idToken = await exchangeCodeForToken(state, code);
		const response = await $fetch<{ session_token: string; user: any }>(
			`https://api.earth-app.com/v2/users/oauth/${state}`,
			{
				method: 'POST',
				body: { id_token: idToken },
				onResponse({ response: res }) {
					event.context.oauthStatus = res.status;
				}
			}
		);

		setCookie(event, 'session_token', response.session_token, {
			httpOnly: true,
			secure: true,
			maxAge: 60 * 60 * 24 * 14 // 14 days
		});

		const isNewUser = event.context.oauthStatus === 201;
		const successParam = isNewUser ? 'oauth_signup' : 'oauth_linked';

		return sendRedirect(event, `/profile?success=${successParam}`);
	} catch (error) {
		console.error('OAuth error:', error);
		return sendRedirect(event, `/${redirectPage}?error=auth_failed`);
	}
});
