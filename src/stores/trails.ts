import { defineStore } from 'pinia';
import { natureMinutesSchema, trailSchema } from 'schemas';
import type {
	NatureMinutes,
	NatureMinutesSource,
	Trail,
	TrailPledge,
	TrailProgress
} from 'types/trails';
import { classifyItemFetch, invalidateAPICache, makeAPIRequest, makeClientAPIRequest } from 'utils';
import { reactive, ref } from 'vue';
import { useAuthStore } from './auth';

// ~120 min/week target; personal, never compared
export const NATURE_MINUTES_TARGET = 120;
// optimistic per-step credit when the backend total isn't returned yet
export const TRAIL_STEP_MINUTES = 15;

// zod shape-guards at the store boundary; a bad shape caches as null, never corrupt ui
const isValidTrail = (t: unknown): t is Trail => trailSchema.safeParse(t).success;

const isValidNatureMinutes = (n: unknown): n is NatureMinutes =>
	natureMinutesSchema.safeParse(n).success;

function isoWeekKey(date: Date = new Date()): string {
	// iso-8601 week; used only as a client fallback key when the backend omits `week`
	const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
	const day = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - day);
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
	return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export const useTrailsStore = defineStore('trails', () => {
	const MAX_CACHE_SIZE = 100;
	const cache = reactive(new Map<string, Trail | null>());
	const loading = reactive(new Set<string>());
	const fetchQueue = new Map<string, Promise<void>>();

	// curiosity-gap run state (pledge + which awe reveals have unlocked); step
	// completion itself rides the quest system, this only mirrors the trail overlay
	const runs = reactive(new Map<string, TrailProgress>());

	const listLoaded = ref(false);
	// user-specific; never fetched at store setup (ssr-safe), filled client-side
	const natureMinutes = ref<NatureMinutes | null>(null);

	const evictOldestIfNeeded = () => {
		if (cache.size >= MAX_CACHE_SIZE) {
			const firstKey = cache.keys().next().value;
			if (firstKey) cache.delete(firstKey);
		}
	};

	const get = (id: string): Trail | null | undefined => {
		if (!id) return undefined;
		if (loading.has(id) && !cache.get(id)) return undefined;
		return cache.get(id);
	};

	const has = (id: string): boolean => cache.has(id);

	const list = (): Trail[] =>
		Array.from(cache.values()).filter((t): t is Trail => t !== null && t !== undefined);

	const getRun = (id: string): TrailProgress | undefined => runs.get(id);

	// list responses shouldn't clobber a trail already loaded via its single fetch
	const setTrails = (trails: Trail[]) => {
		for (const trail of trails) {
			if (!isValidTrail(trail)) continue;
			if (cache.get(trail.id)) continue;
			evictOldestIfNeeded();
			cache.set(trail.id, trail);
		}
	};

	const upsertTrail = (trail: Trail) => {
		if (!isValidTrail(trail)) return;
		evictOldestIfNeeded();
		cache.set(trail.id, trail);
	};

	const fetchTrails = async (opts: { theme?: string; premium?: boolean } = {}) => {
		const authStore = useAuthStore();
		const params = new URLSearchParams();
		if (opts.theme) params.set('theme', opts.theme);
		if (opts.premium) params.set('premium', 'true');
		const query = params.toString();

		// direct to mantle2 (absolute apiBaseUrl works on web + native); it proxies to cloud
		const res = await makeAPIRequest<{ items?: Trail[] } | Trail[]>(
			`trails-${query || 'all'}`,
			`/v2/users/trails${query ? `?${query}` : ''}`,
			authStore.sessionToken
		);

		if (valid(res)) {
			const items = Array.isArray(res.data) ? res.data : (res.data.items ?? []);
			setTrails(items);
			listLoaded.value = true;
			return { success: true as const, data: list() };
		}

		return { success: false as const, message: res.message || 'Failed to load trails.' };
	};

	const fetchTrail = async (id: string, force = false): Promise<Trail | null> => {
		if (!id) return null;

		if (cache.has(id) && !force && !fetchQueue.has(id)) return cache.get(id) ?? null;

		const existing = fetchQueue.get(id);
		if (existing && !force) {
			await existing;
			return cache.get(id) ?? null;
		}
		if (force && existing) await existing;
		if (force) invalidateAPICache(`trail-${id}`);

		loading.add(id);
		const authStore = useAuthStore();

		const fetchPromise = (async () => {
			try {
				const res = await makeAPIRequest<Trail>(
					`trail-${id}`,
					`/v2/users/trails/${encodeURIComponent(id)}`,
					authStore.sessionToken
				);

				const outcome = classifyItemFetch<Trail>(res as any, isValidTrail);
				if (outcome.kind === 'valid') {
					evictOldestIfNeeded();
					cache.set(id, outcome.value);
				} else if (outcome.kind === 'not_found') {
					cache.set(id, null);
				} else if (!cache.get(id)) {
					cache.set(id, null);
				}
			} catch (error) {
				if (!cache.get(id)) cache.set(id, null);
				console.warn(`Failed to fetch trail ${id}:`, error);
			} finally {
				loading.delete(id);
				fetchQueue.delete(id);
			}
		})();

		fetchQueue.set(id, fetchPromise);
		await fetchPromise;
		return cache.get(id) ?? null;
	};

	// accept: capture the if-then pledge (strongest behavior lever) and open the run overlay.
	// the underlying quest run is started separately through the quest system by the caller.
	const acceptTrail = (trail: Trail, pledge: TrailPledge): TrailProgress => {
		const run: TrailProgress = {
			trailId: trail.id,
			currentStep: 0,
			completed: false,
			pledge,
			startedAt: new Date().toISOString(),
			stepRevealed: new Array(trail.steps.length).fill(false)
		};
		runs.set(trail.id, run);
		return run;
	};

	// unlock the awe reveal after a step completes; advances the run pointer
	const revealStep = (id: string, index: number) => {
		const run = runs.get(id);
		if (!run) return;
		if (index >= 0 && index < run.stepRevealed.length) run.stepRevealed[index] = true;
		run.currentStep = Math.max(run.currentStep, index + 1);
	};

	const completeTrail = (id: string) => {
		const run = runs.get(id);
		if (run) run.completed = true;
	};

	const clearRun = (id: string) => {
		runs.delete(id);
	};

	const fetchNatureMinutes = async (uid: string) => {
		if (!uid) return { success: false as const, message: 'Missing user id.' };
		const authStore = useAuthStore();
		const res = await makeAPIRequest<NatureMinutes>(
			`nature-minutes-${uid}`,
			`/v2/users/${encodeURIComponent(uid)}/nature-minutes`,
			authStore.sessionToken
		);

		if (valid(res) && isValidNatureMinutes(res.data)) {
			natureMinutes.value = res.data;
			return { success: true as const, data: res.data };
		}

		if (!natureMinutes.value) natureMinutes.value = emptyWeek();
		return { success: false as const, message: res.message || 'Failed to load nature minutes.' };
	};

	function emptyWeek(): NatureMinutes {
		return {
			week: isoWeekKey(),
			minutes: 0,
			target: NATURE_MINUTES_TARGET,
			best: 0,
			sources: [],
			updated_at: new Date().toISOString()
		};
	}

	const creditNatureMinutes = async (uid: string, source: NatureMinutesSource) => {
		if (!uid) return { success: false as const, message: 'Missing user id.' };
		const authStore = useAuthStore();
		invalidateAPICache(`nature-minutes-${uid}`);

		const res = await makeClientAPIRequest<NatureMinutes>(
			`/v2/users/${encodeURIComponent(uid)}/nature-minutes`,
			authStore.sessionToken,
			{ method: 'POST', body: { source } }
		);

		if (valid(res) && isValidNatureMinutes(res.data)) {
			natureMinutes.value = res.data;
			return { success: true as const, data: res.data };
		}

		// optimistic bump so the ring still responds when the backend total isn't echoed
		const base = natureMinutes.value ?? emptyWeek();
		const minutes = base.minutes + Math.max(0, source.minutes);
		natureMinutes.value = {
			...base,
			minutes,
			best: Math.max(base.best, minutes),
			sources: [...base.sources, source],
			updated_at: new Date().toISOString()
		};
		return { success: true as const, data: natureMinutes.value };
	};

	const clear = () => {
		cache.clear();
		runs.clear();
		loading.clear();
		listLoaded.value = false;
		natureMinutes.value = null;
	};

	return {
		cache,
		runs,
		listLoaded,
		natureMinutes,
		get,
		has,
		list,
		getRun,
		setTrails,
		upsertTrail,
		fetchTrails,
		fetchTrail,
		acceptTrail,
		revealStep,
		completeTrail,
		clearRun,
		fetchNatureMinutes,
		creditNatureMinutes,
		clear
	};
});
