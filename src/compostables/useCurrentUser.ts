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
				Authorization: `Bearer ${token}`,
			},
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
		fetchUser,
	};
};
