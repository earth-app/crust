import { com } from '@earth-app/ocean';
import type { Activity } from './activity';

export const DEFAULT_FULL_NAME = 'John Doe';

export type OAuthProvider = 'google' | 'github' | 'microsoft' | 'discord' | 'facebook';
export const OAUTH_PROVIDERS: OAuthProvider[] = [
	'google',
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
};

export type UserBadge = Badge & {
	user_id: string;
	granted: boolean;
	granted_at?: string;
	progress: number;
};

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

export type Quest = {
	id: string;
	title: string;
	description: string;
	icon: string;
	rarity: Rarity;
	mobile_only?: boolean;
	steps: (QuestStep | QuestStep[])[]; // single step (required) or alternative steps (user can complete any one of them)
	reward: number;
	premium?: boolean;
	permissions: ('camera' | 'location' | 'record')[]; // e.g. ['camera', 'location']
};

export type QuestStep = {
	type: string;
	description: string;
	parameters: any[];
	reward?: number;
	delay?: number; // delay in seconds before this step can be completed after the previous one
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
};

export type QuestHistoryEntry = {
	quest: Quest;
	questId: Quest['id'];
	completedAt: number;
	progress: (QuestProgressEntry | QuestProgressEntry[])[]; // you can do multiple alternative steps
};

export type UserQuestProgress = {
	quest: Quest;
	questId: Quest['id'];
	currentStep: QuestStep;
	currentStepIndex: number;
	completed: boolean;
	progress: (QuestProgressEntry | QuestProgressEntry[])[];
};
