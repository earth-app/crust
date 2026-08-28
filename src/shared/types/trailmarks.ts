export interface TrailmarkGeo {
	lat: number;
	lng: number;
	place_label?: string;
}

export interface Trailmark {
	id: string;
	author_uid: string;
	author_username: string;
	geo: TrailmarkGeo;
	// short, positive, censored + sentiment-checked note left for the next visitor
	note: string;
	created_at: string;
	// true when the current viewer has already thanked this note (client + server gate)
	thanked_by_me?: boolean;
	// private appreciation signal, only ever returned to the author (never a public tally)
	thanks_for_author?: number;
	// set when this note was left as an answer to a daily prompt (surfaces on the prompt)
	prompt_id?: string;
	// the activity the author was doing here
	activity_id?: string;
	// true when the viewer's own activities include activity_id (server-computed, per viewer)
	shared_activity?: boolean;
}

export interface TrailmarkCreateInput {
	geo: TrailmarkGeo;
	note: string;
	// optional: also surface this note under today's prompt as a 'from outside' response
	prompt_id?: string;
	// optional: the activity this note came out of
	activity_id?: string;
}

export interface TrailmarkQuery {
	lat: number;
	lng: number;
	// search radius in meters (default ~500, capped)
	radius?: number;
	// only notes left while doing this activity
	activity?: string;
	// only notes whose activity the viewer also does
	shared?: boolean;
}

export interface TrailmarkResult<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
	alreadyThanked?: boolean;
}
