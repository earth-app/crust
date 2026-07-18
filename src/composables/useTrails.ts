import { useAuthStore } from 'stores/auth';
import { TRAIL_STEP_MINUTES, useTrailsStore } from 'stores/trails';
import type {
	NatureMinutes,
	NatureMinutesSource,
	Trail,
	TrailPledge,
	TrailResult
} from 'types/trails';
import type { Quest } from 'types/user';

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

	return {
		trails,
		natureMinutes,
		fetchTrails,
		fetchNatureMinutes,
		creditNatureMinutes
	};
}

export function useTrail(id: string) {
	const store = useTrailsStore();
	const { creditNatureMinutes } = useTrails();
	// feed the finite "Your Week" self-monitoring reflection (Hunt 2018)
	const { recordCuriosity, recordQuestDone } = useWeeklyReflection();

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

	// synthetic Quest so the reused quest Timeline / step components can drive a trail run
	// unchanged (trail run = quest run with the same id); alt-step groups aren't used by trails
	const asQuest = computed<Quest | null>(() => {
		const t = trail.value;
		if (!t) return null;
		return {
			id: t.id,
			title: t.title,
			description: t.description,
			icon: t.icon,
			rarity: t.rarity,
			steps: t.steps.map((s) => s.step),
			reward: t.reward,
			premium: t.premium
		};
	});

	const accept = (pledge: TrailPledge): TrailResult<void> => {
		const t = trail.value;
		if (!t) return { success: false, error: 'Trail not loaded.' };
		if (!pledge.when || !pledge.when.trim()) {
			return { success: false, error: 'Add a "when" so your pledge has a trigger.' };
		}
		store.acceptTrail(t, pledge);
		return { success: true };
	};

	// unlock a step's awe reveal + optimistically credit Nature Minutes for the outdoor time
	const completeStep = async (index: number) => {
		store.revealStep(id, index);
		// each awe reveal is a "moment of wonder" for the weekly reflection
		recordCuriosity(1);
		return await creditNatureMinutes({
			kind: 'trail_step',
			ref_id: `${id}:${index}`,
			minutes: TRAIL_STEP_MINUTES,
			at: new Date().toISOString()
		});
	};

	const complete = () => {
		store.completeTrail(id);
		// a finished trail is a completed quest for the weekly reflection
		recordQuestDone(1);
		return { success: true as const };
	};

	const reset = () => store.clearRun(id);

	return {
		trail,
		run,
		asQuest,
		fetch,
		accept,
		completeStep,
		complete,
		reset
	};
}
