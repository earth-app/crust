export default defineEventHandler(async (event) => {
	const query = getQuery(event);
	const { provider } = query;

	if (!provider || typeof provider !== 'string') {
		return sendRedirect(event, '/profile?error=invalid_unlink');
	}

	const sessionToken = getCookie(event, 'session_token');
	if (!sessionToken) {
		return sendRedirect(event, '/login?error=not_authenticated');
	}

	try {
		await $fetch(`https://api.earth-app.com/v2/users/oauth/${provider}`, {
			method: 'DELETE',
			headers: {
				Authorization: `Bearer ${sessionToken}`
			}
		});

		// Redirect to success page
		return sendRedirect(event, '/profile?success=oauth_unlinked&force_refresh=true');
	} catch (error: any) {
		if (error.statusCode === 400) {
			return sendRedirect(event, '/profile?error=cannot_unlink_only_method');
		}

		console.error('OAuth unlink error:', error);
		return sendRedirect(event, '/profile?error=oauth_unlink_failed');
	}
});
