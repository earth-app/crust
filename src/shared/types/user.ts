import { com } from '@earth-app/ocean';
import type { Activity } from './activity';

export const DEFAULT_FULL_NAME = 'John Doe';

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
		first_name?: string;
		last_name?: string;
		username: string;
		bio?: string;
		email?: string;
		email_verified?: boolean;
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
	friends?: string[];
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
