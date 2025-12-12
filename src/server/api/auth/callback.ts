import { exchangeCodeForToken } from '../../utils';

export default defineEventHandler(async (event) => {
	const query = getQuery(event);
	const { code, state } = query;

	if (!state || Array.isArray(state) || typeof state !== 'string') {
		setHeader(event, 'X-Error-Type', 'missing_provider');
		return sendRedirect(event, `/login?error=no_provider`);
	}

	if (!code || Array.isArray(code) || typeof code !== 'string') {
		setHeader(event, 'X-Error-Type', 'missing_code');
		return sendRedirect(event, `/login?error=no_code`);
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
				},
				onResponseError({ response: res }) {
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

		setHeader(event, 'X-Error-Detail', error instanceof Error ? error.message : 'Unknown error');
		setHeader(event, 'X-Error-Response', JSON.stringify(event.context.oauthStatus || {}));
		setHeader(event, 'X-Error-Extra', JSON.stringify(error));
		setHeader(event, 'X-Error-Type', 'oauth_failure');
		return sendRedirect(event, `/login?error=auth_failed`);
	}
});
