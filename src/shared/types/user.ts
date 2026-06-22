import { com } from '@earth-app/ocean';
import type { Activity } from './activity';

export const DEFAULT_FULL_NAME = 'John Doe';

export type OAuthProvider = 'google' | 'github' | 'microsoft' | 'discord' | 'facebook' | 'apple';
export type OAuthSource = 'web' | 'mobile';
export type OAuthContext = 'login' | 'signup' | 'link' | 'reauth';

export const OAUTH_PROVIDERS: OAuthProvider[] = [
	'google',
	'apple',
	'github',
	'microsoft',
	'discord'
	// 'facebook'
];

export type Rarity = 'normal' | 'rare' | 'amazing' | 'green';

export type AccountType = typeof com.earthapp.account.AccountType.prototype.name;
export type Visibility = typeof com.earthapp.Visibility.prototype.name;
export type Privacy = typeof com.earthapp.account.Privacy.prototype.name;

export type User = {
	id: string;
	username: string;
	full_name?: string;
	created_at: string;
	updated_at?: string;
	last_login?: string;
	is_admin: boolean;
	account: {
		account_type: AccountType;
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
		visibility: Visibility;
		field_privacy: {
			name: Privacy;
			bio: Privacy;
			phone_number: Privacy;
			country: Privacy;
			email: Privacy;
			address: Privacy;
			activities: Privacy;
			events: Privacy;
			friends: Privacy;
			last_login: Privacy;
			account_type: Privacy;
			impact_points: Privacy;
			badges: Privacy;
		};
	};
	disabled: boolean;
	email_change_pending?: string;
	message?: string;
	activities?: Activity[];
	is_friend: boolean;
	is_my_friend: boolean;
	is_mutual: boolean;
	is_blocking: boolean; // requester has blocked this user
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
	user?: User;
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

export type UserLeaderboardEntry = {
	id: string;
	streak: number;
	user: User;
};

export type LeaderboardScope = 'global' | 'friends' | 'circle';
export type LeaderboardMetric = 'points' | 'article' | 'prompt' | 'event';

export type LeaderboardEntry = {
	id: string;
	value: number;
	user: User;
	rank?: number;
};

export type ScopedLeaderboardResponse = {
	scope: LeaderboardScope;
	type: LeaderboardMetric;
	items: LeaderboardEntry[];
	total: number;
};

export type ReferralStats = {
	code: string;
	clicks: number;
	conversions: number;
	converted_ids: string[];
};

export type ImpactPointsChange = {
	reason: string;
	difference: number;
	timestamp?: number;
};

export type ChallengeStatus = 'pending' | 'active' | 'declined' | 'completed' | 'expired';

export type QuestChallenge = {
	id: string;
	quest_id: string;
	quest_title: string;
	challenger_id: string;
	challenger_name: string;
	recipient_id: string;
	recipient_name: string;
	status: ChallengeStatus;
	created_at: number;
	accepted_at?: number;
};

// the modal banner reads this; a null challenge means there's no challenge for this quest.
export type QuestChallengeView = {
	challenge: QuestChallenge | null;
	other_user: User | null;
	other_progress: { current_step: number; total_steps: number; completed: boolean } | null;
};

export type AvatarCosmetic = {
	key: string;
	price: number; // price after discount
	full_price: number; // original price before discount
	discount?: number; // percentage discount (e.g. 0.2 for 20% off)
	rarity: Rarity;
	animated?: boolean; // when true, clients apply a slow CSS rotation overlay
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
	// whether this step is only available on mobile; alternatives are normally provided
	mobile_only?: boolean;
	// optional short coaching hint surfaced for first-quest users
	tutorial_hint?: string;
};

export type QuestStepPosition = {
	index: number;
	altIndex?: number;
};

export type QuestTimelineStep = QuestStep &
	QuestStepPosition & {
		icon: string;
		completed: boolean;
		isCurrentQuest: boolean;
	};

export interface QuestStepContextProps {
	submit?: boolean;
	disabled?: boolean;
	questId?: string;
	questTitle?: string;
	questReward?: number;
}

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

export type ActiveReadTime = {
	stepIndex: number;
	altIndex?: number;
	tracker: 'articles_read_time' | 'activity_read_time';
	accumulatedSeconds: number;
	targetSeconds: number;
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
	activeReadTime?: ActiveReadTime[];
};
