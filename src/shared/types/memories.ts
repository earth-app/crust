export type MemoryKind = 'quest' | 'trail';

/** One thing the user did on this month/day in an earlier year. */
export interface Memory {
	kind: MemoryKind;
	id: string;
	title: string;
	icon?: string;
	completedAt: number;
	yearsAgo: number;
	// the quest kept a photo; it is served by the existing quest history endpoint
	photo?: boolean;
	note?: string;
	mood?: string;
}
