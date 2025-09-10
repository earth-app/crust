import { com } from '@earth-app/ocean';

export type User = {
	id: string;
	username: string;
	full_name?: string;
	created_at: Date;
	updated_at?: Date;
	last_login?: Date;
	account: {
		type: 'com.earthapp.account.Account';
		account_type: typeof com.earthapp.account.AccountType.prototype.name;
		id: string;
		first_name?: string;
		lastName?: string;
		username: string;
		bio?: string;
		email?: string;
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
		activities: {
			type: 'com.earthapp.activity.Activity';
			id: string;
			name: string;
			description?: string;
			activity_types: (typeof com.earthapp.activity.ActivityType.prototype.name)[];
			aliases: string[];
			fields: Record<string, string>;
		}[];
	};
};
