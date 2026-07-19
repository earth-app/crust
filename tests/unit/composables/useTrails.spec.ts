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
		practice: 'sit_spot',
		description: 'A quiet sit.',
		icon: 'mdi:leaf',
		rarity: 'normal',
		curiosity: 'What settles when you do?',
		duration: 12,
		reflectionPrompt: 'What did you notice?',
		reveal: 'A small wonder.',
		...extra
	} as Trail;
}

const ok = <T>(data: T) => ({ success: true as const, data });

function authed() {
	const auth = useAuthStore();
	auth.setSessionToken('token');
	auth.currentUser = { id: 'u1' } as any;
}

// the weekly-reflection bucket is shared useState + localStorage; reset it per test so
// the recordCuriosity side-effect from complete() is observed cleanly
function resetWeekly() {
	window.localStorage.clear();
	useState<number>('weekly-reflection-quests', () => 0).value = 0;
	useState<number>('weekly-reflection-curiosity', () => 0).value = 0;
	useState<string | null>('weekly-reflection-week', () => null).value = null;
}

beforeEach(() => {
	setActivePinia(createPinia());
	vi.clearAllMocks();
	resetWeekly();
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

	it('fetchJournal requires a signed-in user', async () => {
		const { fetchJournal } = useTrails();
		const res = await fetchJournal();
		expect(res.success).toBe(false);
		expect(res.error).toMatch(/signed in/i);
		expect(makeAPIRequest).not.toHaveBeenCalled();
	});

	it('fetchJournal returns the journal when authed', async () => {
		authed();
		vi.mocked(makeAPIRequest).mockResolvedValue(
			ok([
				{
					trailId: 't1',
					title: 'Trail t1',
					practice: 'sit_spot',
					presenceMinutes: 10,
					completedAt: new Date().toISOString(),
					reflection: { at: new Date().toISOString() }
				}
			]) as any
		);
		const { fetchJournal, journal } = useTrails();
		const res = await fetchJournal();
		expect(res.success).toBe(true);
		expect(res.data?.length).toBe(1);
		expect(journal.value.length).toBe(1);
	});
});

describe('useTrail', () => {
	it('exposes the trail as a three-state computed', () => {
		const store = useTrailsStore();
		store.upsertTrail(trail('t1'));
		const { trail: t } = useTrail('t1');
		expect(t.value?.id).toBe('t1');
	});

	it('start rejects a pledge with no trigger', async () => {
		const store = useTrailsStore();
		store.upsertTrail(trail('t1'));
		const { start } = useTrail('t1');
		const res = await start({ when: '   ' });
		expect(res.success).toBe(false);
		expect(res.error).toMatch(/when/i);
		expect(store.getRun('t1')).toBeUndefined();
	});

	it('start fails when the trail is not loaded', async () => {
		const store = useTrailsStore();
		store.cache.set('missing', null);
		const { start } = useTrail('missing');
		const res = await start();
		expect(res.success).toBe(false);
		expect(res.error).toMatch(/not loaded/i);
	});

	it('start captures a valid pledge and opens the run', async () => {
		const store = useTrailsStore();
		store.upsertTrail(trail('t1'));
		vi.mocked(makeClientAPIRequest).mockResolvedValue(ok(undefined) as any);
		const { start, run } = useTrail('t1');
		const res = await start({ when: 'after breakfast', where: 'the park' });
		expect(res.success).toBe(true);
		expect(res.data?.pledge?.where).toBe('the park');
		expect(run.value?.pledge?.when).toBe('after breakfast');
		expect(makeClientAPIRequest).toHaveBeenCalled();
	});

	it('start allows an empty pledge (no if-then trigger required)', async () => {
		const store = useTrailsStore();
		store.upsertTrail(trail('t1'));
		vi.mocked(makeClientAPIRequest).mockResolvedValue(ok(undefined) as any);
		const { start, run } = useTrail('t1');
		const res = await start();
		expect(res.success).toBe(true);
		expect(run.value?.trailId).toBe('t1');
	});

	it('addPresence delegates to the store run', async () => {
		const store = useTrailsStore();
		store.upsertTrail(trail('t1'));
		vi.mocked(makeClientAPIRequest).mockResolvedValue(ok(undefined) as any);
		const { start, addPresence, run } = useTrail('t1');
		await start();
		addPresence(12);
		expect(run.value?.presenceMinutes).toBe(12);
	});

	it('complete finishes the run, records a moment of curiosity, and returns the entry', async () => {
		authed();
		const store = useTrailsStore();
		store.upsertTrail(trail('t1'));
		// start + complete both hit the client wire; no server echo -> optimistic fallback
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true } as any);
		const { start, complete } = useTrail('t1');
		await start({ when: 'after breakfast' });
		const res = await complete({ at: new Date().toISOString(), note: 'peaceful' }, 15);
		expect(res.success).toBe(true);
		expect(res.data?.trailId).toBe('t1');
		expect(store.getRun('t1')?.completed).toBe(true);
		// a finished trail is a moment of wonder (recordCuriosity), never a quest
		expect(useWeeklyReflection().curiosityTouched.value).toBe(1);
		expect(useWeeklyReflection().questsDone.value).toBe(0);
	});

	it('reset clears the active run', async () => {
		const store = useTrailsStore();
		store.upsertTrail(trail('t1'));
		vi.mocked(makeClientAPIRequest).mockResolvedValue(ok(undefined) as any);
		const { start, reset, run } = useTrail('t1');
		await start();
		expect(run.value).toBeTruthy();
		reset();
		expect(run.value).toBeUndefined();
	});
});
