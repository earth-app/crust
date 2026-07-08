import { useAuthStore } from 'stores/auth';
import {
	initNetworkMonitor,
	registerMutationDispatcher,
	replayPendingMutations
} from '~/composables/useNetwork';

export default defineNuxtPlugin(() => {
	// register dispatchers BEFORE we start the monitor so an initial-replay
	// against a queue restored from localStorage doesn't drop entries on the floor
	registerMutationDispatcher('mark-read', async (m) => {
		const id = typeof m.payload?.id === 'string' ? m.payload.id : null;
		if (!id) return true;
		try {
			const authStore = useAuthStore();
			const out = await makeClientAPIRequest(
				`/v2/users/current/notifications/${encodeURIComponent(id)}/mark_read`,
				authStore.sessionToken,
				{ method: 'POST' }
			);
			return out.success;
		} catch {
			return false;
		}
	});

	registerMutationDispatcher('mark-all-read', async () => {
		try {
			const authStore = useAuthStore();
			const out = await makeClientAPIRequest(
				`/v2/users/current/notifications/mark_all_read`,
				authStore.sessionToken,
				{ method: 'POST' }
			);
			return out.success;
		} catch {
			return false;
		}
	});

	registerMutationDispatcher('dismiss-onboarding', async () => {
		try {
			const authStore = useAuthStore();
			const out = await makeClientAPIRequest(
				`/v2/users/current/onboarding/dismiss`,
				authStore.sessionToken,
				{ method: 'POST' }
			);
			return out.success;
		} catch {
			return false;
		}
	});

	initNetworkMonitor();
	// run an immediate replay attempt on boot so a tab that loaded online but
	// inherited a queue from a crashed previous session drains promptly
	void replayPendingMutations();
});
