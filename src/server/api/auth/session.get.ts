export default defineEventHandler(async (event) => {
	const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
	const cookieToken = getCookie(event, 'session_token');

	let sessionToken = cookieToken?.trim() || null;
	if (sessionToken) {
		try {
			sessionToken = decodeURIComponent(sessionToken);
		} catch {
			// keep raw token when not URL encoded
		}

		if (sessionToken.length >= 2 && sessionToken.startsWith('"') && sessionToken.endsWith('"')) {
			sessionToken = sessionToken.slice(1, -1);
		}

		setCookie(event, 'session_token', sessionToken, {
			maxAge: SESSION_COOKIE_MAX_AGE,
			path: '/',
			httpOnly: false,
			secure: true,
			sameSite: 'none'
		});
	}

	return { session_token: sessionToken };
});
