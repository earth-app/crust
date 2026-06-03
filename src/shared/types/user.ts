import { com } from '@earth-app/ocean';
import type { Activity } from './activity';

export const DEFAULT_FULL_NAME = 'John Doe';

export type OAuthProvider = 'google' | 'github' | 'microsoft' | 'discord' | 'facebook' | 'apple';
export type OAuthSource = 'web' | 'mobile';
export type OAuthContext = 'login' | 'signup' | 'link';

export const OAUTH_PROVIDERS: OAuthProvider[] = [
	'google',
	'apple',
	'github',
	'microsoft',
	'discord'
	// 'facebook'
];

export type Rarity = 'normal' | 'rare' | 'amazing' | 'green';

export type User = {
	id: string;
	username: string;
	full_name?: string;
	created_at: string;
	updated_at?: string;
	last_login?: string;
	is_admin: boolean;
	account: {
		account_type: typeof com.earthapp.account.AccountType.prototype.name;
		id: string;
		avatar_url: string;
		first_name?: string;
		last_name?: string;
		username: string;
		bio?: string;
		email?: string;
		email_verified?: boolean;
		has_password?: boolean;
		linked_providers: OAuthProvider[];
		subscribed?: boolean;
		address?: string;
		country?: string;
		phone_number?: number;
		visibility: typeof com.earthapp.Visibility.prototype.name;
		field_privacy: {
			name: typeof com.earthapp.account.Privacy.prototype.name;
			bio: typeof com.earthapp.account.Privacy.prototype.name;
			phone_number: typeof com.earthapp.account.Privacy.prototype.name;
			country: typeof com.earthapp.account.Privacy.prototype.name;
			email: typeof com.earthapp.account.Privacy.prototype.name;
			address: typeof com.earthapp.account.Privacy.prototype.name;
			activities: typeof com.earthapp.account.Privacy.prototype.name;
			events: typeof com.earthapp.account.Privacy.prototype.name;
			friends: typeof com.earthapp.account.Privacy.prototype.name;
			last_login: typeof com.earthapp.account.Privacy.prototype.name;
			account_type: typeof com.earthapp.account.Privacy.prototype.name;
			impact_points: typeof com.earthapp.account.Privacy.prototype.name;
			badges: typeof com.earthapp.account.Privacy.prototype.name;
		};
	};
	disabled: boolean;
	email_change_pending?: string;
	message?: string;
	activities?: Activity[];
	is_friend: boolean;
	is_my_friend: boolean;
	is_mutual: boolean;
	friends?: string[];
	added_count?: number;
	mutual_count: number; // always public
	non_mutual_count?: number;
	is_in_circle: boolean;
	is_in_my_circle: boolean;
	circle?: string[];
	circle_count?: number;
	max_circle_count?: number;
};

export type LoginResponse = {
	id: string;
	username: string;
	session_token: string;
};

export type LoginVerificationRequired = {
	requires_verification: true;
	ticket: string;
	email: string;
	expires_in: number;
	message?: string;
};

export type UserNotification = {
	id: string;
	title: string;
	user_id: string;
	message: string;
	link?: string;
	type: 'info' | 'warning' | 'error' | 'success';
	source: string;
	read: boolean;
	created_at: number;
};

export type Badge = {
	id: string;
	name: string;
	description: string;
	icon: string;
	rarity: Rarity;
	tracker_id?: string;
	mastered?: boolean;
	mastered_at?: string | null;
	mastery_exempt?: boolean;
};

export type UserBadge = Badge & {
	user_id: string;
	granted: boolean;
	granted_at?: string;
	progress: number;
};

export type BadgeMasteryStatus = {
	generated: boolean;
	locked: boolean;
	mastered: boolean;
	mastered_at: string | null;
	exempt?: boolean;
	quest: Quest | null;
};

export type BadgeMasteryError =
	| 'locked'
	| 'conflict'
	| 'ai_failed'
	| 'exempt'
	| 'cap_reached'
	| 'unknown';

export type MasteryListItem = {
	badge_id: string;
	quest: Quest;
	generated_at: number;
	expires_at: number;
	mastered: boolean;
	mastered_at: number | null;
};

export type MasteryList = {
	cap: number;
	active: number;
	ttl_seconds: number;
	items: MasteryListItem[];
};

export class BadgeMasteryGenerationError extends Error {
	readonly code: BadgeMasteryError;
	readonly httpStatus?: number;

	constructor(code: BadgeMasteryError, message: string, httpStatus?: number) {
		super(message);
		this.name = 'BadgeMasteryGenerationError';
		this.code = code;
		this.httpStatus = httpStatus;
	}
}

export type UserJourneyLeaderboardEntry = {
	id: string;
	streak: number;
	user: User;
};

export type ImpactPointsChange = {
	reason: string;
	difference: number;
	timestamp?: number;
};

export type AvatarCosmetic = {
	key: string;
	price: number; // price after discount
	full_price: number; // original price before discount
	discount?: number; // percentage discount (e.g. 0.2 for 20% off)
	rarity: Rarity;
};

export type QuestPermission = 'camera' | 'location' | 'record';

export type Quest = {
	id: string;
	title: string;
	description: string;
	icon: string;
	rarity: Rarity;
	mobile_only?: boolean; // whether the whole quest can only be started/completed on a mobile device
	steps: (QuestStep | QuestStep[])[]; // single step (required) or alternative steps (user can complete any one of them)
	reward: number;
	premium?: boolean;
	permissions?: QuestPermission[]; // e.g. ['camera', 'location']
};

// Mirrors cloud's quest step `type` union (see earth-app/cloud src/user/quests/index.ts).
// `distance_covered` and `scan_barcode` are always mobile-only and handled by the mobile app.
export type QuestStepType =
	| 'take_photo_location'
	| 'take_photo_classification'
	| 'take_photo_objects'
	| 'take_photo_caption'
	| 'take_photo_validation'
	| 'take_photo_list'
	| 'article_quiz'
	| 'draw_picture'
	| 'attend_event'
	| 'respond_to_prompt'
	| 'article_read_time'
	| 'activity_read_time'
	| 'transcribe_audio'
	| 'match_terms'
	| 'order_items'
	| 'describe_text'
	| 'submit_event_image'
	| 'distance_covered'
	| 'scan_barcode';

export type QuestStep = {
	type: QuestStepType;
	description: string;
	parameters: any[];
	reward?: number;
	delay?: number; // delay in seconds before this step can be completed after the previous one
	// whether this step is only available on mobile; alternatives are normally provided so
	// desktop users can still progress. The submission interface is blocked here when true.
	mobile_only?: boolean;
	// optional short coaching hint surfaced for first-quest users. Cloud may also emit a
	// generic auto-hint when this field is unset; client should treat empty/whitespace as missing.
	tutorial_hint?: string;
};

export type QuestStepMigrationReason =
	| 'type_changed'
	| 'params_changed'
	| 'step_removed'
	| 'alt_removed'
	| 'quest_deleted';

export type QuestStepMigrationInfo = {
	from: QuestStepType; // old step type at this position
	at: number; // unix ms when the migration ran
	reason: QuestStepMigrationReason;
};

export type QuestMigrationSignal = {
	stepIndex: number;
	altIndex?: number;
	action: 'cancel_distance_tracking';
	questId: string;
};

export type QuestProgressEntry = {
	type: string;
	index?: number; // which one was completed
	altIndex?: number; // if it was an alternative step, which one
	submittedAt: number; // unix ms timestamp
	data?: string; // data url for completed photo/audio steps
	// type-specific data
	r2Key?: string; // for photo and audio uploads
	score?: number; // both activity quiz steps / validation score for photos & audio
	prompt?: string; // for photo caption steps
	lat?: number; // for location steps
	lng?: number; // for location steps
	eventId?: string; // for event attendance steps
	timestamp?: number; // for event attendance steps (timestamp of attendance)
	scoreKey?: string; // for activity quiz steps
	// when present this entry is a migration placeholder; original submission data is gone
	migrated?: QuestStepMigrationInfo;
};

export type QuestHistoryEntry = {
	quest: Quest;
	questId: Quest['id'];
	completedAt: number;
	progress?: (QuestProgressEntry | QuestProgressEntry[])[];
};

export type UserQuestProgress = {
	quest: Quest;
	questId: Quest['id'];
	currentStep: QuestStep;
	currentStepIndex: number;
	completed: boolean;
	progress: (QuestProgressEntry | QuestProgressEntry[])[];
	migrationSignals?: QuestMigrationSignal[];
	migrated?: boolean;
};
