import type { com } from '@earth-app/ocean';

export type Activity = {
	id: string;
	name: string;
	description: string;
	types: (typeof com.earthapp.activity.ActivityType.prototype.name)[];
	aliases: string[];
	created_at?: Date;
	updated_at?: Date;
	fields: Record<string, string>;
};

export type WikipediaSummary = {
	title: string;
	description: string;
	extract: string;
	originalimage?: {
		source: string;
		width: number;
		height: number;
	};
	titles: {
		canonical: string;
	};
};

export type YouTubeVideo = {
	id: string;
	title: string;
	uploaded_at: string;
};
