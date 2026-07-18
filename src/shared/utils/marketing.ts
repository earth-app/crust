import type { Activity, ActivityType } from 'types/activity';
import type { Article } from 'types/article';
import type { Event, EventActivity, EventType } from 'types/event';
import type { Prompt, PromptResponse } from 'types/prompts';
import type { AccountType, User } from 'types/user';

// pure mock factories + form-normalization helpers for the admin Marketing Studio.
// everything here is preview-only: the objects are fed straight into the real card
// components, never sent to mantle2 or shown to real users. kept framework-free so the
// factories are unit-testable in isolation.

export const MARKETING_ACCOUNT_TYPES: AccountType[] = [
	'FREE',
	'PRO',
	'WRITER',
	'ORGANIZER',
	'ADMINISTRATOR'
];

export const MARKETING_EVENT_TYPES: EventType[] = ['IN_PERSON', 'HYBRID', 'ONLINE'];

// a slow-ish rotation of green-forward hues for article accents when none is supplied
export const MARKETING_DEFAULT_ARTICLE_HEX = '#4ade80';

function isoAt(ms: number): string {
	return new Date(ms).toISOString();
}

export function splitCsv(value: string | undefined | null): string[] {
	if (!value) return [];
	return value
		.split(',')
		.map((v) => v.trim())
		.filter((v) => v.length > 0);
}

function slug(value: string, fallback: string): string {
	const s = value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
	return s || fallback;
}

function clampInt(value: number | string | undefined, min = 0, max = 100000): number {
	const n = typeof value === 'string' ? parseInt(value, 10) : (value ?? min);
	if (!Number.isFinite(n)) return min;
	return Math.max(min, Math.min(max, Math.round(n as number)));
}

// activity-type badge values are only read for display, so a free-text form value is coerced
// into the SCREAMING_SNAKE shape the enum uses (never validated against the real enum)
export function normalizeActivityType(value: string): ActivityType {
	return value.trim().toUpperCase().replace(/\s+/g, '_') as ActivityType;
}

// accepts a number (0xRRGGBB), a #hex string, or a bare hex string; returns 0xRRGGBB
export function hexColorToInt(color: number | string | undefined | null): number {
	if (typeof color === 'number' && Number.isFinite(color)) return color & 0xffffff;
	if (typeof color === 'string') {
		const hex = color.trim().replace(/^#/, '');
		if (/^[0-9a-fA-F]{6}$/.test(hex)) return parseInt(hex, 16);
		if (/^[0-9a-fA-F]{3}$/.test(hex)) {
			const [r, g, b] = hex.split('');
			return parseInt(`${r}${r}${g}${g}${b}${b}`, 16);
		}
	}
	return hexColorToInt(MARKETING_DEFAULT_ARTICLE_HEX);
}

// inverse of hexColorToInt for seeding the color form field from a numeric payload
export function intColorToHex(color: number | string | undefined | null): string {
	if (typeof color === 'string' && color.trim().length > 0) {
		const hex = color.trim().replace(/^#/, '');
		if (/^[0-9a-fA-F]{3,6}$/.test(hex)) return `#${hex.toLowerCase()}`;
	}
	if (typeof color === 'number' && Number.isFinite(color)) {
		return `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;
	}
	return MARKETING_DEFAULT_ARTICLE_HEX;
}

export interface MockUserOverrides {
	id?: string;
	username?: string;
	fullName?: string;
	accountType?: AccountType;
	avatarUrl?: string;
	now?: number;
}

export function mockUser(overrides: MockUserOverrides = {}): User {
	const username = (overrides.username || 'earthling').trim() || 'earthling';
	const accountType: AccountType = overrides.accountType ?? 'FREE';
	const id = overrides.id ?? `mock-${slug(username, 'user')}`;
	const now = overrides.now ?? Date.now();
	const at = isoAt(now);
	const privacy = 'PUBLIC' as const;

	return {
		id,
		username,
		full_name: overrides.fullName,
		created_at: at,
		updated_at: at,
		last_login: at,
		is_admin: accountType === 'ADMINISTRATOR',
		account: {
			id: `account-${id}`,
			account_type: accountType,
			username,
			avatar_url: overrides.avatarUrl ?? '',
			first_name: overrides.fullName?.split(' ')[0],
			last_name: overrides.fullName?.split(' ').slice(1).join(' ') || undefined,
			bio: 'Preview account for marketing demos.',
			email: `${slug(username, 'user')}@example.com`,
			email_verified: true,
			has_password: true,
			linked_providers: [],
			subscribed: false,
			visibility: 'PUBLIC',
			field_privacy: {
				name: privacy,
				bio: privacy,
				phone_number: privacy,
				country: privacy,
				email: privacy,
				address: privacy,
				activities: privacy,
				events: privacy,
				friends: privacy,
				last_login: privacy,
				account_type: privacy,
				impact_points: privacy,
				badges: privacy
			}
		},
		disabled: false,
		is_friend: false,
		is_my_friend: false,
		is_mutual: false,
		is_blocking: false,
		mutual_count: 0,
		is_in_circle: false,
		is_in_my_circle: false
	};
}

// Activity

export interface MarketingActivityForm {
	name: string;
	description: string;
	types: string;
	icon: string;
}

export function emptyActivityForm(): MarketingActivityForm {
	return { name: '', description: '', types: '', icon: '' };
}

export function activityFormFromPayload(payload: unknown): MarketingActivityForm {
	const p = (payload ?? {}) as Partial<Activity>;
	return {
		name: p.name ?? '',
		description: p.description ?? '',
		types: Array.isArray(p.types) ? p.types.join(', ') : '',
		icon: p.fields?.icon ?? ''
	};
}

export function mockActivity(form: MarketingActivityForm): Activity {
	const name = form.name.trim() || 'Sample Activity';
	const types = splitCsv(form.types).slice(0, 5).map(normalizeActivityType);
	const fields: Record<string, string> = {};
	if (form.icon.trim()) fields.icon = form.icon.trim();

	return {
		id: name.toLowerCase().replace(/\s+/g, '_').slice(0, 50),
		name,
		description: form.description.trim(),
		types: types.length > 0 ? types : (['OTHER'] as ActivityType[]),
		aliases: [],
		fields
	};
}

// Event

export interface MarketingEventForm {
	name: string;
	description: string;
	type: EventType;
	activities: string;
	attendeeCount: number;
	hostUsername: string;
	hostAccountType: AccountType;
}

export function emptyEventForm(): MarketingEventForm {
	return {
		name: '',
		description: '',
		type: 'ONLINE',
		activities: '',
		attendeeCount: 0,
		hostUsername: 'earthling',
		hostAccountType: 'ORGANIZER'
	};
}

function activityLabel(activity: unknown): string {
	if (typeof activity === 'string') return activity;
	if (activity && typeof activity === 'object') {
		const a = activity as { type?: string; value?: string; name?: string };
		if (a.type === 'activity_type' && a.value) return a.value;
		if (a.type === 'activity' && a.name) return a.name;
	}
	return '';
}

export function eventFormFromPayload(payload: unknown): MarketingEventForm {
	const p = (payload ?? {}) as Partial<Event> & { host?: { account_type?: AccountType } };
	const type = MARKETING_EVENT_TYPES.includes(p.type as EventType)
		? (p.type as EventType)
		: 'ONLINE';
	const activities = Array.isArray(p.activities)
		? p.activities.map(activityLabel).filter(Boolean).join(', ')
		: '';
	return {
		name: p.name ?? '',
		description: p.description ?? '',
		type,
		activities,
		attendeeCount: clampInt(p.attendee_count),
		hostUsername: p.host?.username ?? 'earthling',
		hostAccountType:
			p.host?.account?.account_type ?? p.host?.account_type ?? ('ORGANIZER' as AccountType)
	};
}

export function mockEvent(form: MarketingEventForm, opts: { now?: number } = {}): Event {
	const now = opts.now ?? Date.now();
	const host = mockUser({
		username: form.hostUsername,
		fullName: form.hostUsername,
		accountType: form.hostAccountType,
		now
	});
	const start = now + 3 * 24 * 60 * 60 * 1000;
	const end = start + 2 * 60 * 60 * 1000;
	const activities: EventActivity[] = splitCsv(form.activities).map((value) => ({
		type: 'activity_type',
		value: normalizeActivityType(value)
	}));

	return {
		id: `mock-event-${slug(form.name, 'preview')}`,
		hostId: host.id,
		host,
		name: form.name.trim() || 'Sample Event',
		description: form.description.trim(),
		type: form.type,
		activities,
		location: { latitude: 0, longitude: 0 },
		date: start,
		date_f: isoAt(start),
		end_date: end,
		end_date_f: isoAt(end),
		visibility: 'PUBLIC',
		attendee_count: clampInt(form.attendeeCount),
		is_attending: false,
		can_edit: false,
		created_at: isoAt(now),
		updated_at: isoAt(now),
		timing: {
			has_passed: false,
			is_ongoing: false,
			starts_in: Math.round((start - now) / 1000),
			ends_in: Math.round((end - now) / 1000),
			is_upcoming: true
		},
		fields: {}
	};
}

// Prompt (+ responses)

export interface MarketingPromptForm {
	prompt: string;
	ownerUsername: string;
	ownerAccountType: AccountType;
	responsesCount: number;
	responses: string[];
}

export function emptyPromptForm(): MarketingPromptForm {
	return {
		prompt: '',
		ownerUsername: 'earthling',
		ownerAccountType: 'FREE',
		responsesCount: 0,
		responses: []
	};
}

export function promptFormFromPayload(payload: unknown): MarketingPromptForm {
	const p = (payload ?? {}) as Partial<Prompt>;
	return {
		prompt: p.prompt ?? '',
		ownerUsername: p.owner?.username ?? 'earthling',
		ownerAccountType: p.owner?.account?.account_type ?? 'FREE',
		responsesCount: clampInt(p.responses_count),
		responses: []
	};
}

export function mockPrompt(form: MarketingPromptForm, opts: { now?: number } = {}): Prompt {
	const now = opts.now ?? Date.now();
	const owner = mockUser({
		username: form.ownerUsername,
		fullName: form.ownerUsername,
		accountType: form.ownerAccountType,
		now
	});
	const at = isoAt(now);
	// keep the counter honest with any authored sample responses
	const responsesCount = Math.max(clampInt(form.responsesCount), form.responses.length);

	return {
		id: `mock-prompt-${slug(form.prompt.slice(0, 24), 'preview')}`,
		owner_id: owner.id,
		owner,
		responses_count: responsesCount,
		has_responded: false,
		prompt: form.prompt.trim() || 'What small change did you make for the planet today?',
		visibility: 'PUBLIC',
		created_at: at,
		updated_at: at
	};
}

export function mockPromptResponses(
	form: MarketingPromptForm,
	opts: { now?: number } = {}
): PromptResponse[] {
	const now = opts.now ?? Date.now();
	const promptId = mockPrompt(form, opts).id;

	return form.responses
		.map((text) => text.trim())
		.filter((text) => text.length > 0)
		.map((text, i) => {
			const owner = mockUser({
				username: `responder_${i + 1}`,
				fullName: `Responder ${i + 1}`,
				accountType: 'FREE',
				now
			});
			return {
				id: `mock-response-${i + 1}`,
				prompt_id: promptId,
				owner,
				response: text,
				created_at: isoAt(now - (i + 1) * 60_000),
				updated_at: isoAt(now - (i + 1) * 60_000)
			};
		});
}

// Article

export interface MarketingArticleForm {
	title: string;
	description: string;
	content: string;
	tags: string;
	colorHex: string;
	authorUsername: string;
	authorAccountType: AccountType;
	favicon: string;
}

export function emptyArticleForm(): MarketingArticleForm {
	return {
		title: '',
		description: '',
		content: '',
		tags: '',
		colorHex: MARKETING_DEFAULT_ARTICLE_HEX,
		authorUsername: 'earthling',
		authorAccountType: 'WRITER',
		favicon: ''
	};
}

export function articleFormFromPayload(payload: unknown): MarketingArticleForm {
	const p = (payload ?? {}) as Partial<Article> & { color?: number | string };
	return {
		title: p.title ?? '',
		description: p.description ?? '',
		content: p.content ?? '',
		tags: Array.isArray(p.tags) ? p.tags.join(', ') : '',
		colorHex: intColorToHex(p.color_hex ?? p.color),
		authorUsername: p.author?.username ?? 'earthling',
		authorAccountType: p.author?.account?.account_type ?? 'WRITER',
		favicon: p.ocean?.favicon ?? ''
	};
}

export function mockArticle(form: MarketingArticleForm, opts: { now?: number } = {}): Article {
	const now = opts.now ?? Date.now();
	const author = mockUser({
		username: form.authorUsername,
		fullName: form.authorUsername,
		accountType: form.authorAccountType,
		now
	});
	const colorHex = intColorToHex(form.colorHex);

	return {
		id: `mock-article-${slug(form.title, 'preview')}`,
		title: form.title.trim() || 'Sample Article',
		description: form.description.trim(),
		tags: splitCsv(form.tags),
		content: form.content.trim(),
		author,
		author_id: author.id,
		color: hexColorToInt(colorHex),
		color_hex: colorHex,
		created_at: isoAt(now),
		updated_at: isoAt(now),
		ocean: form.favicon.trim()
			? {
					title: form.title.trim() || 'Sample Article',
					author: form.authorUsername,
					source: 'Marketing Preview',
					url: 'https://app.earth-app.com',
					keywords: splitCsv(form.tags),
					date: isoAt(now),
					favicon: form.favicon.trim(),
					links: {}
				}
			: undefined
	};
}

// InfoCard playground

export interface MarketingBadgeInput {
	text: string;
	color?: string;
}

// "Recycling, Water:info, Solar" -> [{text:'Recycling'},{text:'Water',color:'info'},{text:'Solar'}]
export function parseInfoCardBadges(value: string | undefined | null): MarketingBadgeInput[] {
	return splitCsv(value).map((entry) => {
		const [text, color] = entry.split(':').map((s) => s.trim());
		return color ? { text: text ?? '', color } : { text: text ?? '' };
	});
}

// pull the 11-char youtube id out of a full url or accept a bare id
export function parseYoutubeId(value: string | undefined | null): string | undefined {
	if (!value) return undefined;
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	const match = trimmed.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
	if (match?.[1]) return match[1];
	if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
	return trimmed;
}
