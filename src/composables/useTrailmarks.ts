import { TRAILMARK_MAX_NOTE, TRAILMARK_MAX_RADIUS, useTrailmarkStore } from 'stores/trailmark';
import type {
	Trailmark,
	TrailmarkCreateInput,
	TrailmarkGeo,
	TrailmarkQuery,
	TrailmarkResult
} from 'types/trailmarks';
// normalize the store's {success,message,alreadyThanked} into the neutral envelope;
// components own toasts, composables stay ui-side-effect free
function toResult<T>(res: {
	success: boolean;
	data?: T;
	message?: string;
	alreadyThanked?: boolean;
}): TrailmarkResult<T> {
	if (res.success)
		return {
			success: true,
			data: res.data,
			...(res.alreadyThanked ? { alreadyThanked: true } : {})
		};
	return { success: false, error: res.message };
}

// haversine distance in meters; deterministic (belongs in code, not latent space)
export function trailmarkDistanceMeters(a: TrailmarkGeo, b: TrailmarkGeo): number {
	const R = 6371000;
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const dLat = toRad(b.lat - a.lat);
	const dLng = toRad(b.lng - a.lng);
	const lat1 = toRad(a.lat);
	const lat2 = toRad(b.lat);
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
	return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
}

export function useTrailmarks() {
	const store = useTrailmarkStore();

	// nearby notes surfaced by the latest fetch; ordered nearest-first when an origin is known
	const nearby = ref<Trailmark[]>([]);
	const loading = ref(false);

	const mine = computed<Trailmark[]>(() =>
		store.mine.map((id) => store.get(id)).filter((m): m is Trailmark => !!m)
	);

	const fetchNearby = async (
		q: TrailmarkQuery,
		force = false
	): Promise<TrailmarkResult<Trailmark[]>> => {
		if (!Number.isFinite(q.lat) || !Number.isFinite(q.lng)) {
			return { success: false, error: 'A valid location is required to find nearby notes.' };
		}
		loading.value = true;
		try {
			const res = await store.fetchNearby(q, force);
			if (res.success) {
				const origin: TrailmarkGeo = { lat: q.lat, lng: q.lng };
				nearby.value = [...res.data].sort(
					(a, b) => trailmarkDistanceMeters(origin, a.geo) - trailmarkDistanceMeters(origin, b.geo)
				);
				return { success: true, data: nearby.value };
			}
			return toResult<Trailmark[]>(res);
		} finally {
			loading.value = false;
		}
	};

	const leaveNote = async (input: TrailmarkCreateInput): Promise<TrailmarkResult<Trailmark>> => {
		const note = (input.note ?? '').trim();
		if (!note) return { success: false, error: 'Write a short note before posting.' };
		if (note.length > TRAILMARK_MAX_NOTE) {
			return { success: false, error: `Keep it under ${TRAILMARK_MAX_NOTE} characters.` };
		}
		if (!input.geo || !Number.isFinite(input.geo.lat) || !Number.isFinite(input.geo.lng)) {
			return { success: false, error: 'A valid location is required to leave a note.' };
		}

		const res = await store.createTrailmark({ ...input, note });
		if (res.success) {
			// surface the new note at the top of the local list immediately
			nearby.value = [res.data, ...nearby.value.filter((m) => m.id !== res.data.id)];
		}
		return toResult<Trailmark>(res);
	};

	const thank = async (id: string): Promise<TrailmarkResult<void>> => {
		if (!id) return { success: false, error: 'Missing note id.' };
		return toResult<void>(await store.thankTrailmark(id));
	};

	const hasThanked = (id: string): boolean => store.hasThanked(id);
	const get = (id: string): Trailmark | undefined => store.get(id);

	// the 'from outside' notes a prompt has collected
	const forPrompt = (promptId: string): Trailmark[] => store.forPrompt(promptId);

	const fetchForPrompt = async (
		promptId: string,
		force = false
	): Promise<TrailmarkResult<Trailmark[]>> => {
		if (!promptId) return { success: false, error: 'Missing prompt id.' };
		return toResult<Trailmark[]>(await store.fetchForPrompt(promptId, force));
	};

	return {
		nearby,
		mine,
		loading,
		maxNote: TRAILMARK_MAX_NOTE,
		maxRadius: TRAILMARK_MAX_RADIUS,
		fetchNearby,
		leaveNote,
		thank,
		hasThanked,
		get,
		forPrompt,
		fetchForPrompt
	};
}
