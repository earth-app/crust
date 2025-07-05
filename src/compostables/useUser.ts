import { useRequestHeaders, useCookie, useRuntimeConfig } from '#imports';
import type { User } from '~/shared/types/user';

export async function useCurrentUser() {
	const config = useRuntimeConfig();

	let token: string | null | undefined;

	if (import.meta.server) {
		const headers = useRequestHeaders(['cookie']);
		const cookieHeader = headers.cookie || '';
		const match = cookieHeader.match(/session_token=([^;]+)/);
		token = match?.[1];
	} else {
		token = useCookie('session_token').value;
	}

	if (!token) return null;

	try {
		return await $fetch<User>(`${config.public.apiBaseUrl}/v1/users/current`, {
			headers: {
				Authorization: `Bearer ${token}`
			}
		});
	} catch (error) {
		console.error('Failed to fetch current user:', error);
		return null;
	}
}

export const useAuth = () => {
	const user = useState<User | null>('user', () => null);

	const fetchUser = async () => {
		const res = await useCurrentUser();
		user.value = res;
	};

	return {
		user,
		fetchUser
	};
};

export async function updateAccount(user: User['account']) {
	const config = useRuntimeConfig();
	const token = useCookie('session_token').value;

	if (!token) {
		return { success: false, message: 'No session token found' };
	}

	try {
		const { data, error } = await useFetch<User>(`${config.public.apiBaseUrl}/v1/users/current`, {
			method: 'PATCH',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json'
			},
			body: user
		});

		if (error.value) {
			console.error('Error updating user:', error.value);
			return { success: false, message: error.value.message };
		}

		if (data.value) {
			const auth = useAuth();
			auth.user.value = data.value;

			return { success: true, user: data.value };
		}
	} catch (error) {
		console.error('Failed to update user:', error);
		throw error;
	}

	return { success: false, message: 'Failed to update user' };
}

export async function getUsers(): Promise<User[]> {
	const config = useRuntimeConfig();
	const token = useCookie('session_token').value;
	try {
		let headers: Record<string, string> = {};

		if (token) headers['Authorization'] = `Bearer ${token}`;
		headers['Content-Type'] = 'application/json';

		const { data, error } = await useFetch<{ items: User[] }>(
			`${config.public.apiBaseUrl}/v1/users`,
			{}
		);

		if (error.value) {
			console.error('Error fetching users:', error.value);
			return [];
		}

		return data.value?.items || [];
	} catch (error) {
		console.error('Failed to fetch users:', error);
		return [];
	}
}
