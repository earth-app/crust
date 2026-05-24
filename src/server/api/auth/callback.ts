import { exchangeCodeForToken } from '~/server/utils';

function parseState(state: string): {
	provider: OAuthProvider | null;
	source: OAuthSource;
	context: OAuthContext | null;
	mobileSessionToken: string | null;
} {
	const [providerPart, sourcePart, contextPart, ...rest] = state.split(':');
	const provider = OAUTH_PROVIDERS.includes(providerPart as OAuthProvider)
		? (providerPart as OAuthProvider)
		: null;
	const source: OAuthSource = sourcePart === 'mobile' ? 'mobile' : 'web';
	const context =
		contextPart === 'login' || contextPart === 'signup' || contextPart === 'link'
			? contextPart
			: null;
	// Mobile clients (e.g. sky) can't rely on cookies inside SFSafariViewController,
	// so they may append their session token as a 4th colon-separated segment.
	const tokenPart = rest.join(':').trim();
	const mobileSessionToken = source === 'mobile' && tokenPart ? tokenPart : null;
	return { provider, source, context, mobileSessionToken };
}

function safeHeader(event: any, name: string, value: unknown) {
	let str: string;
	if (value === null || value === undefined) {
		str = '';
	} else if (typeof value === 'string') {
		str = value;
	} else if (value instanceof Error) {
		str = value.message || value.name || 'Error';
	} else {
		try {
			str = JSON.stringify(value);
		} catch {
			str = String(value);
		}
	}

	// HTTP header values can't contain CR/LF and shouldn't be unbounded
	str = str.replace(/[\r\n]+/g, ' ').slice(0, 1024);
	try {
		setHeader(event, name, str);
	} catch {
		// never let a header write blow up the handler
	}
}

function errorSummary(error: any): string {
	const safe: Record<string, unknown> = {
		name: error?.name,
		message: error instanceof Error ? error.message : undefined,
		statusCode: error?.statusCode ?? error?.status,
		statusMessage: error?.statusMessage ?? error?.statusText
	};
	try {
		return JSON.stringify(safe);
	} catch {
		return '{}';
	}
}

export default defineEventHandler(async (event) => {
	const cookieSessionToken = getCookie(event, 'session_token');
	let sessionToken = cookieSessionToken;
	let isLoggedIn = !!sessionToken;
	const config = useRuntimeConfig();

	let source: OAuthSource = 'web';
	let provider: OAuthProvider | null = null;
	let stateContext: OAuthContext | null = null;

	const mobileRedirect = (params: Record<string, string>) => {
		const qp = new URLSearchParams(params).toString();
		return sendRedirect(event, `${config.public.baseUrl}/oauth/complete?${qp}`);
	};
	const fallbackContext = (): OAuthContext => stateContext || (isLoggedIn ? 'link' : 'login');
	const page = () => (isLoggedIn ? 'profile' : 'login');

	try {
		let query = getQuery(event);
		let appleUserFromBody: {
			name?: { firstName?: string; lastName?: string };
			email?: string;
		} | null = null;

		try {
			if (event.method === 'POST') {
				const body = await readBody(event);
				if (body && typeof body === 'object') {
					query = { ...query, ...body };

					const rawUser = (body as any).user;
					if (rawUser) {
						try {
							appleUserFromBody = typeof rawUser === 'string' ? JSON.parse(rawUser) : rawUser;
						} catch {
							// Apple sends `user` JSON-encoded only on first authorization; ignore malformed payloads.
						}
					}
				}
			}
		} catch (parseError) {
			safeHeader(event, 'X-Error-Type', 'body_parsing_error');
			safeHeader(event, 'X-Error-Detail', 'Failed to parse request body');
			safeHeader(event, 'X-Error-Extra', parseError);
			console.error('Error occurred while processing OAuth callback body:', parseError);
			return sendRedirect(event, `/${page()}?error=body_parsing_error`);
		}

		const { code, state, error, error_description } = query;
		const stateStr = typeof state === 'string' ? state : '';
		const parsed = parseState(stateStr);
		provider = parsed.provider;
		source = parsed.source;
		stateContext = parsed.context;

		// Mobile clients can't share cookies with the SFSafariViewController OAuth flow,
		// so accept the session token from the state's 4th segment or a `mobile_session_token`
		// query/body param. Only honored when source === 'mobile' to keep the cookie path
		// authoritative for web.
		if (source === 'mobile') {
			const queryMobileToken =
				typeof query.mobile_session_token === 'string' ? query.mobile_session_token : '';
			const mobileToken = parsed.mobileSessionToken || queryMobileToken;
			if (mobileToken && !sessionToken) {
				sessionToken = mobileToken;
				isLoggedIn = true;
			}
		}

		if (error) {
			safeHeader(event, 'X-Error-Type', 'oauth_provider_error');
			safeHeader(
				event,
				'X-Error-Detail',
				(error_description as string) || 'No description provided'
			);
			safeHeader(event, 'X-Error-Extra', `Provider error: ${error}`);
			console.error(`OAuth provider error: ${error} - ${error_description}`);
			if (source === 'mobile' && provider) {
				return mobileRedirect({
					error: 'provider_error',
					provider,
					context: fallbackContext()
				});
			}
			return sendRedirect(event, `/${page()}?error=provider_error`);
		}

		if (!state || Array.isArray(state) || typeof state !== 'string') {
			safeHeader(event, 'X-Error-Type', 'missing_provider');
			return sendRedirect(event, `/${page()}?error=no_provider`);
		}

		if (!code || Array.isArray(code) || typeof code !== 'string') {
			safeHeader(event, 'X-Error-Type', 'missing_code');
			if (source === 'mobile' && provider) {
				return mobileRedirect({
					error: 'no_code',
					provider,
					context: fallbackContext()
				});
			}
			return sendRedirect(event, `/${page()}?error=no_code`);
		}

		if (!provider) {
			safeHeader(event, 'X-Error-Type', 'invalid_provider');
			safeHeader(event, 'X-Error-Extra', `Provided: ${state}`);
			return sendRedirect(event, `/${page()}?error=invalid_provider`);
		}

		const token = await exchangeCodeForToken(provider, code);
		// mantle2 prefers `id_token` for Apple/Microsoft (it's an OIDC id_token,
		// not an OAuth2 access token), and falls back to `access_token`.
		const tokenField =
			provider === 'apple' || provider === 'microsoft' ? 'id_token' : 'access_token';
		const response = await $fetch<{ session_token: string; user: any }>(
			`https://api.earth-app.com/v2/users/oauth/${provider}?is_linking=${isLoggedIn}`,
			{
				method: 'POST',
				body: {
					[tokenField]: token,
					session_token: sessionToken,
					...(appleUserFromBody?.email ? { email: appleUserFromBody.email } : {}),
					...(appleUserFromBody?.name?.firstName
						? { given_name: appleUserFromBody.name.firstName }
						: {}),
					...(appleUserFromBody?.name?.lastName
						? { family_name: appleUserFromBody.name.lastName }
						: {})
				},
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
			return sendRedirect(
				event,
				`/profile?success=${successParam}&provider=${provider}&force_refresh=true`
			);
		else return sendRedirect(event, `/profile?provider=${provider}&force_refresh=true`);
	} catch (error: any) {
		console.error('OAuth error:', error);

		safeHeader(event, 'X-Error-Type', 'oauth_failure');
		safeHeader(event, 'X-Error-Detail', error instanceof Error ? error.message : 'Unknown error');
		safeHeader(event, 'X-Error-Response', String(event.context?.oauthStatus ?? ''));
		safeHeader(event, 'X-Error-Extra', errorSummary(error));
		if (error?.data) safeHeader(event, 'X-Error-Data', error.data);

		if (source === 'mobile') {
			return mobileRedirect({
				error: 'auth_failed',
				provider: provider || '<no provider>',
				context: fallbackContext()
			});
		}

		return sendRedirect(event, `/${page()}?error=auth_failed`);
	}
});
