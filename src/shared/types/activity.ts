import type { com } from '@earth-app/ocean';

export type Activity = {
	id: string;
	name: string;
	description: string;
	types: (typeof com.earthapp.activity.ActivityType.prototype.name)[];
	aliases: string[];
	created_at?: Date;
	updated_at?: Date;
};
