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
			type: 'multi_select';
			options: string[];
			correct_answers: string[];
			correct_answer_indices: number[];
	  }
	| {
			type: 'true_false';
			options: ('True' | 'False')[];
			correct_answer: 'True' | 'False';
			correct_answer_index: number;
			is_true: boolean;
			is_false: boolean;
	  }
	| {
			// items[] stored on the server is the canonical correct order; cloud serves a shuffled
			// copy to the client so the answer doesn't leak over the wire
			type: 'order';
			items: string[];
	  }
);

// derived fields the server computes from the canonical answer data — admins
// submit only the canonical fields (correct_answer / correct_answers / items)
// and the server fills these in on read
type DerivedAnswerFields =
	| 'correct_answer_index'
	| 'correct_answer_indices'
	| 'is_true'
	| 'is_false';

// distributive so Omit applies to each union branch (otherwise keyof T collapses
// to the keys common to every branch and we lose the discriminated payload)
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type ArticleQuizQuestionSubmission = DistributiveOmit<
	ArticleQuizQuestion,
	DerivedAnswerFields
>;

export type ArticleQuizAnswer = {
	question: string;
	// multiple_choice / true_false
	text?: string;
	index?: number;
	// multi_select
	texts?: string[];
	indices?: number[];
	// order — user's submitted sequence of item strings
	ordered?: string[];
};

export type ArticleQuizScoreResult = {
	score: number;
	scorePercent: number;
	total: number;
	results: {
		question: string;
		type: ArticleQuizQuestion['type'];
		// single-answer types
		correct_answer?: string;
		correct_answer_index?: number;
		user_answer?: string;
		user_answer_index?: number;
		// multi_select
		correct_answers?: string[];
		correct_answer_indices?: number[];
		user_answers?: string[];
		user_answer_indices?: number[];
		// order
		correct_order?: string[];
		user_order?: string[];
		correct: boolean;
	}[];
};
