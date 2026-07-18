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
	// short, positive, censored note left for the next visitor
	note: string;
	created_at: string;
	// true when the current viewer has already thanked this note (client + server gate)
	thanked_by_me?: boolean;
	// private appreciation signal, only ever returned to the author (never a public tally)
	thanks_for_author?: number;
}

export interface TrailmarkCreateInput {
	geo: TrailmarkGeo;
	note: string;
}

export interface TrailmarkQuery {
	lat: number;
	lng: number;
	// search radius in meters (default ~500, capped)
	radius?: number;
}

export interface TrailmarkResult<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
	alreadyThanked?: boolean;
}
