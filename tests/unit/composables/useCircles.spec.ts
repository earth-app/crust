import { createPinia, setActivePinia } from 'pinia';
import type { Expedition } from 'types/circles';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCircles, useExpedition, useKudos } from '~/composables/useCircles';

vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return { ...actual, makeAPIRequest: vi.fn(), makeClientAPIRequest: vi.fn() };
});

import { makeAPIRequest, makeClientAPIRequest } from 'utils';

const ok = <T>(data: T) => ({ success: true as const, data });
const fail = (message = 'boom') => ({ success: false as const, message });

function expedition(partial: Partial<Expedition> = {}): Expedition {
	return {
		id: 'exp1',
		owner_uid: 'owner',
		title: 'Weekend Woods',
		goal: 'nature_minutes',
		target: 600,
		progress: 300,
		contributors: [
			{ uid: 'a', username: 'Ana', contribution: 200 },
			{ uid: 'b', username: 'Bo', contribution: 100 }
		],
		status: 'active',
		starts_at: new Date().toISOString(),
		ends_at: new Date(Date.now() + 604_800_000).toISOString(),
		...partial
	};
}

beforeEach(() => {
	setActivePinia(createPinia());
	vi.clearAllMocks();
});

describe('useCircles', () => {
	it('wraps fetchExpedition in a neutral envelope', async () => {
		vi.mocked(makeAPIRequest).mockResolvedValue(ok(expedition()) as any);
		const { fetchExpedition, expedition: exp } = useCircles();

		const res = await fetchExpedition();
		expect(res).toEqual({ success: true, data: expect.objectContaining({ id: 'exp1' }) });
		expect(exp.value?.id).toBe('exp1');
	});

	it('maps a successful start to a data envelope', async () => {
		vi.mocked(makeClientAPIRequest).mockResolvedValue(ok(expedition({ id: 'started' })) as any);
		const { startExpedition } = useCircles();

		const res = await startExpedition({ title: 'T', goal: 'quests', target: 5 });
		expect(res.success).toBe(true);
		expect(res.data?.id).toBe('started');
	});

	it('maps a failed start to an error envelope', async () => {
		vi.mocked(makeClientAPIRequest).mockResolvedValue(fail('denied') as any);
		const { startExpedition } = useCircles();

		const res = await startExpedition({ title: 'T', goal: 'quests', target: 5 });
		expect(res).toEqual({ success: false, error: 'denied' });
	});

	it('rejects a garden fetch with no owner before hitting the network', async () => {
		const { fetchGarden } = useCircles();
		const res = await fetchGarden('');
		expect(res.success).toBe(false);
		expect(makeAPIRequest).not.toHaveBeenCalled();
	});

	it('exposes a per-owner garden accessor', async () => {
		const garden = {
			owner_uid: 'o1',
			level: 2,
			total_minutes: 10,
			elements: [],
			animated: false,
			updated_at: 'x'
		};
		vi.mocked(makeAPIRequest).mockResolvedValue(ok(garden) as any);
		const { fetchGarden, garden: gardenAt } = useCircles();

		await fetchGarden('o1');
		expect(gardenAt('o1').value?.level).toBe(2);
	});

	it('sends kudos and reflects the one-shot state, never a tally', async () => {
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true } as any);
		const { sendKudos, hasSentKudos } = useCircles();
		const input = {
			toUid: 'friend',
			contextType: 'trail' as const,
			contextRef: 't1',
			phrase: 'inspiring' as const
		};

		const res = await sendKudos(input);
		expect(res).toEqual({ success: true, data: null, alreadySent: false });
		expect(hasSentKudos(input)).toBe(true);
	});

	it('maps a failed kudos send to an error envelope', async () => {
		vi.mocked(makeClientAPIRequest).mockResolvedValue(fail('rate limited') as any);
		const { sendKudos } = useCircles();

		const res = await sendKudos({ toUid: 'f', contextType: 'quest', phrase: 'go_you' });
		expect(res).toEqual({ success: false, error: 'rate limited' });
	});
});

describe('useExpedition', () => {
	it('derives self-referential progress cues after a fetch', async () => {
		vi.mocked(makeAPIRequest).mockResolvedValue(ok(expedition()) as any);
		const { fetch, percent, remaining, contributors, timeLeft } = useExpedition();

		await fetch();
		expect(percent.value).toBeCloseTo(0.5);
		expect(remaining.value).toBe(300);
		expect(contributors.value.map((c) => c.uid)).toEqual(['a', 'b']);
		expect(timeLeft.value.expired).toBe(false);
	});

	it('gives neutral defaults with no expedition loaded', () => {
		const { percent, remaining, contributors, timeLeft } = useExpedition();
		expect(percent.value).toBe(0);
		expect(remaining.value).toBe(0);
		expect(contributors.value).toEqual([]);
		expect(timeLeft.value).toEqual({ expired: false, days: 0, hours: 0 });
	});
});

describe('useKudos', () => {
	it('exposes the fixed phrase set and the giver note', () => {
		const { phrases, giverNote } = useKudos();
		expect(phrases).toHaveLength(6);
		expect(giverNote.toLowerCase()).toContain('you');
	});

	it('sends and tracks the one-shot through the same store', async () => {
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true } as any);
		const { send, hasSent } = useKudos();
		const input = {
			toUid: 'friend',
			contextType: 'journey' as const,
			phrase: 'welcome_back' as const
		};

		const res = await send(input);
		expect(res.success).toBe(true);
		expect(hasSent(input)).toBe(true);
	});
});
