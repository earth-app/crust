import { createPinia, setActivePinia } from 'pinia';
import { useTrailsStore } from 'stores/trails';
import type { NatureMinutes, NatureMinutesSource } from 'types/trails';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isoWeekKey, useWeeklyReflection } from '~/composables/useWeeklyReflection';

// calm, finite "Your Week" self-monitoring reflection. minutes-outside come from
// the trails store; quests/curiosity from a per-week localStorage bucket. no e2e
// drives the bucket math, week rollover, or the server-derived wonder floor.

function resetState() {
	useState<number>('weekly-reflection-quests', () => 0).value = 0;
	useState<number>('weekly-reflection-curiosity', () => 0).value = 0;
	useState<string | null>('weekly-reflection-week', () => null).value = null;
}

function nature(minutes: number, sources: NatureMinutesSource[] = []): NatureMinutes {
	return {
		week: isoWeekKey(),
		minutes,
		target: 120,
		best: minutes,
		sources,
		updated_at: new Date().toISOString()
	};
}

beforeEach(() => {
	window.localStorage.clear();
	setActivePinia(createPinia());
	resetState();
});

describe('isoWeekKey', () => {
	it('produces a stable YYYY-Www key', () => {
		expect(isoWeekKey(new Date('2026-07-18T12:00:00Z'))).toMatch(/^2026-W\d{2}$/);
		// same iso week for two days inside it
		expect(isoWeekKey(new Date('2026-07-13T00:00:00Z'))).toBe(
			isoWeekKey(new Date('2026-07-19T00:00:00Z'))
		);
	});
});

describe('useWeeklyReflection', () => {
	it('starts empty with a fresh-week summary', () => {
		const r = useWeeklyReflection();
		expect(r.minutesOutside.value).toBe(0);
		expect(r.questsDone.value).toBe(0);
		expect(r.curiosityTouched.value).toBe(0);
		expect(r.hasActivity.value).toBe(false);
		expect(r.summaryLine.value).toContain('A fresh week is open');
	});

	it('reads minutes outside from the trails store', () => {
		useTrailsStore().natureMinutes = nature(40);
		const r = useWeeklyReflection();
		expect(r.minutesOutside.value).toBe(40);
		expect(r.hasActivity.value).toBe(true);
		expect(r.summaryLine.value).toBe(
			'You spent 40 minutes outside this week. That time was yours.'
		);
	});

	it('records quests and curiosity and persists the bucket', () => {
		const r = useWeeklyReflection();
		r.recordQuestDone(1);
		r.recordCuriosity(2);
		expect(r.questsDone.value).toBe(1);
		expect(r.curiosityTouched.value).toBe(2);

		const raw = window.localStorage.getItem(`weekly_reflection:${r.weekKey.value}`);
		const bucket = JSON.parse(raw!);
		expect(bucket.questsDone).toBe(1);
		expect(bucket.curiosityTouched).toBe(2);
	});

	it('ignores non-positive records', () => {
		const r = useWeeklyReflection();
		r.recordQuestDone(0);
		r.recordCuriosity(-4);
		expect(r.questsDone.value).toBe(0);
		expect(r.curiosityTouched.value).toBe(0);
	});

	it('takes the higher of the bucket and the server-derived trail-step floor', () => {
		const sources: NatureMinutesSource[] = [
			{ kind: 'trail_step', minutes: 15, at: new Date().toISOString() },
			{ kind: 'trail_step', minutes: 15, at: new Date().toISOString() },
			{ kind: 'quest', minutes: 20, at: new Date().toISOString() }
		];
		useTrailsStore().natureMinutes = nature(0, sources);
		const r = useWeeklyReflection();
		// two trail_step sources -> wonder floor of 2, even with an empty bucket
		expect(r.curiosityTouched.value).toBe(2);
		expect(r.summaryLine.value).toBe('You showed up for your curiosity this week. That counts.');

		r.recordCuriosity(5); // bucket now exceeds the floor
		expect(r.curiosityTouched.value).toBe(5);
	});

	it('refresh re-reads the persisted bucket', () => {
		const first = useWeeklyReflection();
		first.recordQuestDone(3);
		resetState();
		const second = useWeeklyReflection();
		second.refresh();
		expect(second.questsDone.value).toBe(3);
	});

	it('reset clears the week bucket', () => {
		const r = useWeeklyReflection();
		r.recordQuestDone(2);
		r.reset();
		expect(r.questsDone.value).toBe(0);
		expect(r.curiosityTouched.value).toBe(0);
	});

	it('treats corrupt bucket storage as empty', () => {
		const wk = isoWeekKey();
		window.localStorage.setItem(`weekly_reflection:${wk}`, 'not-json{');
		resetState();
		const r = useWeeklyReflection();
		expect(r.questsDone.value).toBe(0);
	});

	it('buckets records by ISO week', () => {
		vi.useFakeTimers();
		try {
			vi.setSystemTime(new Date('2026-07-13T10:00:00Z'));
			const wk1 = isoWeekKey();
			useWeeklyReflection().recordQuestDone(2);
			expect(JSON.parse(window.localStorage.getItem(`weekly_reflection:${wk1}`)!).questsDone).toBe(
				2
			);

			// jump two weeks -> a fresh, empty bucket
			vi.setSystemTime(new Date('2026-07-27T10:00:00Z'));
			resetState();
			const r2 = useWeeklyReflection();
			expect(r2.questsDone.value).toBe(0);
			expect(r2.weekKey.value).not.toBe(wk1);
		} finally {
			vi.useRealTimers();
		}
	});

	it('marks itself as a finite surface', () => {
		expect(useWeeklyReflection().isFinite).toBe(true);
	});
});
