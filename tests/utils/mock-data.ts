/**
 * Mock data factories for E2E tests.
 *
 * Each factory accepts overrides so individual tests can customize state without
 * duplicating large object shapes. Identity values (id, username) are deterministic
 * but parameterizable so cross-page assertions stay stable.
 *
 * Types are intentionally loose (returns are JSON-only) so we don't have to
 * satisfy every field of frontend domain types. The frontend treats responses
 * as data shapes, not class instances.
 */

export type AccountType = 'FREE' | 'PRO' | 'WRITER' | 'ORGANIZER' | 'ADMINISTRATOR';
export type Visibility = 'PUBLIC' | 'PRIVATE' | 'UNLISTED' | 'MUTUAL' | 'CIRCLE';

const FIXED_NOW = '2026-05-21T12:00:00.000Z';

const defaultFieldPrivacy = {
	name: 'PUBLIC',
	bio: 'PUBLIC',
	address: 'CIRCLE',
	country: 'PUBLIC',
	email: 'PRIVATE',
	phone_number: 'PRIVATE',
	last_login: 'MUTUAL',
	account_type: 'PUBLIC',
	activities: 'PUBLIC',
	circle: 'MUTUAL',
	friends: 'MUTUAL',
	events: 'MUTUAL',
	impact_points: 'PUBLIC',
	badges: 'PUBLIC'
} as const;

export interface UserOverrides {
	id?: string;
	username?: string;
	full_name?: string;
	is_admin?: boolean;
	created_at?: string;
	account?: Partial<{
		account_type: AccountType;
		visibility: Visibility;
		email_verified: boolean;
		email: string;
		avatar_url: string | null;
		has_password: boolean;
		linked_providers: string[];
		first_name: string;
		last_name: string;
		bio: string;
		country: string;
	}>;
}

export function makeUser(overrides: UserOverrides = {}): Record<string, any> {
	const id = overrides.id ?? 'test-user-1';
	const username = overrides.username ?? 'testuser';
	const accountType: AccountType = overrides.account?.account_type ?? 'FREE';
	const isAdmin = accountType === 'ADMINISTRATOR' || (overrides.is_admin ?? false);

	return {
		id,
		username,
		full_name: overrides.full_name ?? 'Test User',
		created_at: overrides.created_at ?? FIXED_NOW,
		updated_at: FIXED_NOW,
		last_login: FIXED_NOW,
		is_admin: isAdmin,
		bio: overrides.account?.bio ?? 'A test user',
		country: overrides.account?.country ?? 'US',
		address: '',
		phone_number: '',
		email: overrides.account?.email ?? 'test@earth-app.com',
		disabled: false,
		is_friend: false,
		is_my_friend: false,
		is_mutual: false,
		mutual_count: 0,
		is_in_circle: false,
		is_in_my_circle: false,
		account: {
			id: `account-${id}`,
			account_type: accountType,
			username,
			avatar_url: overrides.account?.avatar_url ?? '',
			visibility: overrides.account?.visibility ?? 'PUBLIC',
			email_verified: overrides.account?.email_verified ?? true,
			email: overrides.account?.email ?? 'test@earth-app.com',
			has_password: overrides.account?.has_password ?? true,
			linked_providers: overrides.account?.linked_providers ?? [],
			subscribed: false,
			first_name: overrides.account?.first_name ?? 'Test',
			last_name: overrides.account?.last_name ?? 'User',
			bio: overrides.account?.bio ?? 'A test user',
			country: overrides.account?.country ?? 'US',
			field_privacy: { ...defaultFieldPrivacy }
		}
	};
}

export function makeAdmin(overrides: UserOverrides = {}): Record<string, any> {
	return makeUser({
		id: 'admin-user-1',
		username: 'admin',
		is_admin: true,
		...overrides,
		account: {
			account_type: 'ADMINISTRATOR',
			visibility: 'PUBLIC',
			email_verified: true,
			...(overrides.account ?? {})
		}
	});
}

export function makeActivity(overrides: Record<string, any> = {}): Record<string, any> {
	const id = overrides.id ?? `activity-${Math.random().toString(36).slice(2, 8)}`;
	return {
		id,
		name: overrides.name ?? `Activity ${id}`,
		description: overrides.description ?? 'A neat activity.',
		types: overrides.types ?? ['HOBBY'],
		aliases: overrides.aliases ?? [],
		icon: overrides.icon ?? 'mdi:earth',
		updated_at: FIXED_NOW,
		created_at: FIXED_NOW,
		fields: overrides.fields ?? {},
		...overrides
	};
}

export function makeArticle(overrides: Record<string, any> = {}): Record<string, any> {
	const id = overrides.id ?? `article-${Math.random().toString(36).slice(2, 8)}`;
	const author = overrides.author ?? makeUser({ username: 'author' });
	return {
		id,
		title: overrides.title ?? 'Test Article',
		description: overrides.description ?? 'A brief description of the article.',
		content: overrides.content ?? 'Once upon a time, there was a test article. '.repeat(10),
		color: overrides.color ?? 3368106,
		color_hex: overrides.color_hex ?? '#3366aa',
		tags: overrides.tags ?? [],
		author,
		author_id: overrides.author_id ?? author.id,
		created_at: FIXED_NOW,
		updated_at: FIXED_NOW,
		...overrides
	};
}

export function makeEvent(overrides: Record<string, any> = {}): Record<string, any> {
	const id = overrides.id ?? `event-${Math.random().toString(36).slice(2, 8)}`;
	const start = Date.UTC(2026, 5, 1, 15);
	const end = Date.UTC(2026, 5, 1, 17);
	const host = overrides.host ?? makeUser({ username: 'host' });
	return {
		id,
		hostId: overrides.hostId ?? host.id,
		host,
		name: overrides.name ?? 'Community Picnic',
		description: overrides.description ?? 'Join us for an afternoon picnic.',
		type: overrides.type ?? 'IN_PERSON',
		activities: overrides.activities ?? [],
		location: overrides.location ?? { latitude: 40.785091, longitude: -73.968285 },
		date: overrides.date ?? start,
		date_f: overrides.date_f ?? new Date(start).toISOString(),
		end_date: overrides.end_date ?? end,
		end_date_f: overrides.end_date_f ?? new Date(end).toISOString(),
		visibility: overrides.visibility ?? 'PUBLIC',
		attendee_count: overrides.attendee_count ?? 5,
		is_attending: overrides.is_attending ?? false,
		can_edit: overrides.can_edit ?? false,
		created_at: FIXED_NOW,
		updated_at: FIXED_NOW,
		timing: {
			has_passed: false,
			is_ongoing: false,
			starts_in: 86_400_000,
			is_upcoming: true,
			...(overrides.timing ?? {})
		},
		fields: { cancelled: false, ...(overrides.fields ?? {}) }
	};
}

export function makePrompt(overrides: Record<string, any> = {}): Record<string, any> {
	const id = overrides.id ?? `prompt-${Math.random().toString(36).slice(2, 8)}`;
	const owner = overrides.owner ?? makeUser({ username: 'prompter' });
	return {
		id,
		owner_id: overrides.owner_id ?? owner.id,
		owner,
		prompt: overrides.prompt ?? 'What is something new you learned this week?',
		visibility: overrides.visibility ?? 'PUBLIC',
		responses_count: overrides.responses_count ?? 3,
		has_responded: overrides.has_responded ?? false,
		created_at: FIXED_NOW,
		updated_at: FIXED_NOW
	};
}

export function makePromptResponse(overrides: Record<string, any> = {}): Record<string, any> {
	const id = overrides.id ?? `pr-${Math.random().toString(36).slice(2, 8)}`;
	const owner = overrides.owner ?? makeUser({ username: 'responder', id: 'responder-1' });
	return {
		id,
		prompt_id: overrides.prompt_id ?? 'prompt-1',
		owner,
		response: overrides.response ?? 'I learned how to write playwright tests.',
		created_at: FIXED_NOW,
		updated_at: FIXED_NOW
	};
}

export function makeBadge(overrides: Record<string, any> = {}): Record<string, any> {
	const id = overrides.id ?? `badge-${Math.random().toString(36).slice(2, 8)}`;
	return {
		id,
		name: overrides.name ?? 'First Steps',
		description: overrides.description ?? 'Awarded for getting started.',
		icon: overrides.icon ?? 'mdi:medal',
		rarity: overrides.rarity ?? 'normal',
		granted: overrides.granted ?? false,
		user_id: overrides.user_id ?? 'test-user-1',
		mastered: overrides.mastered ?? false,
		mastered_at: overrides.mastered_at ?? null,
		mastery_exempt: overrides.mastery_exempt ?? false,
		...overrides
	};
}

export function makeQuest(overrides: Record<string, any> = {}): Record<string, any> {
	const id = overrides.id ?? `quest-${Math.random().toString(36).slice(2, 8)}`;
	return {
		id,
		name: overrides.name ?? 'Daily Explorer',
		description: overrides.description ?? 'Complete a daily activity.',
		icon: overrides.icon ?? 'mdi:trophy',
		target: overrides.target ?? 5,
		rewards: overrides.rewards ?? { points: 10 },
		...overrides
	};
}

export function makeNotification(overrides: Record<string, any> = {}): Record<string, any> {
	const id = overrides.id ?? `notif-${Math.random().toString(36).slice(2, 8)}`;
	return {
		id,
		title: overrides.title ?? 'Notification',
		user_id: overrides.user_id ?? 'test-user-1',
		message: overrides.message ?? 'You have a new notification.',
		type: overrides.type ?? 'info',
		source: overrides.source ?? 'system',
		read: overrides.read ?? false,
		created_at: overrides.created_at ?? Date.now(),
		...overrides
	};
}

export interface PaginatedResponse<T> {
	items: T[];
	total: number;
	page?: number;
	limit?: number;
}

export function paginate<T>(items: T[], page = 1, limit = 25): PaginatedResponse<T> {
	const start = (page - 1) * limit;
	return { items: items.slice(start, start + limit), total: items.length, page, limit };
}

export const MOCK_SESSION_TOKEN = 'mock-session-token-abc123';
export const MOCK_ADMIN_TOKEN = 'mock-admin-token-xyz789';
