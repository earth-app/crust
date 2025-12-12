import { H3Event } from 'h3';
import { type User } from '../shared/types/user';

export async function ensureAdministrator(event: H3Event) {
	const config = useRuntimeConfig();
	const token = getRequestHeader(event, 'Authorization')?.replace('Bearer ', '');
	if (!token) {
		throw createError({
			statusCode: 401,
			statusMessage: 'Unauthorized'
		});
	}

	try {
		const user = await $fetch<User>(`${config.public.apiBaseUrl}/v2/users/current`, {
			headers: {
				Authorization: `Bearer ${token}`,
				'User-Agent': 'The Earth App/Web (https://earth-app.com)'
			}
		});

		if (!user.id) {
			throw createError({
				statusCode: 401,
				statusMessage: 'Unauthorized'
			});
		}

		if (!user || user.account.account_type !== 'ADMINISTRATOR') {
			throw createError({
				statusCode: 403,
				statusMessage: 'Forbidden: You must be an administrator to access this resource'
			});
		}

		return user;
	} catch (error) {
		throw createError({
			statusCode: 401,
			statusMessage: 'Unauthorized'
		});
	}
}

export async function ensureLoggedIn(event: H3Event) {
	const config = useRuntimeConfig();
	const token = getRequestHeader(event, 'Authorization')?.replace('Bearer ', '');
	if (!token) {
		throw createError({
			statusCode: 401,
			statusMessage: 'Unauthorized'
		});
	}

	try {
		const user = await $fetch<User>(`${config.public.apiBaseUrl}/v2/users/current`, {
			headers: {
				Authorization: `Bearer ${token}`,
				'User-Agent': 'The Earth App/Web (https://earth-app.com)'
			}
		});

		return user;
	} catch (error) {
		throw createError({
			statusCode: 403,
			statusMessage: 'Forbidden: You must be logged in to access this resource'
		});
	}
}

export async function ensureValidActivity(activityId: string) {
	const config = useRuntimeConfig();

	try {
		const activity = await $fetch<{ id: string }>(
			`${config.public.apiBaseUrl}/v2/activities/${activityId}`,
			{
				headers: {
					'User-Agent': 'The Earth App/Web (https://earth-app.com)'
				}
			}
		);

		if (!activity || activity.id !== activityId) {
			throw createError({
				statusCode: 404,
				statusMessage: 'Activity not found'
			});
		}

		return activity;
	} catch (error) {
		throw createError({
			statusCode: 500,
			statusMessage: `Failed to fetch activity: ${error instanceof Error ? error.message : 'Unknown error'}`
		});
	}
}

// oauth
export async function exchangeCodeForToken(provider: string, code: string): Promise<string> {
	const config = useRuntimeConfig();

	switch (provider) {
		case 'microsoft':
			const ms = await $fetch<{ id_token: string }>(
				'https://login.microsoftonline.com/common/oauth2/v2.0/token',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
					body: new URLSearchParams({
						code,
						client_id: config.public.microsoftClientId,
						client_secret: config.microsoftClientSecret,
						redirect_uri: 'https://app.earth-app.com/auth/callback',
						grant_type: 'authorization_code',
						scope: 'openid email profile'
					})
				}
			);

			return ms.id_token;
		case 'discord':
			const discord = await $fetch<{ id_token: string }>('https://discord.com/api/oauth2/token', {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					code,
					client_id: config.public.discordClientId,
					client_secret: config.discordClientSecret,
					redirect_uri: 'https://app.earth-app.com/auth/callback',
					grant_type: 'authorization_code'
				})
			});

			return discord.id_token;
		case 'github':
			const github = await $fetch<{ access_token: string }>(
				'https://github.com/login/oauth/access_token',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
					body: JSON.stringify({
						code,
						client_id: config.public.githubClientId,
						client_secret: config.githubClientSecret,
						redirect_uri: 'https://app.earth-app.com/auth/callback'
					})
				}
			);

			return github.access_token;
		case 'facebook':
			const fb = await $fetch<{ access_token: string }>(
				'https://graph.facebook.com/v18.0/oauth/access_token',
				{
					method: 'GET',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						code,
						client_id: config.public.facebookClientId,
						client_secret: config.facebookClientSecret,
						redirect_uri: 'https://app.earth-app.com/auth/callback'
					})
				}
			);

			return fb.access_token;
		default:
			throw new Error(`Unknown provider: ${provider}`);
	}
}
