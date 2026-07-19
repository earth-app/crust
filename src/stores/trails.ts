import { defineStore } from 'pinia';
import { natureMinutesSchema, trailJournalEntrySchema, trailSchema } from 'schemas';
import type {
	NatureMinutes,
	NatureMinutesSource,
	Trail,
	TrailJournalEntry,
	TrailPledge,
	TrailReflection,
	TrailRun
} from 'types/trails';
import { classifyItemFetch, invalidateAPICache, makeAPIRequest, makeClientAPIRequest } from 'utils';
import { reactive, ref } from 'vue';
import { registerTrailPracticeMeta } from '~/shared/utils/trails';
import { useAuthStore } from './auth';

// ~120 min/week target; personal, never compared
export const NATURE_MINUTES_TARGET = 120;

// zod shape-guards at the store boundary; a bad shape caches as null, never corrupt ui
const isValidTrail = (t: unknown): t is Trail => trailSchema.safeParse(t).success;

const isValidNatureMinutes = (n: unknown): n is NatureMinutes =>
	natureMinutesSchema.safeParse(n).success;

const isValidJournalEntry = (e: unknown): e is TrailJournalEntry =>
	trailJournalEntrySchema.safeParse(e).success;

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

	// standalone run state: the if-then pledge + accumulated presence, NO quest overlay
	const runs = reactive(new Map<string, TrailRun>());

	const listLoaded = ref(false);
	// user-specific; never fetched at store setup (ssr-safe), filled client-side
	const natureMinutes = ref<NatureMinutes | null>(null);
	// the private reflection journal (most-recent first)
	const journal = ref<TrailJournalEntry[]>([]);
	const journalLoaded = ref(false);

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

	const getRun = (id: string): TrailRun | undefined => runs.get(id);

	// list responses shouldn't clobber a trail already loaded via its single fetch
	const setTrails = (trails: Trail[]) => {
		for (const trail of trails) {
			if (!isValidTrail(trail)) continue;
			// fill the practice-meta cache from the cloud response (source of truth)
			registerTrailPracticeMeta(trail);
			if (cache.get(trail.id)) continue;
			evictOldestIfNeeded();
			cache.set(trail.id, trail);
		}
	};

	const upsertTrail = (trail: Trail) => {
		if (!isValidTrail(trail)) return;
		registerTrailPracticeMeta(trail);
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

	// #region run lifecycle (start -> presence -> reflect, all standalone)

	// begin a run: record the if-then pledge locally + best-effort persist to the backend.
	// the run is a client-side flow; completion is the durable persistence point
	const startRun = async (trail: Trail, pledge?: TrailPledge): Promise<TrailRun> => {
		const run: TrailRun = {
			trailId: trail.id,
			pledge,
			startedAt: new Date().toISOString(),
			presenceMinutes: 0,
			completed: false
		};
		runs.set(trail.id, run);

		const authStore = useAuthStore();
		try {
			await makeClientAPIRequest(
				`/v2/users/current/trails/${encodeURIComponent(trail.id)}/start`,
				authStore.sessionToken,
				{ method: 'POST', body: { pledge } }
			);
		} catch {
			// non-fatal: the pledge still drives the local run and completion re-sends it
		}
		return run;
	};

	// accumulate unhurried minutes of presence onto the active run
	const addPresence = (id: string, minutes: number) => {
		const run = runs.get(id);
		if (!run) return;
		run.presenceMinutes = Math.max(0, run.presenceMinutes + Math.max(0, minutes));
	};

	// finish a run: persist the private reflection + credit nature minutes, then update the
	// journal + ring from the server echo (optimistic fallback keeps the ui responsive)
	const completeRun = async (
		id: string,
		reflection: TrailReflection,
		presenceMinutes?: number
	): Promise<{ success: boolean; data?: TrailJournalEntry; message?: string }> => {
		const run = runs.get(id);
		const trail = cache.get(id) ?? null;
		const minutes = Math.max(0, presenceMinutes ?? run?.presenceMinutes ?? 0);
		const authStore = useAuthStore();
		invalidateAPICache('trail-journal');
		invalidateAPICache('nature-minutes-current');

		const res = await makeClientAPIRequest<{
			entry?: TrailJournalEntry;
			natureMinutes?: NatureMinutes;
		}>(`/v2/users/current/trails/${encodeURIComponent(id)}/complete`, authStore.sessionToken, {
			method: 'POST',
			body: { presenceMinutes: minutes, reflection }
		});

		if (run) run.completed = true;

		// the server echo may carry a fresh nature-minutes total and/or a journal entry
		const serverMinutes = valid(res) && !!res.data && isValidNatureMinutes(res.data.natureMinutes);
		if (serverMinutes) natureMinutes.value = res.data!.natureMinutes!;
		if (valid(res) && res.data && isValidJournalEntry(res.data.entry)) {
			journal.value = [res.data.entry, ...journal.value];
			return { success: true, data: res.data.entry };
		}

		// fallback: synthesize the journal entry; only bump the ring if the server didn't
		const entry: TrailJournalEntry = {
			trailId: id,
			title: trail?.title ?? 'Trail',
			practice: trail?.practice ?? 'sit_spot',
			presenceMinutes: minutes,
			reflection,
			completedAt: new Date().toISOString()
		};
		journal.value = [entry, ...journal.value];
		if (!serverMinutes)
			bumpNatureMinutesLocal({ kind: 'trail', ref_id: id, minutes, at: entry.completedAt });
		return { success: true, data: entry };
	};

	const clearRun = (id: string) => {
		runs.delete(id);
	};

	// #endregion

	// #region journal

	const fetchJournal = async (force = false) => {
		if (journalLoaded.value && !force) return { success: true as const, data: journal.value };
		const authStore = useAuthStore();
		if (force) invalidateAPICache('trail-journal');

		const res = await makeAPIRequest<{ items?: TrailJournalEntry[] } | TrailJournalEntry[]>(
			'trail-journal',
			'/v2/users/current/trail-journal',
			authStore.sessionToken
		);

		if (valid(res)) {
			const raw = Array.isArray(res.data) ? res.data : (res.data.items ?? []);
			journal.value = raw.filter(isValidJournalEntry);
			journalLoaded.value = true;
			return { success: true as const, data: journal.value };
		}

		return { success: false as const, message: res.message || 'Failed to load your journal.' };
	};

	// #endregion

	// #region nature minutes

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

	// optimistic local bump so the ring still responds when the backend total isn't echoed
	function bumpNatureMinutesLocal(source: NatureMinutesSource) {
		const base = natureMinutes.value ?? emptyWeek();
		const minutes = base.minutes + Math.max(0, source.minutes);
		natureMinutes.value = {
			...base,
			minutes,
			best: Math.max(base.best, minutes),
			sources: [...base.sources, source],
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

		bumpNatureMinutesLocal(source);
		return { success: true as const, data: natureMinutes.value! };
	};

	// #endregion

	const clear = () => {
		cache.clear();
		runs.clear();
		loading.clear();
		listLoaded.value = false;
		natureMinutes.value = null;
		journal.value = [];
		journalLoaded.value = false;
	};

	return {
		cache,
		runs,
		listLoaded,
		natureMinutes,
		journal,
		journalLoaded,
		get,
		has,
		list,
		getRun,
		setTrails,
		upsertTrail,
		fetchTrails,
		fetchTrail,
		startRun,
		addPresence,
		completeRun,
		clearRun,
		fetchJournal,
		fetchNatureMinutes,
		creditNatureMinutes,
		clear
	};
});
