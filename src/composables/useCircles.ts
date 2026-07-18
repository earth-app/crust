import type { SendKudosInput, StartExpeditionInput } from 'stores/circles';
import { useCirclesStore } from 'stores/circles';
import type { CircleGarden, CircleResult, Expedition } from 'types/circles';
import { computed } from 'vue';

export function useCircles() {
	const store = useCirclesStore();

	const expedition = computed(() => store.expedition);

	const fetchExpedition = async (force = false): Promise<CircleResult<Expedition | null>> => {
		const data = await store.fetchExpedition(force);
		return { success: true, data };
	};

	const startExpedition = async (
		input: StartExpeditionInput
	): Promise<CircleResult<Expedition>> => {
		const res = await store.startExpedition(input);
		return res.success && res.data
			? { success: true, data: res.data }
			: { success: false, error: res.message };
	};

	const garden = (owner: string) => computed(() => store.getGarden(owner));

	const fetchGarden = async (
		owner: string,
		force = false
	): Promise<CircleResult<CircleGarden | null>> => {
		if (!owner) return { success: false, error: 'A circle owner is required' };
		const data = await store.fetchGarden(owner, force);
		return { success: true, data };
	};

	const sendKudos = async (input: SendKudosInput): Promise<CircleResult<null>> => {
		const res = await store.sendKudos(input);
		if (res.success) return { success: true, data: null, alreadySent: res.alreadySent };
		return { success: false, error: res.message };
	};

	const hasSentKudos = (
		input: Pick<SendKudosInput, 'toUid' | 'contextType' | 'contextRef'>
	): boolean => store.hasSentKudos(input);

	return {
		expedition,
		fetchExpedition,
		startExpedition,
		garden,
		fetchGarden,
		sendKudos,
		hasSentKudos
	};
}

// expedition-only view with the derived, self-referential progress cues (never a rank)
export function useExpedition() {
	const store = useCirclesStore();

	const expedition = computed(() => store.expedition);
	const percent = computed(() => (store.expedition ? expeditionPercent(store.expedition) : 0));
	const remaining = computed(() => (store.expedition ? expeditionRemaining(store.expedition) : 0));
	const contributors = computed(() =>
		store.expedition ? orderedContributors(store.expedition) : []
	);
	const timeLeft = computed(() =>
		store.expedition ? expeditionTimeLeft(store.expedition) : { expired: false, days: 0, hours: 0 }
	);

	const { fetchExpedition, startExpedition } = useCircles();

	return {
		expedition,
		percent,
		remaining,
		contributors,
		timeLeft,
		fetch: fetchExpedition,
		start: startExpedition
	};
}

// kudos-only view; exposes the fixed phrase set + the giver-benefit note, plus the
// one-shot send. never returns or exposes a tally
export function useKudos() {
	const { sendKudos, hasSentKudos } = useCircles();

	return {
		phrases: KUDOS_PHRASES,
		giverNote: KUDOS_GIVER_NOTE,
		send: sendKudos,
		hasSent: hasSentKudos
	};
}
