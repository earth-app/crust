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

	try {
		const user = await $fetch<User>(`${config.public.apiBaseUrl}/v2/users/current`, {
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
				Authorization: `Bearer ${token}`
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
