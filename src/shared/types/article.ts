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
	ocean?: OceanArticle;
};

export type ArticleQuizQuestion = {
	question: string;
} & (
	| {
			type: 'multiple_choice';
			options: string[];
			correct_answer: string;
			correct_answer_index: number;
	  }
	| {
			type: 'true_false';
			options: ('true' | 'false')[];
			correct_answer: 'true' | 'false';
			correct_answer_index: number;
			is_true: boolean;
			is_false: boolean;
	  }
);

export type ArticleQuizScoreResult = {
	score: number;
	scorePercent: number;
	total: number;
	results: {
		question: string;
		correct_answer: string;
		correct_answer_index: number;
		user_answer: string;
		user_answer_index: number;
		correct: boolean;
	}[];
};
