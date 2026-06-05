import { useAuthStore } from 'stores/auth';
import { makeClientAPIRequest } from 'utils';

export type PollAggregate = {
	counts: number[];
	total: number;
	question: string | null;
	options: string[];
	updated_at: number;
};

export type PollVote = {
	poll_id: string;
	option_index: number;
	option_text: string | null;
	question: string | null;
	options: string[];
	voted_at: number;
	aggregate: PollAggregate;
};

export type PollSubmitPayload = {
	poll_id: string;
	option_index: number;
	question: string;
	options: string[];
};

export type GlobalPollEntry = PollAggregate & { poll_id: string };

// matches mantle2 PollHelper::POLL_ID_PATTERN
const POLL_ID_RE = /^[a-z0-9_-]{1,64}$/;

export function sanitizePollId(raw: string): string {
	return raw
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 64);
}

export function isValidPollId(id: string): boolean {
	return POLL_ID_RE.test(id);
}

export function usePoll() {
	const authStore = useAuthStore();

	const isAuthed = computed(() => Boolean(authStore.sessionToken));

	const fetchMyVotes = async () => {
		if (!authStore.sessionToken) {
			return { success: false as const, message: 'Not signed in', data: [] as PollVote[] };
		}
		const res = await makeClientAPIRequest<{ items: PollVote[] }>(
			'/v2/users/current/poll',
			authStore.sessionToken
		);
		if (valid(res)) {
			return { ...res, data: res.data.items ?? [] };
		}
		return { success: false as const, message: res.message || 'Failed to load polls', data: [] };
	};

	const submitVote = async (payload: PollSubmitPayload) => {
		if (!authStore.sessionToken) {
			return { success: false as const, message: 'Not signed in' };
		}
		if (!isValidPollId(payload.poll_id)) {
			return { success: false as const, message: 'Invalid poll id' };
		}

		const trimmedPayload: PollSubmitPayload = {
			...payload,
			question: payload.question.trim().slice(0, 240)
		};
		return await makeClientAPIRequest<PollVote>('/v2/users/current/poll', authStore.sessionToken, {
			method: 'POST',
			body: trimmedPayload
		});
	};

	const retractVote = async (pollId: string) => {
		if (!authStore.sessionToken) {
			return { success: false as const, message: 'Not signed in' };
		}
		return await makeClientAPIRequest<{ removed: boolean; poll_id: string }>(
			'/v2/users/current/poll',
			authStore.sessionToken,
			{
				method: 'DELETE',
				body: { poll_id: pollId }
			}
		);
	};

	const fetchGlobalAggregates = async () => {
		if (!authStore.sessionToken) {
			return { success: false as const, message: 'Not signed in', data: [] as GlobalPollEntry[] };
		}
		const res = await makeClientAPIRequest<{ items: GlobalPollEntry[] }>(
			'/v2/admin/polls',
			authStore.sessionToken
		);
		if (valid(res)) {
			return { ...res, data: res.data.items ?? [] };
		}
		return {
			success: false as const,
			message: res.message || 'Failed to load global polls',
			data: []
		};
	};

	return {
		isAuthed,
		fetchMyVotes,
		submitVote,
		retractVote,
		fetchGlobalAggregates
	};
}
