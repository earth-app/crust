export type ExpeditionGoal = 'nature_minutes' | 'trails' | 'quests';
export type ExpeditionStatus = 'active' | 'complete' | 'expired';

// per-member contribution to the shared goal; shown as contribution, never as a rank
export interface ExpeditionContributor {
	uid: string;
	username: string;
	contribution: number;
	last_contributed_at?: string;
}

export interface Expedition {
	id: string;
	// the owning circle, keyed by the owner uid (mantle2 circle graph)
	owner_uid: string;
	title: string;
	goal: ExpeditionGoal;
	target: number;
	progress: number;
	contributors: ExpeditionContributor[];
	status: ExpeditionStatus;
	starts_at: string;
	ends_at: string;
}

// fixed, warm, non-comparative encouragement set; no free text, no tally exposed
export type KudosPhrase =
	'nice_find' | 'go_you' | 'keep_going' | 'inspiring' | 'welcome_back' | 'trailblazer';

export type KudosContextType = 'quest' | 'trail' | 'journey' | 'expedition' | 'trailmark';

// giver-benefit interaction: the sender chooses to send (volition), it names a real
// action (impact), it goes to a real person (connection); recipient gets a warm,
// private, non-numeric acknowledgment
export interface Kudos {
	id: string;
	from_uid: string;
	to_uid: string;
	context_type: KudosContextType;
	context_ref?: string;
	phrase: KudosPhrase;
	created_at: string;
}

// the shared garden is a projection of the circle's combined outdoor contribution;
// data here drives a Canvas/WebGL scene (crust) — the numbers grow the garden, they
// are not shown as a scoreboard
export type GardenElementKind = 'tree' | 'flower' | 'water' | 'stone' | 'creature' | 'star';

export interface GardenElement {
	kind: GardenElementKind;
	// deterministic seed so the same contribution grows the same element
	seed: number;
	// 0..1 growth for animated bloom
	growth: number;
	contributor_uid?: string;
}

export interface CircleGarden {
	owner_uid: string;
	// overall growth level derived from total contribution
	level: number;
	total_minutes: number;
	elements: GardenElement[];
	// perk: animated variants unlock on paid rank; free gardens still grow, just calmer
	animated: boolean;
	updated_at: string;
}

export interface CircleResult<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
	alreadySent?: boolean;
}

export type GardenSeason = 'spring' | 'summer' | 'autumn' | 'winter';
export type GardenTimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

export interface GardenRenderConfig {
	season?: GardenSeason;
	timeOfDay?: GardenTimeOfDay;
	// 0..1 lunar phase (0/1 new, 0.5 full); omitted -> derived from the date
	moonPhase?: number;
	// optional viewer latitude for hemisphere-correct seasons (south flips)
	latitude?: number;
}
