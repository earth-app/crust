import { useAuthStore } from 'stores/auth';
import { useTrailsStore } from 'stores/trails';
import type {
	NatureMinutes,
	NatureMinutesSource,
	Trail,
	TrailJournalEntry,
	TrailPledge,
	TrailReflection,
	TrailResult,
	TrailRun
} from 'types/trails';

// normalize the store's {success,message} into the neutral {success,data,error} envelope;
// components own toasts, composables stay ui-side-effect free
function toResult<T>(res: { success: boolean; data?: T; message?: string }): TrailResult<T> {
	if (res.success) return { success: true, data: res.data };
	return { success: false, error: res.message };
}

export function useTrails() {
	const authStore = useAuthStore();
	const store = useTrailsStore();

	const trails = computed(() => store.list());
	const natureMinutes = computed(() => store.natureMinutes);
	const journal = computed(() => store.journal);

	const fetchTrails = async (opts: { theme?: string; premium?: boolean } = {}) => {
		const res = await store.fetchTrails(opts);
		return toResult<Trail[]>(res as any);
	};

	const resolveUid = (): string | null => authStore.currentUser?.id ?? null;

	const fetchNatureMinutes = async (): Promise<TrailResult<NatureMinutes>> => {
		const uid = resolveUid();
		if (!uid) return { success: false, error: 'You must be signed in to track Nature Minutes.' };
		return toResult<NatureMinutes>((await store.fetchNatureMinutes(uid)) as any);
	};

	const creditNatureMinutes = async (
		source: NatureMinutesSource
	): Promise<TrailResult<NatureMinutes>> => {
		const uid = resolveUid();
		if (!uid) return { success: false, error: 'You must be signed in to track Nature Minutes.' };
		return toResult<NatureMinutes>((await store.creditNatureMinutes(uid, source)) as any);
	};

	const fetchJournal = async (force = false): Promise<TrailResult<TrailJournalEntry[]>> => {
		if (!resolveUid())
			return { success: false, error: 'You must be signed in to see your journal.' };
		return toResult<TrailJournalEntry[]>((await store.fetchJournal(force)) as any);
	};

	return {
		trails,
		natureMinutes,
		journal,
		fetchTrails,
		fetchNatureMinutes,
		creditNatureMinutes,
		fetchJournal
	};
}

export function useTrail(id: string) {
	const store = useTrailsStore();
	// feed the finite "Your Week" self-monitoring reflection (Hunt 2018)
	const { recordCuriosity } = useWeeklyReflection();

	// three-state: undefined = loading, null = not found, Trail = loaded
	const trail = computed(() => store.get(id));
	const run = computed(() => store.getRun(id));

	const fetch = async () => {
		if (!id) return { success: false as const, error: 'Invalid trail id.' };
		const result = await store.fetchTrail(id, false);
		return result
			? { success: true as const, data: result }
			: { success: false as const, error: 'Trail not found.' };
	};

	if (!store.has(id)) fetch();

	// begin a run with the if-then pledge (the strongest behavior lever)
	const start = async (pledge?: TrailPledge): Promise<TrailResult<TrailRun>> => {
		const t = trail.value;
		if (!t) return { success: false, error: 'Trail not loaded.' };
		if (pledge && (!pledge.when || !pledge.when.trim())) {
			return { success: false, error: 'Add a "when" so your pledge has a trigger.' };
		}
		const r = await store.startRun(t, pledge);
		return { success: true, data: r };
	};

	// accumulate unhurried minutes of presence during the practice
	const addPresence = (minutes: number) => store.addPresence(id, minutes);

	// finish with the private reflection; credits nature minutes + writes the journal
	const complete = async (
		reflection: TrailReflection,
		presenceMinutes?: number
	): Promise<TrailResult<TrailJournalEntry>> => {
		const res = await store.completeRun(id, reflection, presenceMinutes);
		// a finished trail is a moment of wonder for the weekly reflection
		recordCuriosity(1);
		return res.success ? { success: true, data: res.data } : { success: false, error: res.message };
	};

	const reset = () => store.clearRun(id);

	return {
		trail,
		run,
		fetch,
		start,
		addPresence,
		complete,
		reset
	};
}
