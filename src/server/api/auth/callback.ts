import { exchangeCodeForToken } from '~/server/utils';
import { classifyWebOAuth, parseState } from '~/shared/utils/oauth';

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

// short-lived oauth user handoff so the client sets currentUser directly (mirrors useLogin)
// instead of depending on a /v2/users/current round-trip; size-guarded to keep cookies/urls small
function encodeUserHandoff(user: unknown): string | null {
	try {
		if (!user || typeof user !== 'object') return null;
		const json = JSON.stringify(user);
		if (!json || json.length > 3000) return null;
		return Buffer.from(json, 'utf8').toString('base64');
	} catch {
		return null;
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

		// reauth path - verify token against linked sub without re-issuing session
		if (stateContext === 'reauth') {
			if (!sessionToken) {
				safeHeader(event, 'X-Error-Type', 'reauth_no_session');
				if (source === 'mobile' && provider) {
					return mobileRedirect({
						error: 'reauth_no_session',
						provider,
						context: 'reauth'
					});
				}
				return sendRedirect(event, `/profile?error=reauth_no_session`);
			}

			try {
				await $fetch(`${config.public.apiBaseUrl}/v2/users/current/reauth/oauth`, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${sessionToken}`
					},
					body: { provider, [tokenField]: token }
				});
			} catch (reauthErr: any) {
				safeHeader(event, 'X-Error-Type', 'reauth_failed');
				safeHeader(event, 'X-Error-Detail', reauthErr?.data?.message || 'Reauth failed');
				if (source === 'mobile') {
					return mobileRedirect({
						error: 'reauth_failed',
						provider,
						context: 'reauth'
					});
				}
				return sendRedirect(event, `/profile?error=reauth_failed&provider=${provider}`);
			}

			if (source === 'mobile') {
				return mobileRedirect({
					session_token: sessionToken,
					context: 'reauth',
					provider
				});
			}
			return sendRedirect(event, `/profile?success=reauth_completed&provider=${provider}`);
		}

		const referralCookie = getCookie(event, 'referral_code');
		const referralCode =
			referralCookie && /^[0-9A-HJKMNP-TV-Z]{6}$/.test(referralCookie) ? referralCookie : undefined;

		// login vs link is decided by INTENT (state context), not by a stale cookie;
		// isNewUser is irrelevant to isLinking so a placeholder is safe here
		const { wantsLink, isLinking } = classifyWebOAuth({
			stateContext,
			hasSessionToken: !!sessionToken,
			isNewUser: false
		});

		const response = await $fetch<{ session_token: string; user: any }>(
			`${config.public.apiBaseUrl}/v2/users/oauth/${provider}?is_linking=${isLinking}`,
			{
				method: 'POST',
				body: {
					[tokenField]: token,
					session_token: sessionToken,
					...(referralCode ? { referral_code: referralCode } : {}),
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
		const userHandoff = encodeUserHandoff(response.user);

		// a login/signup ALWAYS gets the fresh session_token + oauth_user handoff so the
		// client hydrates currentUser directly (kills the stuck-Loading /v2/users/current path);
		// only a genuine link keeps the existing session untouched
		if (isNewUser || !wantsLink) {
			setCookie(event, 'session_token', response.session_token, {
				sameSite: 'none',
				secure: true,
				maxAge: 60 * 60 * 24 * 14 // 14 days
			});

			// readable, short-lived handoff so the client hydrates currentUser without a follow-up fetch
			if (userHandoff)
				setCookie(event, 'oauth_user', userHandoff, {
					sameSite: 'none',
					secure: true,
					httpOnly: false,
					maxAge: 120
				});
		}

		if (source === 'mobile') {
			const context: OAuthContext =
				stateContext || (isNewUser ? 'signup' : isLoggedIn ? 'link' : 'login');
			return mobileRedirect({
				session_token: response.session_token,
				context,
				provider,
				// sky reads `user` from the deep link to skip the round-trip
				...(userHandoff ? { user: userHandoff } : {})
			});
		}

		// login now emits a real `oauth_login` success (never null) so the client can toast it;
		// `oauth_linked` is reserved for an actual link
		const { successParam } = classifyWebOAuth({
			stateContext,
			hasSessionToken: !!sessionToken,
			isNewUser
		});

		return sendRedirect(
			event,
			`/profile?success=${successParam}&provider=${provider}&force_refresh=true`
		);
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
