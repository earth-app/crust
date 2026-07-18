import { defineStore } from 'pinia';
import { circleGardenSchema, expeditionSchema } from 'schemas';
import type {
	CircleGarden,
	Expedition,
	ExpeditionGoal,
	KudosContextType,
	KudosPhrase
} from 'types/circles';
import { invalidateAPICache, makeAPIRequest, makeClientAPIRequest } from 'utils';
import { reactive, ref } from 'vue';
import { useAuthStore } from './auth';

const isValidExpedition = (e: unknown): e is Expedition => expeditionSchema.safeParse(e).success;
const isValidGarden = (g: unknown): g is CircleGarden => circleGardenSchema.safeParse(g).success;

export interface StartExpeditionInput {
	title: string;
	goal: ExpeditionGoal;
	target: number;
	days?: number;
}

export interface SendKudosInput {
	toUid: string;
	contextType: KudosContextType;
	contextRef?: string;
	phrase: KudosPhrase;
}

// stable one-shot key so the giver's button can show a "sent" state per context;
// this is a client-side dedupe cue, never a tally or count
export function kudosKey(
	input: Pick<SendKudosInput, 'toUid' | 'contextType' | 'contextRef'>
): string {
	return `${input.contextType}:${input.contextRef ?? ''}:${input.toUid}`;
}

export const useCirclesStore = defineStore('circles', () => {
	// undefined = not fetched, null = fetched + no active expedition, Expedition = active
	const expedition = ref<Expedition | null | undefined>(undefined);
	const expeditionLoading = ref(false);

	// per-owner garden cache; null = fetched + not grown yet
	const gardens = reactive(new Map<string, CircleGarden | null>());
	const gardenLoading = reactive(new Set<string>());

	// giver-side one-shot guard (no counters anywhere)
	const kudosSent = reactive(new Set<string>());

	const token = () => useAuthStore().sessionToken;

	const fetchExpedition = async (force = false): Promise<Expedition | null> => {
		if (expedition.value !== undefined && !force) return expedition.value;
		if (expeditionLoading.value) return expedition.value ?? null;

		expeditionLoading.value = true;
		if (force) invalidateAPICache('circle-expedition');

		try {
			const res = await makeAPIRequest<Expedition>(
				'circle-expedition',
				'/v2/users/current/expedition',
				token()
			);
			if (res.success) {
				// valid shape stores it; a malformed 200 settles to null (no active expedition)
				expedition.value = isValidExpedition(res.data) ? res.data : null;
			} else if (res.status === 404 || res.status === 204) {
				// a definitive "none" clears any prior expedition
				expedition.value = null;
			} else {
				// transient failure - keep last-good, settle to null only if nothing was loaded
				expedition.value = expedition.value ?? null;
			}
			return expedition.value ?? null;
		} finally {
			expeditionLoading.value = false;
		}
	};

	const startExpedition = async (input: StartExpeditionInput) => {
		const res = await makeClientAPIRequest<Expedition>('/v2/users/current/expedition', token(), {
			method: 'POST',
			body: {
				title: input.title.slice(0, 120),
				goal: input.goal,
				target: Math.max(1, Math.round(Number(input.target) || 0)),
				days: input.days ? Math.max(1, Math.round(input.days)) : undefined
			}
		});
		if (res.success && isValidExpedition(res.data)) expedition.value = res.data;
		return res;
	};

	const getGarden = (owner: string): CircleGarden | null | undefined => {
		if (!owner) return undefined;
		return gardens.get(owner);
	};

	const isGardenLoading = (owner: string | null | undefined): boolean => {
		if (!owner) return false;
		return gardenLoading.has(owner);
	};

	const fetchGarden = async (owner: string, force = false): Promise<CircleGarden | null> => {
		if (!owner) return null;
		if (gardens.has(owner) && !force) return gardens.get(owner) ?? null;
		if (gardenLoading.has(owner)) return gardens.get(owner) ?? null;

		gardenLoading.add(owner);
		if (force) invalidateAPICache(`circle-garden-${owner}`);

		try {
			const res = await makeAPIRequest<CircleGarden>(
				`circle-garden-${owner}`,
				`/v2/users/${encodeURIComponent(owner)}/garden`,
				token()
			);
			if (res.success) {
				// only a valid garden shape is cached; a partial/malformed one settles to null
				gardens.set(owner, isValidGarden(res.data) ? res.data : null);
			} else if (!gardens.has(owner)) {
				gardens.set(owner, null);
			}
			return gardens.get(owner) ?? null;
		} finally {
			gardenLoading.delete(owner);
		}
	};

	const hasSentKudos = (
		input: Pick<SendKudosInput, 'toUid' | 'contextType' | 'contextRef'>
	): boolean => {
		return kudosSent.has(kudosKey(input));
	};

	const sendKudos = async (
		input: SendKudosInput
	): Promise<{ success: boolean; alreadySent: boolean; message?: string }> => {
		const key = kudosKey(input);
		if (kudosSent.has(key)) return { success: true, alreadySent: true };

		const res = await makeClientAPIRequest(
			`/v2/users/${encodeURIComponent(input.toUid)}/kudos`,
			token(),
			{
				method: 'POST',
				body: {
					context_type: input.contextType,
					context_ref: input.contextRef,
					phrase: input.phrase
				}
			}
		);

		const alreadySent = res.status === 409;
		if (res.success || alreadySent) {
			kudosSent.add(key);
			return { success: true, alreadySent };
		}

		return { success: false, alreadySent: false, message: res.message };
	};

	const clear = () => {
		expedition.value = undefined;
		gardens.clear();
		gardenLoading.clear();
		kudosSent.clear();
	};

	return {
		expedition,
		expeditionLoading,
		gardens,
		kudosSent,
		fetchExpedition,
		startExpedition,
		getGarden,
		isGardenLoading,
		fetchGarden,
		hasSentKudos,
		sendKudos,
		clear
	};
});
