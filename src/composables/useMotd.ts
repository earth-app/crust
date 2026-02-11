import { makeClientAPIRequest } from '~/shared/util';

export function useMotd() {
	const motd = useState<{
		motd: string;
		icon: string;
		type: 'info' | 'success' | 'error' | 'warning';
	}>('motd', () => ({ motd: '', icon: '', type: 'info' }));
	const ttl = useState<number>('motd-ttl', () => 3600);

	const fetchMotd = async () => {
		const res = await makeClientAPIRequest<{
			motd: string;
			ttl: number;
			icon: string;
			type: 'info' | 'success' | 'error' | 'warning';
		}>('/v2/motd', useCurrentSessionToken());
		if (res.success && res.data) {
			if ('message' in res.data) {
				console.error('Failed to fetch MOTD:', res.data.message);
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
			console.error('Failed to fetch MOTD:', res.message || 'Unknown error');
			motd.value = { motd: '', icon: '', type: 'info' };
			ttl.value = 0;
		}
	};

	if (!motd.value.motd) {
		fetchMotd();
	}

	const setMotd = async (
		message: string,
		icon?: string,
		type?: 'info' | 'success' | 'error' | 'warning',
		ttlSeconds?: number
	) => {
		const res = await makeClientAPIRequest('/v2/motd', useCurrentSessionToken(), {
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
