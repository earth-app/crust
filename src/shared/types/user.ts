import { com } from '@earth-app/ocean';

export type User = {
	id: string;
	username: string;
	fullName?: string;
	created_at: Date;
	updated_at?: Date;
	last_login?: Date;
	account: {
		type: string;
		id: string;
		firstName?: string;
		lastName?: string;
		username: string;
		bio?: string;
		email?: string;
		address?: string;
		country?: string;
		phoneNumber?: number;
		visibility: {
			account: typeof com.earthapp.Visibility.prototype.name;
			name: typeof com.earthapp.account.Privacy.prototype.name;
			bio: typeof com.earthapp.account.Privacy.prototype.name;
			email: typeof com.earthapp.account.Privacy.prototype.name;
			address: typeof com.earthapp.account.Privacy.prototype.name;
			activities: typeof com.earthapp.account.Privacy.prototype.name;
			events: typeof com.earthapp.account.Privacy.prototype.name;
			friends: typeof com.earthapp.account.Privacy.prototype.name;
			last_login: typeof com.earthapp.account.Privacy.prototype.name;
			account_type: typeof com.earthapp.account.Privacy.prototype.name;
		};
	};
	activities?: {
		id: string;
		name: string;
		types: (typeof com.earthapp.activity.ActivityType.prototype.name)[];
	}[];
};
