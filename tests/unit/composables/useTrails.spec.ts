import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from 'stores/auth';
import { useTrailsStore } from 'stores/trails';
import type { Trail } from 'types/trails';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTrail, useTrails } from '~/composables/useTrails';

vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return {
		...actual,
		makeAPIRequest: vi.fn(),
		makeClientAPIRequest: vi.fn(),
		invalidateAPICache: vi.fn()
	};
});

import { makeAPIRequest, makeClientAPIRequest } from 'utils';

function trail(id: string, extra: Partial<Trail> = {}): Trail {
	return {
		id,
		title: `Trail ${id}`,
		theme: 'nature',
		description: 'A short walk',
		icon: 'mdi:leaf',
		rarity: 'normal',
		steps: [
			{
				step: { type: 'take_photo_location', description: 'Photograph a tree', parameters: [] },
				clue: 'What is older than it looks?',
				reveal: 'That oak may be two centuries old.'
			}
		],
		reward: 10,
		...extra
	} as Trail;
}

const ok = <T>(data: T) => ({ success: true as const, data });

function authed() {
	const auth = useAuthStore();
	auth.setSessionToken('token');
	auth.currentUser = { id: 'u1' } as any;
}

beforeEach(() => {
	setActivePinia(createPinia());
	vi.clearAllMocks();
});

describe('useTrails', () => {
	it('fetchTrails delegates to the store and returns the neutral envelope', async () => {
		vi.mocked(makeAPIRequest).mockResolvedValue(ok([trail('a'), trail('b')]) as any);
		const { fetchTrails, trails } = useTrails();
		const res = await fetchTrails();
		expect(res.success).toBe(true);
		expect((res.data ?? []).map((t) => t.id).sort()).toEqual(['a', 'b']);
		expect(trails.value.length).toBe(2);
	});

	it('fetchNatureMinutes requires a signed-in user', async () => {
		const { fetchNatureMinutes } = useTrails();
		const res = await fetchNatureMinutes();
		expect(res.success).toBe(false);
		expect(res.error).toMatch(/signed in/i);
		expect(makeAPIRequest).not.toHaveBeenCalled();
	});

	it('fetchNatureMinutes returns store data when authed', async () => {
		authed();
		vi.mocked(makeAPIRequest).mockResolvedValue(
			ok({
				week: '2026-W29',
				minutes: 40,
				target: 120,
				best: 40,
				sources: [],
				updated_at: 'x'
			}) as any
		);
		const { fetchNatureMinutes } = useTrails();
		const res = await fetchNatureMinutes();
		expect(res.success).toBe(true);
		expect(res.data?.minutes).toBe(40);
	});

	it('creditNatureMinutes requires a signed-in user', async () => {
		const { creditNatureMinutes } = useTrails();
		const res = await creditNatureMinutes({ kind: 'manual', minutes: 5, at: 'now' });
		expect(res.success).toBe(false);
		expect(makeClientAPIRequest).not.toHaveBeenCalled();
	});
});

describe('useTrail', () => {
	it('projects the trail into a synthetic quest for the reused timeline', () => {
		const store = useTrailsStore();
		store.upsertTrail(trail('t1'));
		const { asQuest } = useTrail('t1');
		expect(asQuest.value?.id).toBe('t1');
		// trail steps map down to their underlying quest steps
		expect(asQuest.value?.steps.length).toBe(1);
		expect((asQuest.value?.steps[0] as any).type).toBe('take_photo_location');
	});

	it('accept rejects a pledge with no trigger', () => {
		const store = useTrailsStore();
		store.upsertTrail(trail('t1'));
		const { accept } = useTrail('t1');
		const res = accept({ when: '   ' });
		expect(res.success).toBe(false);
		expect(store.getRun('t1')).toBeUndefined();
	});

	it('accept captures a valid pledge and opens the run', () => {
		const store = useTrailsStore();
		store.upsertTrail(trail('t1'));
		const { accept, run } = useTrail('t1');
		const res = accept({ when: 'after breakfast', where: 'the park' });
		expect(res.success).toBe(true);
		expect(run.value?.pledge?.where).toBe('the park');
	});

	it('completeStep reveals the awe payoff and credits nature minutes', async () => {
		authed();
		const store = useTrailsStore();
		store.upsertTrail(trail('t1'));
		vi.mocked(makeClientAPIRequest).mockResolvedValue(
			ok({
				week: '2026-W29',
				minutes: 15,
				target: 120,
				best: 15,
				sources: [],
				updated_at: 'x'
			}) as any
		);

		const { accept, completeStep } = useTrail('t1');
		accept({ when: 'x' });
		const res = await completeStep(0);

		expect(res.success).toBe(true);
		expect(store.getRun('t1')?.stepRevealed[0]).toBe(true);
		expect(makeClientAPIRequest).toHaveBeenCalled();
	});

	it('complete marks the run finished', () => {
		const store = useTrailsStore();
		store.upsertTrail(trail('t1'));
		const { accept, complete } = useTrail('t1');
		accept({ when: 'x' });
		complete();
		expect(store.getRun('t1')?.completed).toBe(true);
	});
});
