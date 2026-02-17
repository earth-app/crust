import { makeAPIRequest, makeClientAPIRequest } from '~/shared/util';
import { useAuthStore } from '~/stores/auth';

export function useMotd() {
	const authStore = useAuthStore();
	const motd = useState<{
		motd: string;
		icon: string;
		type: 'info' | 'success' | 'error' | 'warning';
	}>('motd', () => ({ motd: '', icon: '', type: 'info' }));
	const ttl = useState<number>('motd-ttl', () => 3600);

	const fetchMotd = async () => {
		const res = await makeAPIRequest<{
			motd: string;
			ttl: number;
			icon: string;
			type: 'info' | 'success' | 'error' | 'warning';
		}>('motd-data', '/v2/motd', authStore.sessionToken);
		if (res.success && res.data) {
			if ('message' in res.data) {
				// Silently handle when MOTD isn't set
				motd.value = { motd: '', icon: '', type: 'info' };
				ttl.value = 0;
				return;
			}

			motd.value = {
				motd: res.data.motd,
				icon: res.data.icon,
				type: res.data.type
			};
			ttl.value = res.data.ttl;
		} else {
			// Silently handle when MOTD isn't set
			motd.value = { motd: '', icon: '', type: 'info' };
			ttl.value = 0;
		}
	};

	const setMotd = async (
		message: string,
		icon?: string,
		type?: 'info' | 'success' | 'error' | 'warning',
		ttlSeconds?: number
	) => {
		const res = await makeClientAPIRequest('/v2/motd', authStore.sessionToken, {
			method: 'POST',
			body: JSON.stringify({ motd: message, icon, type, ttl: ttlSeconds })
		});

		if (!res.success) {
			console.error('Failed to set MOTD:', res.message || 'Unknown error');
			return;
		}

		motd.value = { motd: message, icon: icon || '', type: type || 'info' };
		ttl.value = ttlSeconds || 0;
	};

	return {
		motd,
		ttl,
		fetchMotd,
		setMotd
	};
}
