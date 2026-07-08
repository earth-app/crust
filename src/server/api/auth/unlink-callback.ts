export default defineEventHandler(async (event) => {
	try {
		const config = useRuntimeConfig();
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
			await $fetch(`${config.public.apiBaseUrl}/v2/users/oauth/${provider}`, {
				method: 'DELETE',
				headers: {
					Authorization: `Bearer ${sessionToken}`
				}
			});

			return sendRedirect(
				event,
				`/profile?success=oauth_unlinked&provider=${provider}&force_refresh=true`
			);
		} catch (error: any) {
			if (error?.statusCode === 400 || error?.status === 400) {
				return sendRedirect(event, '/profile?error=cannot_unlink_only_method');
			}

			console.error('OAuth unlink error:', error);
			try {
				setHeader(
					event,
					'X-Error-Detail',
					(error instanceof Error ? error.message : 'Unknown error').slice(0, 1024)
				);
			} catch {
				// swallow header failures so we always redirect
			}
			return sendRedirect(event, '/profile?error=oauth_unlink_failed');
		}
	} catch (error: any) {
		console.error('OAuth unlink handler crashed:', error);
		return sendRedirect(event, '/profile?error=oauth_unlink_failed');
	}
});
