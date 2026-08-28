export type PlanCueKind = 'time_place' | 'juncture';

export interface PlanCue {
	id: string;
	kind: PlanCueKind;
	text: string;
	place?: string;
}

export interface PlanResponse {
	id: string;
	text: string;
	activity_id?: string;
}

export interface PlanMenu {
	goal: string;
	cues: PlanCue[];
	responses: PlanResponse[];
}

/** Returned exactly once, on formation; there is no endpoint that hands it back. */
export interface PlanFormed {
	sentence: string;
	expires_at: number;
}

export interface PlanStatus {
	active: boolean;
	expires_at?: number | null;
	rehearsed?: boolean | null;
}
