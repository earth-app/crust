import { exchangeCodeForToken } from '~/server/utils';

function parseState(state: string): {
	provider: OAuthProvider | null;
	source: OAuthSource;
	context: OAuthContext | null;
} {
	const [providerPart, sourcePart, contextPart] = state.split(':');
	const provider = OAUTH_PROVIDERS.includes(providerPart as OAuthProvider)
		? (providerPart as OAuthProvider)
		: null;
	const source: OAuthSource = sourcePart === 'mobile' ? 'mobile' : 'web';
	const context =
		contextPart === 'login' || contextPart === 'signup' || contextPart === 'link'
			? contextPart
			: null;
	return { provider, source, context };
}

export default defineEventHandler(async (event) => {
	let query = getQuery(event);
	if (event.method === 'POST') {
		const body = await readBody(event);
		query = { ...query, ...body };
	}

	const { code, state, error, error_description } = query;
	const config = useRuntimeConfig();

	const sessionToken = getCookie(event, 'session_token');
	const isLoggedIn = !!sessionToken;
	const page = isLoggedIn ? 'profile' : 'login';

	const stateStr = typeof state === 'string' ? state : '';
	const { provider, source, context: stateContext } = parseState(stateStr);

	const mobileRedirect = (params: Record<string, string>) => {
		const qp = new URLSearchParams(params).toString();
		return sendRedirect(event, `${config.public.baseUrl}/oauth/complete?${qp}`);
	};
	const fallbackContext = (): OAuthContext => stateContext || (isLoggedIn ? 'link' : 'login');

	if (error) {
		setHeader(event, 'X-Error-Type', 'oauth_provider_error');
		setHeader(event, 'X-Error-Detail', (error_description as string) || 'No description provided');
		setHeader(event, 'X-Error-Extra', `Provider error: ${error}`);
		console.error(`OAuth provider error: ${error} - ${error_description}`);
		if (source === 'mobile' && provider) {
			return mobileRedirect({
				error: 'provider_error',
				provider,
				context: fallbackContext()
			});
		}
		return sendRedirect(event, `/${page}?error=provider_error`);
	}

	if (!state || Array.isArray(state) || typeof state !== 'string') {
		setHeader(event, 'X-Error-Type', 'missing_provider');
		return sendRedirect(event, `/${page}?error=no_provider`);
	}

	if (!code || Array.isArray(code) || typeof code !== 'string') {
		setHeader(event, 'X-Error-Type', 'missing_code');
		if (source === 'mobile' && provider) {
			return mobileRedirect({
				error: 'no_code',
				provider,
				context: fallbackContext()
			});
		}
		return sendRedirect(event, `/${page}?error=no_code`);
	}

	if (!provider) {
		setHeader(event, 'X-Error-Type', 'invalid_provider');
		setHeader(event, 'X-Error-Extra', `Provided: ${state}`);
		return sendRedirect(event, `/${page}?error=invalid_provider`);
	}

	try {
		const token = await exchangeCodeForToken(provider, code);
		const response = await $fetch<{ session_token: string; user: any }>(
			`https://api.earth-app.com/v2/users/oauth/${provider}?is_linking=${isLoggedIn}`,
			{
				method: 'POST',
				body: { access_token: token, session_token: sessionToken },
				onResponse({ response: res }) {
					event.context.oauthStatus = res.status;
				},
				onResponseError({ response: res }) {
					event.context.oauthStatus = res.status;
				}
			}
		);

		const isNewUser = event.context.oauthStatus === 201;

		if (isNewUser || !isLoggedIn)
			setCookie(event, 'session_token', response.session_token, {
				sameSite: 'none',
				secure: true,
				maxAge: 60 * 60 * 24 * 14 // 14 days
			});

		if (source === 'mobile') {
			const context: OAuthContext =
				stateContext || (isNewUser ? 'signup' : isLoggedIn ? 'link' : 'login');
			return mobileRedirect({
				session_token: response.session_token,
				context,
				provider
			});
		}

		let successParam: string | null = null;
		if (isNewUser) successParam = 'oauth_signup';
		else {
			successParam = isLoggedIn ? 'oauth_linked' : null;
		}

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
		if (source === 'mobile') {
			return mobileRedirect({
				error: 'auth_failed',
				provider,
				context: fallbackContext()
			});
		}
		return sendRedirect(event, `/${page}?error=auth_failed`);
	}
});
