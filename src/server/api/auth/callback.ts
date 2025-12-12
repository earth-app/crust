import { exchangeCodeForToken } from '../../utils';

export default defineEventHandler(async (event) => {
	const query = getQuery(event);
	const { code, state } = query;

	const sessionToken = getCookie(event, 'session_token');
	const isLoggedIn = !!sessionToken;
	const page = isLoggedIn ? 'profile' : 'login';

	if (!state || Array.isArray(state) || typeof state !== 'string') {
		setHeader(event, 'X-Error-Type', 'missing_provider');
		return sendRedirect(event, `/${page}?error=no_provider`);
	}

	if (!code || Array.isArray(code) || typeof code !== 'string') {
		setHeader(event, 'X-Error-Type', 'missing_code');
		return sendRedirect(event, `/${page}?error=no_code`);
	}

	try {
		const idToken = await exchangeCodeForToken(state, code);
		const response = await $fetch<{ session_token: string; user: any }>(
			`https://api.earth-app.com/v2/users/oauth/${state}?is_linking=${isLoggedIn}`,
			{
				method: 'POST',
				body: { id_token: idToken, session_token: sessionToken },
				onResponse({ response: res }) {
					event.context.oauthStatus = res.status;
				},
				onResponseError({ response: res }) {
					event.context.oauthStatus = res.status;
				}
			}
		);

		const isNewUser = event.context.oauthStatus === 201;

		let successParam: string | null = null;
		if (isNewUser) successParam = 'oauth_signup';
		else {
			successParam = isLoggedIn ? 'oauth_linked' : null;
		}

		if (isNewUser || !isLoggedIn)
			setCookie(event, 'session_token', response.session_token, {
				httpOnly: true,
				secure: true,
				maxAge: 60 * 60 * 24 * 14 // 14 days
			});

		if (successParam)
			return sendRedirect(event, `/profile?success=${successParam}&force_refresh=true`);
		else return sendRedirect(event, '/profile?force_refresh=true');
	} catch (error: any) {
		console.error('OAuth error:', error);

		setHeader(event, 'X-Error-Detail', error instanceof Error ? error.message : 'Unknown error');
		setHeader(event, 'X-Error-Response', JSON.stringify(event.context.oauthStatus || {}));
		setHeader(
			event,
			'X-Error-Extra',
			JSON.stringify({
				statusMessage: error?.statusMessage,
				statusText: error?.statusText,
				statusCode: error?.statusCode,
				...error
			})
		);
		if (error.data) setHeader(event, 'X-Error-Data', JSON.stringify(error.data));

		setHeader(event, 'X-Error-Type', 'oauth_failure');
		return sendRedirect(event, `/${page}?error=auth_failed`);
	}
});
