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

export type User = {
	id: string;
	username: string;
	full_name?: string;
	created_at: string;
	updated_at?: string;
	last_login?: string;
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
		};
	};
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
	rarity: 'normal' | 'rare' | 'amazing' | 'green';
	tracker_id?: string;
};

export type UserBadge = Badge & {
	user_id: string;
	granted: boolean;
	granted_at?: string;
	progress: number;
};
