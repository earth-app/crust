import type { QuestStep } from './user';

export type TrailTheme = 'nature' | 'curiosity' | 'creative' | 'mixed';
export type TrailRarity = 'normal' | 'rare' | 'amazing' | 'green';

// captured on accept; the strongest behavior lever (if-then implementation intention)
export interface TrailPledge {
	when: string;
	where?: string;
}

export interface TrailStep {
	// underlying quest action (take_photo_location, distance_covered, etc.)
	step: QuestStep;
	// the curiosity gap shown before acting (what pulls the user out)
	clue: string;
	// the awe payoff revealed on completion (a fact, a piece of wonder)
	reveal: string;
}

export interface Trail {
	id: string;
	title: string;
	theme: TrailTheme;
	description: string;
	icon: string;
	rarity: TrailRarity;
	steps: TrailStep[];
	reward: number;
	// perk: premium/seasonal trails gate on paid rank (free users still get the core set)
	premium?: boolean;
	seasonal?: boolean;
}

// a user's live run of a trail; mirrors the quest-progress model
export interface TrailProgress {
	trailId: string;
	currentStep: number;
	completed: boolean;
	pledge?: TrailPledge;
	startedAt: string;
	stepRevealed: boolean[];
}

// personal weekly nature-minutes ring (~120 min/week target; non-competitive, personal-best)
export interface NatureMinutes {
	week: string;
	minutes: number;
	target: number;
	best: number;
	sources: NatureMinutesSource[];
	updated_at: string;
}

export interface NatureMinutesSource {
	kind: 'trail_step' | 'quest' | 'healthkit' | 'manual';
	ref_id?: string;
	minutes: number;
	at: string;
}

export interface TrailResult<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
}
