// qualitative, sustained practices — one thing, done slowly, for its own sake
export type TrailPractice =
	| 'sit_spot' // sit still in one place and notice
	| 'photo_series' // a short series of photos on one theme
	| 'sound_map' // eyes closed, map the sounds around you
	| 'slow_look' // observe one natural thing closely
	| 'sky_watch' // watch the sky, clouds, or stars
	| 'wander' // a slow, aimless noticing walk
	| 'texture' // touch and feel natural textures
	| 'water_sit'; // spend unhurried time beside water

export type TrailTheme = 'nature' | 'curiosity' | 'creative' | 'reflective' | 'mixed';
export type TrailRarity = 'normal' | 'rare' | 'amazing' | 'green';

// how the practice felt afterwards; self-referential, never compared to anyone
export type TrailMood = 'calm' | 'curious' | 'awed' | 'grateful' | 'refreshed' | 'unsettled';

export const TRAIL_PRACTICES: TrailPractice[] = [
	'sit_spot',
	'photo_series',
	'sound_map',
	'slow_look',
	'sky_watch',
	'wander',
	'texture',
	'water_sit'
];

export const TRAIL_MOODS: TrailMood[] = [
	'calm',
	'curious',
	'awed',
	'grateful',
	'refreshed',
	'unsettled'
];

// captured on accept; the strongest behavior lever (if-then implementation intention)
export interface TrailPledge {
	when: string;
	where?: string;
}

export interface Trail {
	id: string;
	title: string;
	theme: TrailTheme;
	// the sustained practice this trail invites (there are no ordered steps)
	practice: TrailPractice;
	description: string;
	icon: string;
	rarity: TrailRarity;
	// the curiosity gap shown before going out (what pulls you outside)
	curiosity: string;
	// suggested minutes of unhurried presence (a gentle target, never enforced)
	duration: number;
	// the reflective question posed on return (self-expression, self-monitoring)
	reflectionPrompt: string;
	// the awe payoff revealed on completion (a fact, a piece of wonder)
	reveal: string;
	// perk: premium/seasonal trails gate on paid rank (free users still get the core set)
	premium?: boolean;
	seasonal?: boolean;
	// cloud-authored presentation metadata, embedded on every trail the api returns
	practiceMeta?: TrailPracticeMeta;
}

// presentation metadata for a practice; authored in cloud (src/user/trails.ts) and delivered
// embedded as trail.practiceMeta. crust keeps a fallback map + a cache filled from the response
export interface TrailPracticeMeta {
	practice: TrailPractice;
	label: string; // Title Case name
	icon: string;
	// the single verb of the practice (present tense), for the presence screen
	verb: string;
	// calm one-line invitation shown while out there
	cue: string;
	// gentle default minutes if a trail does not set its own
	defaultMinutes: number;
	// whether the practice naturally involves a short series of photos
	photos: boolean;
}

// a private reflection saved to the journal after a trail practice
export interface TrailReflection {
	note?: string;
	mood?: TrailMood;
	// how many photos were taken during the practice (the photos stay on-device)
	photoCount?: number;
	// the user chose to grow their shared garden with this practice (never public)
	sharedToGarden?: boolean;
	at: string;
}

// a user's live run of a trail: unhurried presence + a private reflection (no step model)
export interface TrailRun {
	trailId: string;
	pledge?: TrailPledge;
	startedAt: string;
	// accumulated unhurried minutes of presence
	presenceMinutes: number;
	completed: boolean;
	reflection?: TrailReflection;
}

// one journal entry = a completed run, kept private to the user
export interface TrailJournalEntry {
	trailId: string;
	title: string;
	practice: TrailPractice;
	presenceMinutes: number;
	reflection: TrailReflection;
	completedAt: string;
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
	kind: 'trail' | 'quest' | 'healthkit' | 'manual';
	ref_id?: string;
	minutes: number;
	at: string;
}

export interface TrailResult<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
	// set when the catalog / run gate rejects a free user on a premium or seasonal trail
	paymentRequired?: boolean;
}
