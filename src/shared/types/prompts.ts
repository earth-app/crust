import { com } from '@earth-app/ocean';
import type { User } from './user';

export type Prompt = {
	id: string;
	owner_id: string;
	owner: User;
	responses_count: number;
	prompt: string;
	visibility: typeof com.earthapp.account.Privacy.prototype.name;
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
