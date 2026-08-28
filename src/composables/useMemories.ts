import { useAuthStore } from 'stores/auth';
import type { Memory } from 'types/memories';

/**
 * This day, an earlier year.
 *
 * Reads only what cloud can still see a year later - completed quests and the trail journal - so
 * an empty list is the normal answer and the surface simply is not there on most days.
 */
export function useMemories() {
	const authStore = useAuthStore();

	const list = async () =>
		makeClientAPIRequest<{ memories: Memory[] }>(
			'/v2/users/current/memories',
			authStore.sessionToken
		);

	return { list };
}
