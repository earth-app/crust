import { makeAPIRequest as makeAPIRequest, paginatedAPIRequest } from '~/shared/util';
import type { User } from '~/shared/types/user';
import { getSessionToken } from './useLogin';

export async function useCurrentUser() {
	return await makeAPIRequest<User>('user-current', '/v1/users/current', getSessionToken());
}

export async function useCurrentAvatar() {
	return await makeAPIRequest<Blob>(
		'avatar-current',
		'/v1/users/current/profile_photo',
		getSessionToken(),
		{
			responseType: 'blob'
		}
	);
}

export const useAuth = () => {
	const user = useState<User | null>('user', () => null);

	const fetchUser = async () => {
		const res = await useCurrentUser();
		if (res.success && res.data) {
			user.value = res.data;
		}
	};

	// If user is not loaded, fetch it
	if (!user.value) {
		fetchUser();
	}

	return {
		user,
		fetchUser
	};
};

export async function updateAccount(user: Partial<User['account']>) {
	return await makeAPIRequest<User>(null, '/v1/users/current/account', getSessionToken(), {
		method: 'PATCH',
		body: user
	});
}

export async function updateFieldPrivacy(privacy: Partial<User['account']['field_privacy']>) {
	return await makeAPIRequest<User>(null, '/v1/users/current/field_privacy', getSessionToken(), {
		method: 'PATCH',
		body: privacy
	});
}

export async function regenerateAvatar() {
	return await makeAPIRequest<Blob>(null, '/v1/users/current/profile_photo', getSessionToken(), {
		method: 'PUT',
		responseType: 'blob'
	});
}

// Other Users

export async function getUsers(limit: number = 25, search: string = '') {
	return await paginatedAPIRequest<User>(
		`users-${search}-${limit}`,
		`/v1/users`,
		getSessionToken(),
		{},
		limit,
		search
	);
}

export async function getUser(identifier: string) {
	return await makeAPIRequest<User>(`user-${identifier}`, `/v1/users/${identifier}`);
}

export async function getUserAvatar(identifier: string) {
	return await makeAPIRequest<Blob>(
		`avatar-${identifier}`,
		`/v1/users/${identifier}/profile_photo`,
		getSessionToken(),
		{
			responseType: 'blob'
		}
	);
}
