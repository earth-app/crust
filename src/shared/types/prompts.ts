import type { Privacy, User } from './user';

export type Prompt = {
	id: string;
	/** legacy numeric id; see the note on `User.nid` */
	nid?: string;
	owner_id: string;
	owner: User;
	responses_count: number;
	has_responded: boolean;
	prompt: string;
	visibility: Privacy;
	created_at: string;
	updated_at?: string;
};

export type PromptResponse = {
	id: string;
	prompt_id: string;
	owner: User;
	response: string;
	created_at: string;
	updated_at?: string;
};
