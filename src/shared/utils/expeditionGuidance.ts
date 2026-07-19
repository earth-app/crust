import type { ExpeditionGoal } from 'types/circles';

// #region types

export type ExpeditionGuidanceLevel = 'ambitious' | 'low' | 'ok';

export interface ExpeditionGuidance {
	level: ExpeditionGuidanceLevel;
	title: string; // Title Case, empty when level is 'ok'
	message: string; // sentence-case encouraging hint, empty when 'ok'
	icon: string;
	color: 'warning' | 'info';
}

export interface ExpeditionGuidanceInput {
	goal: ExpeditionGoal;
	target: number;
	// number of members in the circle (you + others); floored to at least 1
	circleSize: number;
	// expedition length; only scales the per-day goals
	days?: number;
}

// #region rates

interface GoalRate {
	// below circleSize * days? * minPerPersonPerDay -> gentle "aim higher" nudge
	minPerPersonPerDay: number;
	// a healthy stretch per person; 2x the circle's stretch total -> "ambitious" nudge
	stretchPerPersonPerDay: number;
	// nature_minutes is framed per-expedition (not per day); the others scale by days
	perDay: boolean;
}

// per-goal healthy/stretch framing. nature_minutes: ~120 min/person is healthy, ~180 a
// stretch. quests: ~5/day/person is the heavy-day ceiling. trails: ~1 finished trail per
// person per day is a healthy pace. tuned to be encouraging, never a hard rule.
const GOAL_RATES: Record<ExpeditionGoal, GoalRate> = {
	nature_minutes: { minPerPersonPerDay: 30, stretchPerPersonPerDay: 180, perDay: false },
	quests: { minPerPersonPerDay: 0.5, stretchPerPersonPerDay: 5, perDay: true },
	trails: { minPerPersonPerDay: 0.25, stretchPerPersonPerDay: 1.5, perDay: true }
};

// #region thresholds

// the two comparison points for a goal + circle; exported for tests and reuse
export function expeditionGuidanceThresholds(input: ExpeditionGuidanceInput): {
	lowBelow: number;
	ambitiousAt: number;
} {
	const size = Math.max(1, Math.floor(input.circleSize || 1));
	const rate = GOAL_RATES[input.goal] ?? GOAL_RATES.nature_minutes;
	const dayFactor = rate.perDay ? Math.max(1, Math.floor(input.days || 1)) : 1;

	const stretchTotal = size * dayFactor * rate.stretchPerPersonPerDay;
	return {
		lowBelow: size * dayFactor * rate.minPerPersonPerDay,
		ambitiousAt: 2 * stretchTotal
	};
}

// #region guidance

const OK: ExpeditionGuidance = { level: 'ok', title: '', message: '', icon: '', color: 'info' };

// fun, reinforcing, non-blocking guidance for the expedition target. returns an
// 'ok' (no nudge) when the target sits in a healthy band for the circle + goal.
export function expeditionGoalGuidance(input: ExpeditionGuidanceInput): ExpeditionGuidance {
	const target = Math.max(0, Number(input.target) || 0);
	if (target <= 0) return OK;

	const { lowBelow, ambitiousAt } = expeditionGuidanceThresholds(input);

	if (target >= ambitiousAt) {
		return {
			level: 'ambitious',
			title: 'This Looks Ambitious!',
			message:
				'That is a big shared goal for your circle. Set it if you want to push hard, or ease it a touch for a sure win together.',
			icon: 'mdi:rocket-launch-outline',
			color: 'warning'
		};
	}

	if (target < lowBelow) {
		return {
			level: 'low',
			title: 'You Can Do Better!',
			message:
				'Your circle can handle more than this. Nudge the goal up a little for something worth celebrating.',
			icon: 'mdi:arrow-up-bold-circle-outline',
			color: 'info'
		};
	}

	return OK;
}

// #endregion
