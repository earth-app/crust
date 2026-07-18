// shared contract for the admin Marketing studio (preview-only content emulation)

export type MarketingKind =
	'activity' | 'event' | 'prompt' | 'article' | 'user' | 'quest' | 'notification' | 'motd';

export type MarketingSource = 'manual' | 'live' | 'ai';

export const MARKETING_KINDS: MarketingKind[] = [
	'activity',
	'event',
	'prompt',
	'article',
	'user',
	'quest',
	'notification',
	'motd'
];

// a saved, reloadable mock scene for repeat marketing recordings
export interface MarketingScene<T = unknown> {
	id: string;
	name: string;
	description?: string;
	kind: MarketingKind;
	source: MarketingSource;
	payload: T;
	created_by: string;
	created_at: string;
	updated_at: string;
}

export interface MarketingSceneInput<T = unknown> {
	name: string;
	description?: string;
	kind: MarketingKind;
	source?: MarketingSource;
	payload: T;
}

// every studio panel accepts these so a headless/recording surface can drive it
export interface MarketingStudioProps<T = unknown> {
	scene?: MarketingScene<T> | null;
	displayOnly?: boolean;
}

// neutral envelope mirrored from the app's other composables (components own toasts)
export interface MarketingResult<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
}
