import { defineStore } from 'pinia';
import { trailmarkSchema } from 'schemas';
import type { Trailmark, TrailmarkCreateInput, TrailmarkQuery } from 'types/trailmarks';
import { makeAPIRequest, makeClientAPIRequest } from 'utils';
import { reactive, ref } from 'vue';
import { useAuthStore } from './auth';

// nearby reads are cheap to re-run; cache briefly so panning/reopening doesn't refetch
const NEARBY_CACHE_TTL = 2 * 60 * 1000;
// radius cap mirrors the cloud contract (~2km); keeps notes genuinely local
export const TRAILMARK_MAX_RADIUS = 2000;
export const TRAILMARK_DEFAULT_RADIUS = 500;
export const TRAILMARK_MAX_NOTE = 240;

// zod shape-guard at the store boundary; a bad shape is dropped, never cached
const isValidTrailmark = (m: unknown): m is Trailmark => trailmarkSchema.safeParse(m).success;

// round coords so nearby lookups within the same neighborhood share a cache bucket
function nearbyKey(q: TrailmarkQuery): string {
	const r = Math.min(q.radius ?? TRAILMARK_DEFAULT_RADIUS, TRAILMARK_MAX_RADIUS);
	return `${q.lat.toFixed(3)}:${q.lng.toFixed(3)}:${r}`;
}

export const useTrailmarkStore = defineStore('trailmark', () => {
	const cache = reactive(new Map<string, Trailmark>());
	const nearbyCache = reactive(new Map<string, { ids: string[]; timestamp: number }>());
	// notes the current user has authored this session
	const mine = ref<string[]>([]);

	const get = (id: string): Trailmark | undefined => cache.get(id);

	const upsert = (mark: Trailmark) => {
		if (!isValidTrailmark(mark)) return;
		const existing = cache.get(mark.id);
		// preserve a locally-known thank so a fresh nearby fetch can't undo the ui
		cache.set(mark.id, {
			...mark,
			thanked_by_me: mark.thanked_by_me || existing?.thanked_by_me || false
		});
	};

	const getNearbyCached = (q: TrailmarkQuery): Trailmark[] | null => {
		const entry = nearbyCache.get(nearbyKey(q));
		if (entry && Date.now() - entry.timestamp < NEARBY_CACHE_TTL) {
			return entry.ids.map((id) => cache.get(id)).filter((m): m is Trailmark => !!m);
		}
		return null;
	};

	const fetchNearby = async (q: TrailmarkQuery, force = false) => {
		if (!force) {
			const cached = getNearbyCached(q);
			if (cached) return { success: true as const, data: cached };
		}

		const authStore = useAuthStore();
		const radius = Math.min(q.radius ?? TRAILMARK_DEFAULT_RADIUS, TRAILMARK_MAX_RADIUS);
		// direct to mantle2 (it censors + proxies to cloud); null key skips the util cache
		// since the store keeps its own short-lived nearby cache
		const res = await makeAPIRequest<{ items?: Trailmark[] } | Trailmark[]>(
			null,
			`/v2/trailmarks?lat=${q.lat}&lng=${q.lng}&radius=${radius}`,
			authStore.sessionToken
		);

		if (valid(res)) {
			const items = (Array.isArray(res.data) ? res.data : (res.data.items ?? [])).filter(
				isValidTrailmark
			);
			for (const m of items) upsert(m);
			nearbyCache.set(nearbyKey(q), { ids: items.map((m) => m.id), timestamp: Date.now() });
			return { success: true as const, data: items };
		}

		return { success: false as const, message: res.message || 'Failed to load nearby notes.' };
	};

	const createTrailmark = async (input: TrailmarkCreateInput) => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<Trailmark>('/v2/trailmarks', authStore.sessionToken, {
			method: 'POST',
			body: input
		});

		if (valid(res) && isValidTrailmark(res.data)) {
			upsert(res.data);
			if (!mine.value.includes(res.data.id)) mine.value = [res.data.id, ...mine.value];
			// force the next nearby read to include the new note
			nearbyCache.clear();
			return { success: true as const, data: res.data };
		}

		return { success: false as const, message: res.message || 'Failed to leave your note.' };
	};

	const thankTrailmark = async (id: string) => {
		const authStore = useAuthStore();
		const res = await makeClientAPIRequest<void>(
			`/v2/trailmarks/${encodeURIComponent(id)}/thank`,
			authStore.sessionToken,
			{ method: 'POST' }
		);

		const alreadyThanked = res.status === 409;
		if (res.success || alreadyThanked) {
			const mark = cache.get(id);
			if (mark) cache.set(id, { ...mark, thanked_by_me: true });
			return { success: true as const, alreadyThanked };
		}

		return { success: false as const, message: res.message || 'Failed to send thanks.' };
	};

	const hasThanked = (id: string): boolean => cache.get(id)?.thanked_by_me === true;

	const clear = () => {
		cache.clear();
		nearbyCache.clear();
		mine.value = [];
	};

	return {
		cache,
		nearbyCache,
		mine,
		get,
		upsert,
		getNearbyCached,
		fetchNearby,
		createTrailmark,
		thankTrailmark,
		hasThanked,
		clear
	};
});
