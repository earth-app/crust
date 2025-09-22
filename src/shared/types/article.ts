import type { User } from './user';

export type OceanArticle = {
	title: string;
	author: string;
	source: string;
	url: string;
	abstract?: string;
	content?: string;
	theme_color?: string;
	keywords: string[];
	date: string;
	favicon?: string;
	links: {
		[key: string]: string;
	};
};

export type Article = {
	id: string;
	title: string;
	description: string;
	tags: string[];
	content: string;
	author: User;
	author_id: string;
	color: number;
	color_hex: string;
	created_at: string;
	updated_at?: string;
	ocean: OceanArticle;
};
