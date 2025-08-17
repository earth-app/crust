import type { Activity } from '~/shared/types/activity';
import type { User } from '~/shared/types/user';
import { makeAPIRequest, makeClientAPIRequest, paginatedAPIRequest } from '~/shared/util';
import { useCurrentSessionToken } from './useLogin';

export async function useCurrentUser() {
	const token = useCurrentSessionToken();
	if (!token) {
		return { success: false, message: 'Unauthenticated. Please log in to continue.' };
	}

	return await makeAPIRequest<User>('user-current', '/v1/users/current', token);
}

export async function useCurrentAvatar() {
	const token = useCurrentSessionToken();
	if (!token) {
		return { success: false, message: 'Unauthenticated. Please log in to continue.' };
	}

	return await makeAPIRequest<Blob>('avatar-current', '/v1/users/current/profile_photo', token, {
		responseType: 'blob'
	});
}

export const useAuth = () => {
	const user = useState<User | null>('user', () => null);
	const photo = ref<Blob | null>(null);

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

	const fetchPhoto = async () => {
		const res = await useCurrentAvatar();
		if (res.success && res.data) {
			photo.value = res.data;
		}
	};

	// If photo is not loaded, fetch it
	if (!photo.value) {
		fetchPhoto();
	}

	return {
		user,
		fetchUser,
		photo,
		fetchPhoto
	};
};

export async function updateAccount(user: Partial<User['account']>) {
	return await makeClientAPIRequest<User>('/v1/users/current', useCurrentSessionToken(), {
		method: 'PATCH',
		body: user
	});
}

export async function updateFieldPrivacy(privacy: Partial<User['account']['field_privacy']>) {
	return await makeClientAPIRequest<User>(
		'/v1/users/current/field_privacy',
		useCurrentSessionToken(),
		{
			method: 'PATCH',
			body: privacy
		}
	);
}

export async function regenerateAvatar() {
	return await makeClientAPIRequest<Blob>(
		'/v1/users/current/profile_photo',
		useCurrentSessionToken(),
		{
			method: 'PUT',
			responseType: 'blob'
		}
	);
}

export async function setUserActivities(activities: string[]) {
	return await makeClientAPIRequest<User>(
		'/v1/users/current/activities/set',
		useCurrentSessionToken(),
		{
			method: 'PATCH',
			body: activities
		}
	);
}

// Ocean

export async function getRecommendedActivities(poolLimit: number = 25) {
	return await makeAPIRequest<Activity[]>(
		null,
		`/v1/users/current/activities/recommend?poolLimit=${poolLimit}`,
		useCurrentSessionToken(),
		{}
	);
}

// Other Users

export async function getUsers(limit: number = 25, search: string = '') {
	return await paginatedAPIRequest<User>(
		`users-${search}-${limit}`,
		`/v1/users`,
		useCurrentSessionToken(),
		{},
		limit,
		search
	);
}

export async function getUser(identifier: string) {
	return await makeAPIRequest<User>(
		`user-${identifier}`,
		`/v1/users/${identifier}`,
		useCurrentSessionToken()
	);
}

export async function getUserAvatar(identifier: string) {
	return await makeAPIRequest<Blob>(
		`avatar-${identifier}`,
		`/v1/users/${identifier}/profile_photo`,
		useCurrentSessionToken(),
		{
			responseType: 'blob'
		}
	);
}
