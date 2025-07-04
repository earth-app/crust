export type User = {
	id: string;
	fullName?: string;
	username: string;
	created_at: Date;
	updated_at?: Date;
	last_login?: Date;
	account: {
		type: string;
		id: string;
		firstName?: string;
		lastName?: string;
		username: string;
		email?: string;
		address?: string | null;
		country?: string;
		phoneNumber?: number;
		activities?: {
			id: string;
			name: string;
			type: string;
		}[];
	};
};
