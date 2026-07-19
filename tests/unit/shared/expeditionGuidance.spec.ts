import { describe, expect, it } from 'vitest';
import {
	expeditionGoalGuidance,
	expeditionGuidanceThresholds
} from '~/shared/utils/expeditionGuidance';

describe('expeditionGuidanceThresholds', () => {
	it('nature_minutes is framed per-expedition (days do not scale it)', () => {
		// size 5 -> ambitious at 2 * 5 * 180 = 1800, low below 5 * 30 = 150
		const a = expeditionGuidanceThresholds({ goal: 'nature_minutes', target: 0, circleSize: 5 });
		expect(a).toEqual({ lowBelow: 150, ambitiousAt: 1800 });
		// changing days must not move the nature_minutes thresholds
		const b = expeditionGuidanceThresholds({
			goal: 'nature_minutes',
			target: 0,
			circleSize: 5,
			days: 30
		});
		expect(b).toEqual(a);
	});

	it('quests scales by both circle size and days', () => {
		// size 3, days 7 -> ambitious at 2 * 3 * 7 * 5 = 210, low below 3 * 7 * 0.5 = 10.5
		expect(
			expeditionGuidanceThresholds({ goal: 'quests', target: 0, circleSize: 3, days: 7 })
		).toEqual({ lowBelow: 10.5, ambitiousAt: 210 });
	});

	it('trails scales by both circle size and days', () => {
		// size 2, days 5 -> ambitious at 2 * 2 * 5 * 1.5 = 30, low below 2 * 5 * 0.25 = 2.5
		expect(
			expeditionGuidanceThresholds({ goal: 'trails', target: 0, circleSize: 2, days: 5 })
		).toEqual({ lowBelow: 2.5, ambitiousAt: 30 });
	});

	it('floors circle size and days to at least 1', () => {
		expect(
			expeditionGuidanceThresholds({ goal: 'quests', target: 0, circleSize: 0, days: 0 })
		).toEqual(
			// size 1, days 1 -> ambitious 2*1*1*5 = 10, low below 1*1*0.5 = 0.5
			{ lowBelow: 0.5, ambitiousAt: 10 }
		);
	});
});

describe('expeditionGoalGuidance', () => {
	it('warns ambitious at or above 2x the circle stretch', () => {
		const g = expeditionGoalGuidance({ goal: 'nature_minutes', target: 1800, circleSize: 5 });
		expect(g.level).toBe('ambitious');
		expect(g.title).toBe('This Looks Ambitious!');
		expect(g.color).toBe('warning');
		expect(g.message.length).toBeGreaterThan(0);
	});

	it('nudges up when the target is below the low threshold', () => {
		const g = expeditionGoalGuidance({ goal: 'nature_minutes', target: 100, circleSize: 5 });
		expect(g.level).toBe('low');
		expect(g.title).toBe('You Can Do Better!');
		expect(g.color).toBe('info');
	});

	it('stays quiet inside the healthy band', () => {
		// size 5 nature: healthy band is [150, 1800)
		const g = expeditionGoalGuidance({ goal: 'nature_minutes', target: 600, circleSize: 5 });
		expect(g.level).toBe('ok');
		expect(g.title).toBe('');
		expect(g.message).toBe('');
	});

	it('treats a zero/blank target as ok (nothing entered yet)', () => {
		expect(expeditionGoalGuidance({ goal: 'quests', target: 0, circleSize: 4 }).level).toBe('ok');
		expect(
			expeditionGoalGuidance({ goal: 'quests', target: Number.NaN, circleSize: 4 }).level
		).toBe('ok');
	});

	it('per-goal thresholds move the verdict for the same target', () => {
		// size 3, days 7 -> quests ambitiousAt 210, low 10.5
		expect(
			expeditionGoalGuidance({ goal: 'quests', target: 240, circleSize: 3, days: 7 }).level
		).toBe('ambitious');
		expect(
			expeditionGoalGuidance({ goal: 'quests', target: 5, circleSize: 3, days: 7 }).level
		).toBe('low');
		// trails is a much smaller-numbered goal: size 3, days 7 -> ambitiousAt 63, low 5.25
		expect(
			expeditionGoalGuidance({ goal: 'trails', target: 80, circleSize: 3, days: 7 }).level
		).toBe('ambitious');
		expect(
			expeditionGoalGuidance({ goal: 'trails', target: 3, circleSize: 3, days: 7 }).level
		).toBe('low');
	});

	it('a big solo target reads as ambitious with a default circle of one', () => {
		// default circleSize 1 nature -> ambitiousAt 360; the form default 600 trips it
		expect(
			expeditionGoalGuidance({ goal: 'nature_minutes', target: 600, circleSize: 1 }).level
		).toBe('ambitious');
	});
});
