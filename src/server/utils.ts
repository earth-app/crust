import { H3Event } from 'h3';
import { type User } from '~/shared/types/user';

export async function ensureAdministrator(event: H3Event) {
	const config = useRuntimeConfig();
	const token = getRequestHeader(event, 'Authorization')?.replace('Bearer ', '');
	if (!token) {
		throw createError({
			statusCode: 401,
			statusMessage: 'Unauthorized'
		});
	}

	if (token === config.adminApiKey) return; // If the token matches the admin API key, skip user check

	const user = await $fetch<User>(`${config.public.apiBaseUrl}/v1/users/current`, {
		headers: {
			Authorization: `Bearer ${token}`
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
}
