import {
	OAUTH_PROVIDERS,
	type OAuthContext,
	type OAuthProvider,
	type OAuthSource
} from '../types/user';

export interface ParsedOAuthState {
	provider: OAuthProvider | null;
	source: OAuthSource;
	context: OAuthContext | null;
	mobileSessionToken: string | null;
}

// state is `<provider>:<source>:<context>[:<mobileSessionToken>]` (built by authLink)
export function parseState(state: string): ParsedOAuthState {
	const [providerPart, sourcePart, contextPart, ...rest] = (state || '').split(':');
	const provider = OAUTH_PROVIDERS.includes(providerPart as OAuthProvider)
		? (providerPart as OAuthProvider)
		: null;
	const source: OAuthSource = sourcePart === 'mobile' ? 'mobile' : 'web';
	const context =
		contextPart === 'login' ||
		contextPart === 'signup' ||
		contextPart === 'link' ||
		contextPart === 'reauth'
			? contextPart
			: null;
	// mobile clients (e.g. sky) can't rely on cookies inside SFSafariViewController,
	// so they may append their session token as a 4th colon-separated segment
	const tokenPart = rest.join(':').trim();
	const mobileSessionToken = source === 'mobile' && tokenPart ? tokenPart : null;
	return { provider, source, context, mobileSessionToken };
}

export type OAuthSuccessParam = 'oauth_signup' | 'oauth_linked' | 'oauth_login';

export interface WebOAuthClassification {
	wantsLink: boolean;
	isLinking: boolean;
	successParam: OAuthSuccessParam;
}

// decide login-vs-link from the user's INTENT (state context), never from a stale
// session cookie; a lingering cookie must not turn a real login into an account link
export function classifyWebOAuth(input: {
	stateContext: OAuthContext | null;
	hasSessionToken: boolean;
	isNewUser: boolean;
}): WebOAuthClassification {
	const wantsLink = input.stateContext === 'link';
	// isLinking depends only on intent + a live token; isNewUser never affects it
	const isLinking = wantsLink && input.hasSessionToken;
	const successParam: OAuthSuccessParam = input.isNewUser
		? 'oauth_signup'
		: wantsLink
			? 'oauth_linked'
			: 'oauth_login';
	return { wantsLink, isLinking, successParam };
}
