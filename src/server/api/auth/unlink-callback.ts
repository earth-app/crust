import { exchangeCodeForToken } from '../../utils';

export default defineEventHandler(async (event) => {
	const query = getQuery(event);
	const code = query.code as string;
	const state = query.state as string;

	if (!code || !state || !state.startsWith('unlink_')) {
		return sendRedirect(event, '/settings?error=invalid_unlink');
	}

	const provider = state.replace('unlink_', '');

	try {
		const idToken = await exchangeCodeForToken(provider, code);

		const sessionToken = getCookie(event, 'session_token');
		if (!sessionToken) {
			return sendRedirect(event, '/login?error=not_authenticated');
		}

		await $fetch(`https://api.earth-app.com/v2/users/oauth/${provider}`, {
			method: 'DELETE',
			headers: {
				Authorization: `Bearer ${sessionToken}`
			},
			body: { id_token: idToken }
		});

		// Redirect to success page
		return sendRedirect(event, '/profile?success=oauth_unlinked');
	} catch (error: any) {
		if (error.statusCode === 400) {
			return sendRedirect(event, '/profile?error=cannot_unlink_only_method');
		}

		console.error('OAuth unlink error:', error);
		return sendRedirect(event, '/profile?error=oauth_unlink_failed');
	}
});
