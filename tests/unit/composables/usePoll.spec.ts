import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from 'stores/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidPollId, sanitizePollId, usePoll } from '~/composables/usePoll';

// makeClientAPIRequest backs every poll endpoint; pure helpers stay real
vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return { ...actual, makeClientAPIRequest: vi.fn() };
});

import { makeClientAPIRequest } from 'utils';

const ok = <T>(data: T) => ({ success: true as const, data });

describe('sanitizePollId', () => {
	it('lowercases and replaces invalid runs with a single hyphen', () => {
		expect(sanitizePollId('Hello World!!')).toBe('hello-world');
		expect(sanitizePollId('Mood   Today')).toBe('mood-today');
	});

	it('collapses repeated hyphens and trims edge hyphens', () => {
		expect(sanitizePollId('--Mood--Today--')).toBe('mood-today');
	});

	it('preserves already-valid underscores and digits', () => {
		expect(sanitizePollId('mood_2_day')).toBe('mood_2_day');
	});

	it('truncates to 64 characters', () => {
		expect(sanitizePollId('a'.repeat(100))).toHaveLength(64);
	});
});

describe('isValidPollId', () => {
	it('accepts lowercase alnum, hyphen and underscore up to 64 chars', () => {
		expect(isValidPollId('mood-today_2')).toBe(true);
		expect(isValidPollId('a'.repeat(64))).toBe(true);
	});

	it('rejects empty, uppercase, spaces, and over-length ids', () => {
		expect(isValidPollId('')).toBe(false);
		expect(isValidPollId('Mood')).toBe(false);
		expect(isValidPollId('mood today')).toBe(false);
		expect(isValidPollId('a'.repeat(65))).toBe(false);
	});
});

describe('usePoll', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		// session token is cookie-backed and survives createPinia(); clear it so
		// an authed() in one test can't leak into a signed-out assertion in the next
		useAuthStore().setSessionToken(null);
		vi.clearAllMocks();
	});

	const authed = () => useAuthStore().setSessionToken('token');

	it('isAuthed tracks the session token', () => {
		const { isAuthed } = usePoll();
		expect(isAuthed.value).toBe(false);
		authed();
		expect(isAuthed.value).toBe(true);
	});

	describe('fetchMyVotes', () => {
		it('short-circuits to an empty result when signed out', async () => {
			const { fetchMyVotes } = usePoll();
			const res = await fetchMyVotes();

			expect(res).toEqual({ success: false, message: 'Not signed in', data: [] });
			expect(makeClientAPIRequest).not.toHaveBeenCalled();
		});

		it('returns the items array when authenticated', async () => {
			authed();
			(makeClientAPIRequest as any).mockResolvedValue(ok({ items: [{ poll_id: 'p1' }] }));
			const { fetchMyVotes } = usePoll();

			const res = await fetchMyVotes();

			expect(res.success).toBe(true);
			expect((res as any).data).toEqual([{ poll_id: 'p1' }]);
			expect((makeClientAPIRequest as any).mock.calls[0][0]).toBe('/v2/users/current/poll');
		});

		it('coerces a missing items field to an empty array', async () => {
			authed();
			(makeClientAPIRequest as any).mockResolvedValue(ok({}));
			const { fetchMyVotes } = usePoll();

			const res = await fetchMyVotes();
			expect((res as any).data).toEqual([]);
		});
	});

	describe('submitVote', () => {
		const payload = {
			poll_id: 'mood-today',
			option_index: 1,
			question: 'How are you?',
			options: ['a', 'b']
		};

		it('rejects when signed out', async () => {
			const { submitVote } = usePoll();
			expect(await submitVote(payload)).toEqual({ success: false, message: 'Not signed in' });
			expect(makeClientAPIRequest).not.toHaveBeenCalled();
		});

		it('rejects an invalid poll id without hitting the network', async () => {
			authed();
			const { submitVote } = usePoll();
			const res = await submitVote({ ...payload, poll_id: 'Bad Id!' });

			expect(res).toEqual({ success: false, message: 'Invalid poll id' });
			expect(makeClientAPIRequest).not.toHaveBeenCalled();
		});

		it('trims and caps the question, then POSTs the vote', async () => {
			authed();
			(makeClientAPIRequest as any).mockResolvedValue(ok({}));
			const { submitVote } = usePoll();

			const longQuestion = '  ' + 'q'.repeat(300) + '  ';
			await submitVote({ ...payload, question: longQuestion });

			const [path, , opts] = (makeClientAPIRequest as any).mock.calls[0];
			expect(path).toBe('/v2/users/current/poll');
			expect(opts.method).toBe('POST');
			expect(opts.body.question).toHaveLength(240);
			expect(opts.body.question.startsWith('q')).toBe(true);
		});
	});

	describe('retractVote', () => {
		it('rejects when signed out', async () => {
			const { retractVote } = usePoll();
			expect(await retractVote('p1')).toEqual({ success: false, message: 'Not signed in' });
		});

		it('DELETEs the poll id when authenticated', async () => {
			authed();
			(makeClientAPIRequest as any).mockResolvedValue(ok({ removed: true, poll_id: 'p1' }));
			const { retractVote } = usePoll();

			await retractVote('p1');

			const [path, , opts] = (makeClientAPIRequest as any).mock.calls[0];
			expect(path).toBe('/v2/users/current/poll');
			expect(opts.method).toBe('DELETE');
			expect(opts.body).toEqual({ poll_id: 'p1' });
		});
	});

	describe('fetchGlobalAggregates', () => {
		it('short-circuits to an empty result when signed out', async () => {
			const { fetchGlobalAggregates } = usePoll();
			const res = await fetchGlobalAggregates();
			expect(res).toEqual({ success: false, message: 'Not signed in', data: [] });
		});

		it('returns the admin aggregate items when authenticated', async () => {
			authed();
			(makeClientAPIRequest as any).mockResolvedValue(ok({ items: [{ poll_id: 'p1', total: 3 }] }));
			const { fetchGlobalAggregates } = usePoll();

			const res = await fetchGlobalAggregates();

			expect((res as any).data).toEqual([{ poll_id: 'p1', total: 3 }]);
			expect((makeClientAPIRequest as any).mock.calls[0][0]).toBe('/v2/admin/polls');
		});
	});
});
