import type { Activity, ActivityType } from 'types/activity';
import type { Article } from 'types/article';
import type { Event, EventActivity, EventType } from 'types/event';
import type { Prompt, PromptResponse } from 'types/prompts';
import type { Trailmark, TrailmarkCreateInput, TrailmarkGeo } from 'types/trailmarks';
import type {
	NatureMinutes,
	Trail,
	TrailJournalEntry,
	TrailPledge,
	TrailPractice,
	TrailRarity,
	TrailReflection,
	TrailRun,
	TrailTheme
} from 'types/trails';
import { TRAIL_PRACTICES } from 'types/trails';
import type {
	AccountType,
	Badge,
	ChallengeStatus,
	Quest,
	QuestChallengeView,
	QuestHistoryEntry,
	QuestPermission,
	QuestProgressEntry,
	QuestStep,
	QuestStepType,
	Rarity,
	User,
	UserNotification,
	UserQuestProgress
} from 'types/user';
import { TRAIL_RARITY_ORDER, trailPracticeMeta } from './trails';

// #region Core

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

// shared with the Trailmarks region; null-safe so a missing value never throws
function slug(value: string, fallback: string): string {
	const s = (value ?? '')
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

// #endregion

// #region People

// preview-only mock factories, persona presets, and form normalization for the
// admin Marketing studio "People & Messages" panel. pure + framework-free so it
// can be unit-tested without a Nuxt runtime; nothing here writes real data

export const MOCK_ACCOUNT_TYPES: AccountType[] = [
	'FREE',
	'PRO',
	'WRITER',
	'ORGANIZER',
	'ADMINISTRATOR'
];

export const NOTIFICATION_TYPES: UserNotification['type'][] = [
	'info',
	'success',
	'warning',
	'error'
];

// the union the notification card special-cases; '@username' mentions are free-form
export const NOTIFICATION_SOURCES = [
	'quest',
	'badge',
	'friend_request',
	'event',
	'system'
] as const;

export const RARITIES: Rarity[] = ['normal', 'rare', 'amazing', 'green'];

export type MockActivityInput = { name: string; icon?: string };
export type MockBadgeInput = { name: string; description?: string; icon?: string; rarity?: Rarity };

export type MockUserForm = {
	full_name: string;
	username: string;
	bio: string;
	avatar_url: string;
	account_type: AccountType;
	activities: MockActivityInput[];
	badges: MockBadgeInput[];
	is_mutual: boolean;
	is_in_circle: boolean;
	mutual_count: number;
};

export type Persona = Omit<MockUserForm, 'avatar_url'>;

export type MockNotificationForm = {
	title: string;
	message: string;
	type: UserNotification['type'];
	source: string;
	link: string;
	read: boolean;
};

export type MockMotdForm = {
	motd: string;
	icon: string;
	type: 'info' | 'success' | 'warning' | 'error';
	link: string;
};

// #region People helpers

export function slugify(input: string): string {
	const out = (input || '')
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return out || 'item';
}

// strip a leading @ and interior whitespace so handles stay url-safe
export function normalizeUsername(raw: string): string {
	return (raw || '').replace(/^@+/, '').replace(/\s+/g, '').trim();
}

export function parseList(csv: string): string[] {
	return (csv || '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
}

const PRIVACY_KEYS = [
	'name',
	'bio',
	'phone_number',
	'country',
	'email',
	'address',
	'activities',
	'events',
	'friends',
	'last_login',
	'account_type',
	'impact_points',
	'badges'
] as const;

function allPublicPrivacy(): User['account']['field_privacy'] {
	const entries = PRIVACY_KEYS.map((k) => [k, 'PUBLIC']);
	return Object.fromEntries(entries) as User['account']['field_privacy'];
}

// #endregion

// #region People user

export function emptyUserForm(): MockUserForm {
	return {
		full_name: '',
		username: '',
		bio: '',
		avatar_url: '',
		account_type: 'FREE',
		activities: [],
		badges: [],
		is_mutual: false,
		is_in_circle: false,
		mutual_count: 0
	};
}

export function personaToForm(persona: Persona): MockUserForm {
	return {
		...persona,
		avatar_url: '',
		activities: persona.activities.map((a) => ({ ...a })),
		badges: persona.badges.map((b) => ({ ...b }))
	};
}

// pick a persona deterministically (seed) or at random; never returns undefined
export function pickPersona(seed?: number): Persona {
	const list = PERSONA_PRESETS;
	const idx =
		typeof seed === 'number'
			? ((seed % list.length) + list.length) % list.length
			: Math.floor(Math.random() * list.length);
	return list[idx] ?? list[0]!;
}

// map a real (public) user into the editable form for the "Pull Live" flow
export function userToForm(user: User): MockUserForm {
	const rawAvatar = user.account?.avatar_url;
	const avatar_url = typeof rawAvatar === 'string' && rawAvatar.startsWith('http') ? rawAvatar : '';
	return {
		full_name: user.full_name ?? '',
		username: user.username ?? '',
		bio: user.account?.bio ?? '',
		avatar_url,
		account_type: user.account?.account_type ?? 'FREE',
		activities: (user.activities ?? []).map((a) => ({
			name: a.name,
			icon: a.fields?.['icon'] || 'mdi:earth'
		})),
		badges: [],
		is_mutual: !!user.is_mutual,
		is_in_circle: !!user.is_in_circle,
		mutual_count: typeof user.mutual_count === 'number' ? user.mutual_count : 0
	};
}

function makeMockActivities(inputs: MockActivityInput[]): Activity[] {
	return inputs
		.filter((a) => a.name?.trim())
		.map((a, i) => ({
			id: `mock-activity-${slugify(a.name)}-${i}`,
			name: a.name.trim(),
			description: '',
			types: [],
			aliases: [],
			fields: { icon: a.icon?.trim() || 'mdi:earth' }
		}));
}

export function makeMockBadges(inputs: MockBadgeInput[]): Badge[] {
	return inputs
		.filter((b) => b.name?.trim())
		.map((b) => ({
			id: `mock-badge-${slugify(b.name)}`,
			name: b.name.trim(),
			description: b.description?.trim() || `Earned for ${b.name.trim()}.`,
			icon: b.icon?.trim() || 'mdi:medal-outline',
			rarity: b.rarity ?? 'normal'
		}));
}

// build a complete, render-safe User. id is always mock-prefixed so it can never
// collide with the signed-in admin (avoids the UserCard "You" badge / identity leak)
export function makeMockUser(form: MockUserForm): User {
	const username = normalizeUsername(form.username) || 'earthling';
	const mutual = !!form.is_mutual;
	const inCircle = !!form.is_in_circle;
	return {
		id: `mock-user-${slugify(username)}`,
		username,
		full_name: form.full_name?.trim() || 'Earth Explorer',
		created_at: new Date('2024-01-01T00:00:00Z').toISOString(),
		is_admin: false,
		account: {
			account_type: form.account_type || 'FREE',
			id: `mock-account-${slugify(username)}`,
			avatar_url: typeof form.avatar_url === 'string' ? form.avatar_url : '',
			username,
			bio: form.bio?.trim() || '',
			email_verified: true,
			has_password: true,
			linked_providers: [],
			subscribed: form.account_type !== 'FREE',
			visibility: 'PUBLIC' as User['account']['visibility'],
			field_privacy: allPublicPrivacy()
		},
		disabled: false,
		activities: makeMockActivities(form.activities),
		is_friend: mutual,
		is_my_friend: mutual,
		is_mutual: mutual,
		is_blocking: false,
		mutual_count: Math.max(0, Math.floor(form.mutual_count) || 0),
		is_in_circle: inCircle,
		is_in_my_circle: inCircle
	};
}

// #endregion

// #region People notification

export function emptyNotificationForm(): MockNotificationForm {
	return {
		title: '',
		message: '',
		type: 'info',
		source: 'system',
		link: '',
		read: false
	};
}

export function makeMockNotification(form: MockNotificationForm, index = 0): UserNotification {
	const link = form.link?.trim();
	return {
		id: `mock-notif-${index}-${slugify(form.title || 'notification')}`,
		title: form.title?.trim() || 'Notification',
		user_id: 'mock-preview-user',
		message: form.message?.trim() || '',
		type: NOTIFICATION_TYPES.includes(form.type) ? form.type : 'info',
		source: form.source?.trim() || 'system',
		read: !!form.read,
		created_at: Math.floor(Date.now() / 1000),
		...(link ? { link } : {})
	};
}

// type -> rich toast options mirroring how the app surfaces a notification toast
export function notificationToastOptions(
	n: Pick<UserNotification, 'title' | 'message' | 'type' | 'source'>
) {
	const color = NOTIFICATION_TYPES.includes(n.type) ? n.type : 'info';
	const icon =
		color === 'error'
			? 'mdi:alert-circle'
			: color === 'warning'
				? 'mdi:alert'
				: color === 'success'
					? 'mdi:check-circle'
					: 'mdi:information';
	return {
		title: n.title?.trim() || 'Notification',
		description: n.message?.trim() || '',
		icon,
		color,
		duration: 5000
	};
}

// #endregion

// #region People motd

export function emptyMotdForm(): MockMotdForm {
	return { motd: '', icon: '', type: 'info', link: '' };
}

// trim, coerce the type to a supported value, and drop an empty link
export function normalizeMotdForm(form: MockMotdForm): MockMotdForm {
	const type = (['info', 'success', 'warning', 'error'] as const).includes(form.type)
		? form.type
		: 'info';
	return {
		motd: (form.motd ?? '').trim(),
		icon: (form.icon ?? '').trim(),
		type,
		link: (form.link ?? '').trim()
	};
}

// #endregion

// #region People presets

// ~6 curated, on-brand personas - calm, curious, outdoorsy voices
export const PERSONA_PRESETS: Persona[] = [
	{
		full_name: 'Maya Rivera',
		username: 'mayawanders',
		bio: 'Chasing sunrises and quiet trails. Always packing an extra water bottle.',
		account_type: 'PRO',
		activities: [
			{ name: 'Hiking', icon: 'mdi:hiking' },
			{ name: 'Birdwatching', icon: 'mdi:bird' },
			{ name: 'Journaling', icon: 'mdi:notebook-outline' }
		],
		badges: [
			{ name: 'Trailblazer', icon: 'mdi:map-marker-path', rarity: 'rare' },
			{ name: 'Early Riser', icon: 'mdi:weather-sunset-up', rarity: 'normal' }
		],
		is_mutual: true,
		is_in_circle: false,
		mutual_count: 42
	},
	{
		full_name: 'Theo Nakamura',
		username: 'theogrows',
		bio: 'Tending a small balcony garden and a big compost bin. Slow living, deep roots.',
		account_type: 'WRITER',
		activities: [
			{ name: 'Gardening', icon: 'mdi:flower-outline' },
			{ name: 'Photography', icon: 'mdi:camera-outline' },
			{ name: 'Composting', icon: 'mdi:recycle' }
		],
		badges: [
			{ name: 'Green Thumb', icon: 'mdi:sprout-outline', rarity: 'green' },
			{ name: 'Storyteller', icon: 'mdi:feather', rarity: 'rare' }
		],
		is_mutual: true,
		is_in_circle: true,
		mutual_count: 88
	},
	{
		full_name: 'Amara Okafor',
		username: 'amararuns',
		bio: 'Trail runner and stargazer. The night sky is my favorite finish line.',
		account_type: 'FREE',
		activities: [
			{ name: 'Trail Running', icon: 'mdi:run-fast' },
			{ name: 'Yoga', icon: 'mdi:meditation' },
			{ name: 'Stargazing', icon: 'mdi:star-shooting-outline' }
		],
		badges: [
			{ name: 'Night Owl', icon: 'mdi:owl', rarity: 'normal' },
			{ name: 'Consistency', icon: 'mdi:calendar-check-outline', rarity: 'rare' }
		],
		is_mutual: false,
		is_in_circle: false,
		mutual_count: 17
	},
	{
		full_name: 'Liam Fjeld',
		username: 'liampaddles',
		bio: 'Kayaks, cold plunges, and quiet mornings by the water. Bring a friend.',
		account_type: 'ORGANIZER',
		activities: [
			{ name: 'Kayaking', icon: 'mdi:kayaking' },
			{ name: 'Foraging', icon: 'mdi:mushroom-outline' },
			{ name: 'Cold Plunge', icon: 'mdi:snowflake' }
		],
		badges: [
			{ name: 'Explorer', icon: 'mdi:compass-outline', rarity: 'rare' },
			{ name: 'Community Builder', icon: 'mdi:account-group-outline', rarity: 'amazing' }
		],
		is_mutual: true,
		is_in_circle: true,
		mutual_count: 134
	},
	{
		full_name: 'Priya Anand',
		username: 'priyareads',
		bio: 'Tea in one hand, sketchbook in the other. Curious about almost everything.',
		account_type: 'PRO',
		activities: [
			{ name: 'Reading', icon: 'mdi:book-open-page-variant-outline' },
			{ name: 'Tea Tasting', icon: 'mdi:tea-outline' },
			{ name: 'Nature Sketching', icon: 'mdi:draw-pen' }
		],
		badges: [
			{ name: 'Bookworm', icon: 'mdi:bookshelf', rarity: 'normal' },
			{ name: 'Curious Mind', icon: 'mdi:lightbulb-on-outline', rarity: 'amazing' }
		],
		is_mutual: false,
		is_in_circle: true,
		mutual_count: 56
	},
	{
		full_name: 'Sofia Marchetti',
		username: 'sofiaclimbs',
		bio: 'Rock walls, wild swims, and a few minutes of stillness before every climb.',
		account_type: 'FREE',
		activities: [
			{ name: 'Rock Climbing', icon: 'mdi:image-filter-hdr' },
			{ name: 'Wild Swimming', icon: 'mdi:swim' },
			{ name: 'Meditation', icon: 'mdi:meditation' }
		],
		badges: [
			{ name: 'Summit Seeker', icon: 'mdi:mountain', rarity: 'rare' },
			{ name: 'Mindful', icon: 'mdi:heart-pulse', rarity: 'normal' }
		],
		is_mutual: true,
		is_in_circle: false,
		mutual_count: 73
	}
];

// notification presets tuned to show the card's source-driven animation matrix
export const NOTIFICATION_PRESETS: MockNotificationForm[] = [
	{
		title: 'Quest Complete: Morning Trail',
		message: 'You finished all 3 steps and earned 120 impact points. Keep the streak going.',
		type: 'success',
		source: 'quest',
		link: '',
		read: false
	},
	{
		title: 'New Badge Unlocked!',
		message: 'You\'ve unlocked the "Trailblazer" badge! Tap to see it in your collection.',
		type: 'success',
		source: 'badge',
		link: '',
		read: false
	},
	{
		title: 'New Friend Request',
		message: '@theogrows wants to add you to their circle.',
		type: 'info',
		source: 'friend_request',
		link: '',
		read: false
	},
	{
		title: 'Event Reminder: Community Cleanup',
		message: 'Riverside Park cleanup starts in 2 hours. See you there.',
		type: 'info',
		source: 'event',
		link: '',
		read: false
	},
	{
		title: 'Heads Up: Password Changed',
		message: "Your password was updated. If this wasn't you, secure your account now.",
		type: 'warning',
		source: 'system',
		link: '',
		read: false
	}
];

// motd presets covering each banner tone
export const MOTD_PRESETS: MockMotdForm[] = [
	{
		motd: 'Welcome to The Earth App - plant your first quest today.',
		icon: 'mdi:sprout',
		type: 'success',
		link: ''
	},
	{
		motd: 'New this week: seasonal quests and fresh community events.',
		icon: 'mdi:calendar-star',
		type: 'info',
		link: ''
	},
	{
		motd: 'Scheduled maintenance tonight at 2 AM UTC. Expect brief downtime.',
		icon: 'mdi:wrench-clock',
		type: 'warning',
		link: ''
	}
];

// #endregion

// #endregion

// #region Quest

// pure, side-effect-free logic for the admin Marketing quest studio (preview only).
// the builder mock factory, the progress simulator, and the seed/restore + write-lock
// helpers all live here so they can be unit-tested without mounting the real modal.

// #region Quest constants

// throwaway ids so a seeded preview quest can never collide with a real quest id
export const PREVIEW_QUEST_ID = 'marketing_preview_quest';
// mastery banners key off a `badge_mastery_` id prefix (see quest/Modal.vue ~251)
export const MASTERY_PREVIEW_QUEST_ID = 'badge_mastery_marketing_preview';

export const QUEST_RARITIES: Rarity[] = ['normal', 'rare', 'amazing', 'green'];

export const QUEST_PERMISSIONS: QuestPermission[] = ['camera', 'location', 'record'];

export const QUEST_STEP_TYPES: QuestStepType[] = [
	'take_photo_location',
	'take_photo_classification',
	'take_photo_objects',
	'take_photo_caption',
	'take_photo_validation',
	'take_photo_list',
	'article_quiz',
	'draw_picture',
	'attend_event',
	'respond_to_prompt',
	'article_read_time',
	'activity_read_time',
	'transcribe_audio',
	'match_terms',
	'order_items',
	'describe_text',
	'submit_event_image',
	'distance_covered',
	'scan_barcode'
];

// these two are always mobile-only (cloud handles them in the app)
export const MOBILE_ONLY_STEP_TYPES: QuestStepType[] = ['distance_covered', 'scan_barcode'];

// human labels for the builder step-type picker
export const QUEST_STEP_TYPE_LABELS: Record<QuestStepType, string> = {
	take_photo_location: 'Photo - Location',
	take_photo_classification: 'Photo - Classification',
	take_photo_objects: 'Photo - Objects',
	take_photo_caption: 'Photo - Caption',
	take_photo_validation: 'Photo - Validation',
	take_photo_list: 'Photo - List',
	article_quiz: 'Article Quiz',
	draw_picture: 'Draw a Picture',
	attend_event: 'Attend an Event',
	respond_to_prompt: 'Respond to a Prompt',
	article_read_time: 'Article Read Time',
	activity_read_time: 'Activity Read Time',
	transcribe_audio: 'Transcribe Audio',
	match_terms: 'Match Terms',
	order_items: 'Order Items',
	describe_text: 'Describe in Text',
	submit_event_image: 'Submit an Event Image',
	distance_covered: 'Distance Covered',
	scan_barcode: 'Scan a Barcode'
};

// #endregion

// #region Quest builder types

export interface BuilderStep {
	// stable local key for v-for + drag; never emitted to the Quest
	_id: string;
	type: QuestStepType;
	description: string;
	tutorial_hint?: string;
	reward?: number;
	delay?: number;
	mobile_only?: boolean;
	parameters: unknown[];
	// consecutive builder steps sharing a non-null groupId collapse into one alt-group
	groupId?: string | null;
}

export interface BuilderQuest {
	title: string;
	description: string;
	icon: string;
	rarity: Rarity;
	reward: number;
	premium: boolean;
	mobile_only: boolean;
	mastery: boolean;
	permissions: QuestPermission[];
	steps: BuilderStep[];
}

let uidCounter = 0;
// monotonic local id; not cryptographic, just unique within a session
export function nextLocalId(prefix = 'bs'): string {
	uidCounter += 1;
	return `${prefix}_${Date.now().toString(36)}_${uidCounter}`;
}

// #endregion

// #region Quest builder factory

function toNonNegInt(value: unknown): number {
	const n = Number(value);
	return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function newBuilderStep(overrides: Partial<BuilderStep> = {}): BuilderStep {
	return {
		_id: nextLocalId(),
		type: 'take_photo_classification',
		description: '',
		parameters: [],
		groupId: null,
		...overrides
	};
}

export function emptyBuilderQuest(): BuilderQuest {
	return {
		title: '',
		description: '',
		icon: 'mdi:flag-checkered',
		rarity: 'normal',
		reward: 100,
		premium: false,
		mobile_only: false,
		mastery: false,
		permissions: [],
		steps: [newBuilderStep({ description: '' })]
	};
}

function toQuestStep(b: BuilderStep): QuestStep {
	const step: QuestStep = {
		type: b.type,
		description: (b.description ?? '').trim(),
		parameters: Array.isArray(b.parameters) ? b.parameters : []
	};
	const reward = toNonNegInt(b.reward);
	if (reward > 0) step.reward = reward;
	const delay = toNonNegInt(b.delay);
	if (delay > 0) step.delay = delay;
	if (b.mobile_only || MOBILE_ONLY_STEP_TYPES.includes(b.type)) step.mobile_only = true;
	const hint = (b.tutorial_hint ?? '').trim();
	if (hint) step.tutorial_hint = hint;
	return step;
}

// collapse the flat builder step list into the Quest `(QuestStep | QuestStep[])[]` shape:
// consecutive steps that share a non-null groupId become one alt-group (a single-member
// group is not worth an array, so it collapses back to a plain step).
export function buildQuestSteps(steps: BuilderStep[]): (QuestStep | QuestStep[])[] {
	const out: (QuestStep | QuestStep[])[] = [];
	let i = 0;
	while (i < steps.length) {
		const gid = steps[i].groupId;
		if (gid) {
			const group: QuestStep[] = [];
			while (i < steps.length && steps[i].groupId === gid) {
				group.push(toQuestStep(steps[i]));
				i += 1;
			}
			out.push(group.length === 1 ? group[0] : group);
		} else {
			out.push(toQuestStep(steps[i]));
			i += 1;
		}
	}
	return out;
}

export function toPreviewQuest(b: BuilderQuest): Quest {
	const quest: Quest = {
		id: b.mastery ? MASTERY_PREVIEW_QUEST_ID : PREVIEW_QUEST_ID,
		title: (b.title ?? '').trim() || 'Untitled Quest',
		description: (b.description ?? '').trim(),
		icon: b.icon || 'mdi:flag-checkered',
		rarity: b.rarity,
		steps: buildQuestSteps(b.steps),
		reward: toNonNegInt(b.reward)
	};
	if (b.mobile_only) quest.mobile_only = true;
	if (b.premium) quest.premium = true;
	if (b.permissions.length) quest.permissions = [...b.permissions];
	return quest;
}

// #endregion

// #region Quest templates

export interface QuestTemplate {
	id: string;
	label: string;
	description: string;
	icon: string;
	build: () => BuilderQuest;
}

// templates stand in for AI generation in v1 (a real AI quest needs a badge context and a
// server route another agent owns); these are one-click starting points the admin can edit.
export const QUEST_TEMPLATES: QuestTemplate[] = [
	{
		id: 'nature',
		label: 'Nature & Outdoors',
		description: 'Get outside, snap what you see, and log a short walk.',
		icon: 'mdi:pine-tree',
		build: () => ({
			...emptyBuilderQuest(),
			title: 'Into the Wild',
			description: 'Step outside and reconnect with the natural world around you.',
			icon: 'mdi:pine-tree',
			rarity: 'rare',
			reward: 250,
			permissions: ['camera', 'location'],
			steps: [
				newBuilderStep({
					type: 'take_photo_location',
					description: 'Photograph a tree, plant, or natural landmark near you.',
					tutorial_hint: 'Hold your phone steady and frame the whole subject in daylight.',
					reward: 25
				}),
				newBuilderStep({
					type: 'take_photo_classification',
					description: 'Capture a bird, insect, or animal you spot on your walk.',
					reward: 40,
					delay: 60
				}),
				newBuilderStep({
					type: 'describe_text',
					description: 'Describe how the outdoors made you feel today.',
					tutorial_hint: 'Aim for a few honest sentences; there are no wrong answers.',
					reward: 20
				})
			]
		})
	},
	{
		id: 'curiosity',
		label: 'Curiosity & Reading',
		description: 'Read, quiz, and reflect on something new.',
		icon: 'mdi:book-open-page-variant',
		build: () => ({
			...emptyBuilderQuest(),
			title: 'Feed Your Curiosity',
			description: 'Learn something new and put it into your own words.',
			icon: 'mdi:book-open-page-variant',
			rarity: 'normal',
			reward: 180,
			steps: [
				newBuilderStep({
					type: 'article_read_time',
					description: 'Read an article for at least three minutes.',
					parameters: ['', 180],
					reward: 20
				}),
				newBuilderStep({
					type: 'article_quiz',
					description: 'Pass a short quiz on what you just read.',
					reward: 40,
					delay: 30
				}),
				newBuilderStep({
					type: 'describe_text',
					description: 'Summarize the most surprising thing you learned.',
					tutorial_hint: 'One clear takeaway is better than a full recap.',
					reward: 25
				})
			]
		})
	},
	{
		id: 'creative',
		label: 'Creative & Drawing',
		description: 'Make something by hand and give it a caption.',
		icon: 'mdi:brush',
		build: () => ({
			...emptyBuilderQuest(),
			title: 'Make Your Mark',
			description: 'Flex your creative muscles with a quick sketch and a story.',
			icon: 'mdi:brush',
			rarity: 'amazing',
			reward: 300,
			steps: [
				newBuilderStep({
					type: 'draw_picture',
					description: 'Draw something that represents your day.',
					tutorial_hint: 'It does not need to be perfect; expression beats accuracy.',
					reward: 50
				}),
				newBuilderStep({
					type: 'take_photo_caption',
					description: 'Photograph an everyday object and give it a creative caption.',
					reward: 30,
					delay: 45
				})
			]
		})
	},
	{
		id: 'mixed',
		label: 'Mixed Explorer',
		description: 'A bit of everything, with an either/or bonus step.',
		icon: 'mdi:compass-rose',
		build: () => {
			const altGroup = nextLocalId('grp');
			return {
				...emptyBuilderQuest(),
				title: "Explorer's Sampler",
				description: 'Sample a little of everything The Earth App has to offer.',
				icon: 'mdi:compass-rose',
				rarity: 'rare',
				reward: 260,
				permissions: ['camera'],
				steps: [
					newBuilderStep({
						type: 'take_photo_objects',
						description: 'Photograph three different objects around you.',
						reward: 30
					}),
					// two alternatives - the user completes either one
					newBuilderStep({
						type: 'match_terms',
						description: 'Match the terms to their definitions.',
						groupId: altGroup,
						reward: 25
					}),
					newBuilderStep({
						type: 'order_items',
						description: 'Put the steps of a natural process in order.',
						groupId: altGroup,
						reward: 25
					}),
					newBuilderStep({
						type: 'respond_to_prompt',
						description: 'Respond to the daily reflection prompt.',
						reward: 20,
						delay: 30
					})
				]
			};
		}
	}
];

export function questTemplate(id: string): BuilderQuest | null {
	return QUEST_TEMPLATES.find((t) => t.id === id)?.build() ?? null;
}

// #endregion

// #region Quest progress simulation

// inline placeholder so completed photo/draw steps render an image without any network
export const PREVIEW_PHOTO_DATA_URL =
	'data:image/svg+xml;utf8,' +
	encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220">' +
			'<rect width="100%" height="100%" fill="#1f2937"/>' +
			'<text x="50%" y="50%" fill="#9ca3af" font-family="sans-serif" font-size="16" ' +
			'text-anchor="middle" dominant-baseline="middle">Preview Submission</text></svg>'
	);

function firstStepOf(quest: Quest): QuestStep {
	const slot = quest.steps[0];
	if (!slot) return { type: 'describe_text', description: '', parameters: [] };
	return Array.isArray(slot) ? slot[0] : slot;
}

function stepAt(quest: Quest, index: number): QuestStep {
	const clamped = Math.max(0, Math.min(index, quest.steps.length - 1));
	const slot = quest.steps[clamped];
	if (!slot) return firstStepOf(quest);
	return Array.isArray(slot) ? slot[0] : slot;
}

// a believable completed-entry per step type, so the "already completed" step view
// (quest/step/Submission.vue) has something real to render (image / score / caption / text)
export function mockProgressEntry(
	type: QuestStepType | string,
	index: number,
	altIndex?: number,
	now: number = Date.now()
): QuestProgressEntry {
	const entry: QuestProgressEntry = { type, index, submittedAt: now, pointsAwarded: 10 };
	if (altIndex !== undefined) entry.altIndex = altIndex;

	switch (type) {
		case 'take_photo_location':
			entry.data = PREVIEW_PHOTO_DATA_URL;
			entry.lat = 41.8781;
			entry.lng = -87.6298;
			break;
		case 'take_photo_classification':
		case 'take_photo_objects':
		case 'take_photo_list':
		case 'take_photo_validation':
			entry.data = PREVIEW_PHOTO_DATA_URL;
			entry.score = 92;
			break;
		case 'take_photo_caption':
			entry.data = PREVIEW_PHOTO_DATA_URL;
			entry.prompt = 'A calm morning by the lake.';
			break;
		case 'draw_picture':
		case 'submit_event_image':
			entry.data = PREVIEW_PHOTO_DATA_URL;
			break;
		case 'article_quiz':
			// deliberately no scoreKey - that would trigger a live article fetch in the step view
			entry.score = 4;
			break;
		case 'describe_text':
		case 'respond_to_prompt':
			entry.text = 'A thoughtful reflection written for this preview.';
			break;
		case 'transcribe_audio':
			entry.score = 88;
			break;
		case 'attend_event':
			entry.eventId = 'preview-event';
			entry.timestamp = now;
			break;
		case 'article_read_time':
		case 'activity_read_time':
			entry.duration = 180;
			break;
		case 'distance_covered':
			entry.distance = 1600;
			break;
		case 'scan_barcode':
			entry.kind = 'product';
			entry.title = 'Preview Item';
			break;
		default:
			break;
	}

	return entry;
}

// build a progress array where the first `completedCount` slots are finished (alt-groups
// finish their first alternative)
export function buildProgress(
	quest: Quest,
	completedCount: number,
	now: number = Date.now()
): (QuestProgressEntry | QuestProgressEntry[])[] {
	const progress: (QuestProgressEntry | QuestProgressEntry[])[] = [];
	const limit = Math.max(0, Math.min(completedCount, quest.steps.length));
	for (let i = 0; i < limit; i += 1) {
		const slot = quest.steps[i];
		if (Array.isArray(slot)) {
			progress.push([mockProgressEntry(slot[0].type, i, 0, now + i * 1000)]);
		} else {
			progress.push(mockProgressEntry(slot.type, i, undefined, now + i * 1000));
		}
	}
	return progress;
}

export function freshQuestProgress(quest: Quest): UserQuestProgress {
	return {
		quest,
		questId: quest.id,
		currentStep: firstStepOf(quest),
		currentStepIndex: 0,
		completed: false,
		progress: []
	};
}

export function partialQuestProgress(
	quest: Quest,
	completedCount: number,
	now: number = Date.now()
): UserQuestProgress {
	const progress = buildProgress(quest, completedCount, now);
	const currentStepIndex = Math.min(progress.length, Math.max(quest.steps.length - 1, 0));
	return {
		quest,
		questId: quest.id,
		currentStep: stepAt(quest, currentStepIndex),
		currentStepIndex,
		completed: false,
		progress
	};
}

export function completedQuestProgress(quest: Quest, now: number = Date.now()): UserQuestProgress {
	return {
		quest,
		questId: quest.id,
		currentStep: stepAt(quest, quest.steps.length - 1),
		currentStepIndex: quest.steps.length,
		completed: true,
		progress: buildProgress(quest, quest.steps.length, now)
	};
}

export function toHistoryEntry(
	quest: Quest,
	completedAt: number = Date.now(),
	now: number = Date.now()
): QuestHistoryEntry {
	return {
		quest,
		questId: quest.id,
		completedAt,
		progress: buildProgress(quest, quest.steps.length, now)
	};
}

export interface PreviewSubmitResult {
	message: string;
	completed: boolean;
	validated: boolean;
}

// simulate a single step submission locally (the write-lock swaps this in for the store's
// real updateQuest so nothing ever reaches the network). returns the next quest-progress
// state plus the { validated, completed } result the step components expect.
export function applyPreviewSubmit(
	current: UserQuestProgress,
	stepResponse: { type: string; index: number; altIndex?: number },
	now: number = Date.now()
): { next: UserQuestProgress; result: PreviewSubmitResult } {
	const quest = current.quest;
	const idx = stepResponse.index;
	const slot = quest.steps[idx];
	const progress = current.progress.slice();
	const entry = mockProgressEntry(stepResponse.type, idx, stepResponse.altIndex, now);

	if (Array.isArray(slot)) {
		const existing = Array.isArray(progress[idx])
			? [...(progress[idx] as QuestProgressEntry[])]
			: [];
		const filtered = existing.filter((e) => e.altIndex !== entry.altIndex);
		filtered.push(entry);
		progress[idx] = filtered;
	} else {
		progress[idx] = entry;
	}

	const completedFlags = quest.steps.map((_, i) => {
		const p = progress[i];
		if (!p) return false;
		return Array.isArray(p) ? p.length > 0 : true;
	});
	const nextIncomplete = completedFlags.findIndex((f) => !f);
	const completed = nextIncomplete === -1;
	const currentStepIndex = completed ? quest.steps.length : nextIncomplete;

	const next: UserQuestProgress = {
		...current,
		progress,
		currentStepIndex,
		currentStep: stepAt(quest, currentStepIndex),
		completed
	};

	return {
		next,
		result: {
			message: completed ? 'Quest complete (preview)' : 'Step complete (preview)',
			completed,
			validated: true
		}
	};
}

// #endregion

// #region Quest seed / restore (pure over plain Maps - the store's reactive Maps satisfy this)

export interface QuestStateMaps {
	quest: Map<string, UserQuestProgress | null>;
	questHistory: Map<string, Map<string, QuestHistoryEntry>>;
}

export interface QuestStateSnapshot {
	hadQuest: boolean;
	quest: UserQuestProgress | null | undefined;
	hadHistory: boolean;
	history: Map<string, QuestHistoryEntry> | undefined;
}

// capture the admin's real active-quest + history entries before seeding so they can be
// restored verbatim when the preview closes (never clobber the admin's real quest state)
export function snapshotQuestState(maps: QuestStateMaps, userId: string): QuestStateSnapshot {
	const hadHistory = maps.questHistory.has(userId);
	return {
		hadQuest: maps.quest.has(userId),
		quest: maps.quest.get(userId),
		hadHistory,
		history: hadHistory ? new Map(maps.questHistory.get(userId)) : undefined
	};
}

export function restoreQuestState(
	maps: QuestStateMaps,
	userId: string,
	snap: QuestStateSnapshot
): void {
	if (snap.hadQuest) maps.quest.set(userId, snap.quest ?? null);
	else maps.quest.delete(userId);

	if (snap.hadHistory)
		maps.questHistory.set(userId, snap.history ? new Map(snap.history) : new Map());
	else maps.questHistory.delete(userId);
}

export function seedActiveQuest(
	maps: QuestStateMaps,
	userId: string,
	progress: UserQuestProgress
): void {
	maps.quest.set(userId, progress);
}

export function clearActiveQuest(maps: QuestStateMaps, userId: string): void {
	maps.quest.set(userId, null);
}

export function seedCompletedHistory(
	maps: QuestStateMaps,
	userId: string,
	entry: QuestHistoryEntry
): void {
	const next = new Map(maps.questHistory.get(userId) ?? []);
	next.set(entry.questId, entry);
	maps.questHistory.set(userId, next);
}

// #endregion

// #region Quest write-lock

export interface QuestWriteMethods {
	startQuest: (...args: any[]) => any;
	updateQuest: (...args: any[]) => any;
	endQuest: (...args: any[]) => any;
}

// swap the store's three quest-write actions for preview-safe stubs and return a
// one-shot restore. proven-safe: useUser.spec.ts already `vi.spyOn(store,'updateQuest')`,
// so setup-store actions are reassignable on the live instance.
export function installQuestWriteLock(
	target: QuestWriteMethods,
	overrides: Partial<QuestWriteMethods>
): () => void {
	const originals: QuestWriteMethods = {
		startQuest: target.startQuest,
		updateQuest: target.updateQuest,
		endQuest: target.endQuest
	};

	if (overrides.startQuest) target.startQuest = overrides.startQuest;
	if (overrides.updateQuest) target.updateQuest = overrides.updateQuest;
	if (overrides.endQuest) target.endQuest = overrides.endQuest;

	let restored = false;
	return () => {
		if (restored) return;
		restored = true;
		target.startQuest = originals.startQuest;
		target.updateQuest = originals.updateQuest;
		target.endQuest = originals.endQuest;
	};
}

// #endregion

// #region Quest challenge mock

function previewRival(): User {
	return {
		id: 'marketing_preview_rival',
		username: 'trailblazer',
		full_name: 'Alex Rivera',
		account: { account_type: 'PRO' }
	} as unknown as User;
}

// build a mock co-op challenge view so quest/ChallengeBanner.vue renders populated.
// `selfId` is the admin's real id so the banner's role logic (challenger vs recipient) resolves.
export function mockChallengeView(
	quest: Quest,
	selfId: string,
	opts: { status?: ChallengeStatus; role?: 'challenger' | 'recipient'; yourSteps?: number } = {}
): QuestChallengeView {
	const total = quest.steps.length;
	const rival = previewRival();
	const role = opts.role ?? (opts.status === 'pending' ? 'recipient' : 'challenger');
	const status: ChallengeStatus = opts.status ?? 'active';

	return {
		challenge: {
			id: 'marketing_preview_challenge',
			quest_id: quest.id,
			quest_title: quest.title,
			challenger_id: role === 'recipient' ? rival.id : selfId,
			challenger_name: role === 'recipient' ? rival.username : 'you',
			recipient_id: role === 'recipient' ? selfId : rival.id,
			recipient_name: role === 'recipient' ? 'you' : rival.username,
			status,
			created_at: Date.now()
		},
		other_user: rival,
		other_progress: {
			current_step: Math.min(Math.max(opts.yourSteps ?? 1, 0), total),
			total_steps: total,
			completed: false
		}
	};
}

// #endregion

// #endregion

// #region Trails

// #region Trails constants

// throwaway id so a seeded preview trail can never collide with a real trail id
export const PREVIEW_TRAIL_ID = 'marketing_preview_trail';

// ~120 min/week; kept local so this file stays pinia-free and unit-testable in isolation
export const PREVIEW_NATURE_TARGET = 120;

export const TRAIL_THEMES: TrailTheme[] = [
	'nature',
	'curiosity',
	'creative',
	'reflective',
	'mixed'
];

export const TRAIL_THEME_LABELS: Record<TrailTheme, string> = {
	nature: 'Nature',
	curiosity: 'Curiosity',
	creative: 'Creative',
	reflective: 'Reflective',
	mixed: 'Mixed'
};

export const TRAIL_RARITY_LABELS: Record<TrailRarity, string> = {
	normal: 'Normal',
	rare: 'Rare',
	amazing: 'Amazing',
	green: 'Green'
};

// #endregion

// #region Trails form <-> trail

export interface TrailForm {
	title: string;
	theme: TrailTheme;
	practice: TrailPractice;
	description: string;
	icon: string;
	rarity: TrailRarity;
	curiosity: string;
	duration: number;
	reflectionPrompt: string;
	reveal: string;
	premium: boolean;
	seasonal: boolean;
	// nature-minutes ring preview (not part of the Trail; drives TrailNatureRing)
	natureMinutes: number;
	natureTarget: number;
	natureBest: number;
}

export function emptyTrailForm(): TrailForm {
	return {
		title: '',
		theme: 'nature',
		practice: 'sit_spot',
		description: '',
		icon: '',
		rarity: 'normal',
		curiosity: '',
		duration: 12,
		reflectionPrompt: '',
		reveal: '',
		premium: false,
		seasonal: false,
		natureMinutes: 45,
		natureTarget: PREVIEW_NATURE_TARGET,
		natureBest: 80
	};
}

function clampDuration(value: number | string | undefined, fallback: number): number {
	const n = typeof value === 'string' ? parseInt(value, 10) : (value ?? NaN);
	if (!Number.isFinite(n) || (n as number) <= 0) return fallback;
	return Math.max(1, Math.min(180, Math.round(n as number)));
}

function clampMinutes(value: number | undefined, fallback = 0): number {
	const n = Number(value);
	if (!Number.isFinite(n) || n < 0) return fallback;
	return Math.min(100000, Math.round(n));
}

// build a valid Trail from the author form; every required field falls back to a sensible
// default so the mock always passes trailSchema (id / title / practice / curiosity / reveal)
export function trailFormToTrail(form: TrailForm): Trail {
	const practice: TrailPractice = TRAIL_PRACTICES.includes(form.practice)
		? form.practice
		: 'sit_spot';
	const theme: TrailTheme = TRAIL_THEMES.includes(form.theme) ? form.theme : 'nature';
	const rarity: TrailRarity = TRAIL_RARITY_ORDER.includes(form.rarity) ? form.rarity : 'normal';
	const meta = trailPracticeMeta(practice);

	const trail: Trail = {
		id: PREVIEW_TRAIL_ID,
		title: (form.title ?? '').trim() || 'Untitled Trail',
		theme,
		practice,
		description: (form.description ?? '').trim() || 'A single, unhurried outdoor practice.',
		icon: (form.icon ?? '').trim() || meta.icon,
		rarity,
		curiosity:
			(form.curiosity ?? '').trim() || 'What will you notice if you slow all the way down?',
		duration: clampDuration(form.duration, meta.defaultMinutes),
		reflectionPrompt: (form.reflectionPrompt ?? '').trim() || 'What did you notice out there?',
		reveal: (form.reveal ?? '').trim() || 'The smallest things reward the most patient attention.'
	};
	if (form.premium) trail.premium = true;
	if (form.seasonal) trail.seasonal = true;
	return trail;
}

// inverse: seed the author form from an existing Trail (used when a live/preset trail is loaded)
export function trailToForm(trail: Partial<Trail>): TrailForm {
	const base = emptyTrailForm();
	const practice = (
		TRAIL_PRACTICES.includes(trail.practice as TrailPractice) ? trail.practice : base.practice
	) as TrailPractice;
	return {
		...base,
		title: trail.title ?? '',
		theme: (TRAIL_THEMES.includes(trail.theme as TrailTheme)
			? trail.theme
			: base.theme) as TrailTheme,
		practice,
		description: trail.description ?? '',
		icon: trail.icon ?? '',
		rarity: (TRAIL_RARITY_ORDER.includes(trail.rarity as TrailRarity)
			? trail.rarity
			: base.rarity) as TrailRarity,
		curiosity: trail.curiosity ?? '',
		duration: clampDuration(trail.duration, trailPracticeMeta(practice).defaultMinutes),
		reflectionPrompt: trail.reflectionPrompt ?? '',
		reveal: trail.reveal ?? '',
		premium: !!trail.premium,
		seasonal: !!trail.seasonal
	};
}

// #endregion

// #region Trails presets

export interface TrailStudioPreset {
	name: string;
	icon: string;
	build: () => TrailForm;
}

export const TRAIL_STUDIO_PRESETS: TrailStudioPreset[] = [
	{
		name: 'Sit Spot',
		icon: 'mdi:meditation',
		build: () => ({
			...emptyTrailForm(),
			title: 'The Ten-Minute Sit',
			theme: 'nature',
			practice: 'sit_spot',
			rarity: 'normal',
			icon: 'mdi:meditation',
			description: 'Find one spot outside, settle in, and let the place come to you.',
			curiosity: 'What arrives when you stop moving and simply wait?',
			duration: 12,
			reflectionPrompt: 'What did the stillness let you notice?',
			reveal: 'Your senses recalibrate to a place in about eight minutes of stillness.',
			natureMinutes: 42,
			natureBest: 75
		})
	},
	{
		name: 'Sky Watch',
		icon: 'mdi:weather-partly-cloudy',
		build: () => ({
			...emptyTrailForm(),
			title: 'Give the Sky an Hour',
			theme: 'reflective',
			practice: 'sky_watch',
			rarity: 'rare',
			icon: 'mdi:weather-partly-cloudy',
			description: 'Lie back and give the sky your full, unhurried attention.',
			curiosity: 'How many kinds of movement can you find in a still-looking sky?',
			duration: 15,
			reflectionPrompt: 'What did the sky do that surprised you?',
			reveal: 'The clouds you watched may be traveling faster than a car on the highway.',
			natureMinutes: 68,
			natureBest: 90
		})
	},
	{
		name: 'Waterside',
		icon: 'mdi:waves',
		build: () => ({
			...emptyTrailForm(),
			title: 'Sit Beside Moving Water',
			theme: 'nature',
			practice: 'water_sit',
			rarity: 'amazing',
			icon: 'mdi:waves',
			description: 'Settle beside a stream, lake, or shoreline and let it hold your attention.',
			curiosity: 'What does water sound like when you really listen?',
			duration: 14,
			reflectionPrompt: 'How did the water change how you felt?',
			reveal: 'The white-noise of moving water measurably lowers a listening heart rate.',
			premium: true,
			natureMinutes: 96,
			natureBest: 110
		})
	},
	{
		name: 'First Frost',
		icon: 'mdi:snowflake',
		build: () => ({
			...emptyTrailForm(),
			title: 'Hunt the First Frost',
			theme: 'curiosity',
			practice: 'slow_look',
			rarity: 'green',
			icon: 'mdi:snowflake',
			description: 'Look closely at frost, ice, or dew before the day warms it away.',
			curiosity: 'What patterns does cold draw that you would otherwise miss?',
			duration: 10,
			reflectionPrompt: 'What did the close look reveal that a glance would have missed?',
			reveal: 'Frost crystals branch along the same angles as the snowflakes they come from.',
			seasonal: true,
			natureMinutes: 30,
			natureBest: 64
		})
	}
];

// deterministic given an injected rng; rotates practice/theme/rarity for varied recordings
export function randomTrailForm(rng: () => number = Math.random): TrailForm {
	const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)] ?? arr[0]!;
	const practice = pick(TRAIL_PRACTICES);
	const meta = trailPracticeMeta(practice);
	const curiosities = [
		'What is older than it looks out here?',
		'What will you notice if you slow all the way down?',
		'What is happening here that usually goes unseen?',
		'What is the smallest thing worth your full attention?'
	];
	const reveals = [
		'The smallest things reward the most patient attention.',
		'Stillness lets a place show you what motion hides.',
		'Wonder is mostly a matter of staying long enough to see it.'
	];
	return {
		...emptyTrailForm(),
		title: `${meta.label} Trail`,
		theme: pick(TRAIL_THEMES),
		practice,
		rarity: pick(TRAIL_RARITY_ORDER),
		icon: meta.icon,
		description: meta.cue,
		curiosity: pick(curiosities),
		duration: meta.defaultMinutes,
		reflectionPrompt: 'What did you notice out there?',
		reveal: pick(reveals),
		premium: rng() > 0.75,
		seasonal: rng() > 0.8,
		natureMinutes: Math.round(rng() * 110) + 10,
		natureBest: Math.round(rng() * 40) + 80
	};
}

// #endregion

// #region Trails nature-minutes mock

function isoWeekKey(date: Date = new Date()): string {
	const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
	const day = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - day);
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
	return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function mockNatureMinutes(opts: {
	minutes: number;
	target?: number;
	best?: number;
	now?: number;
}): NatureMinutes {
	const now = opts.now ?? Date.now();
	const minutes = clampMinutes(opts.minutes);
	const target = Math.max(1, Math.round(opts.target ?? PREVIEW_NATURE_TARGET));
	const best = Math.max(minutes, clampMinutes(opts.best, minutes));
	const at = new Date(now).toISOString();
	return {
		week: isoWeekKey(new Date(now)),
		minutes,
		target,
		best,
		sources: minutes > 0 ? [{ kind: 'trail', ref_id: PREVIEW_TRAIL_ID, minutes, at }] : [],
		updated_at: at
	};
}

export function mockNatureMinutesFromForm(form: TrailForm, now?: number): NatureMinutes {
	return mockNatureMinutes({
		minutes: form.natureMinutes,
		target: form.natureTarget,
		best: form.natureBest,
		now
	});
}

// #endregion

// #region Trails preview-run builders (feed the write-locked store stubs)

export function buildPreviewRun(
	trailId: string,
	pledge?: TrailPledge,
	now: number = Date.now()
): TrailRun {
	return {
		trailId,
		pledge,
		startedAt: new Date(now).toISOString(),
		presenceMinutes: 0,
		completed: false
	};
}

export function buildPreviewJournalEntry(
	trail: Pick<Trail, 'title' | 'practice'> | null,
	trailId: string,
	reflection: TrailReflection,
	minutes: number,
	now: number = Date.now()
): TrailJournalEntry {
	return {
		trailId,
		title: trail?.title ?? 'Trail',
		practice: trail?.practice ?? 'sit_spot',
		presenceMinutes: clampMinutes(minutes),
		reflection,
		completedAt: new Date(now).toISOString()
	};
}

// pure nature-minutes bump used by the preview completeRun stub (never touches the network)
export function creditPreviewNatureMinutes(
	current: NatureMinutes | null,
	minutes: number,
	now: number = Date.now()
): NatureMinutes {
	const base = current ?? mockNatureMinutes({ minutes: 0, now });
	const add = clampMinutes(minutes);
	const total = base.minutes + add;
	const at = new Date(now).toISOString();
	return {
		...base,
		minutes: total,
		best: Math.max(base.best, total),
		sources: [...base.sources, { kind: 'trail', ref_id: PREVIEW_TRAIL_ID, minutes: add, at }],
		updated_at: at
	};
}

// #endregion

// #region Trails write-lock

export interface TrailWriteMethods {
	startRun: (...args: any[]) => any;
	completeRun: (...args: any[]) => any;
	fetchNatureMinutes: (...args: any[]) => any;
}

// swap the trails store's three network-writing actions for preview-safe stubs and return a
// one-shot restore. mirrors installQuestWriteLock; setup-store actions are reassignable on the
// live instance (useTrails.spec drives the store the same way)
export function installTrailWriteLock(
	target: TrailWriteMethods,
	overrides: Partial<TrailWriteMethods>
): () => void {
	const originals: TrailWriteMethods = {
		startRun: target.startRun,
		completeRun: target.completeRun,
		fetchNatureMinutes: target.fetchNatureMinutes
	};

	if (overrides.startRun) target.startRun = overrides.startRun;
	if (overrides.completeRun) target.completeRun = overrides.completeRun;
	if (overrides.fetchNatureMinutes) target.fetchNatureMinutes = overrides.fetchNatureMinutes;

	let restored = false;
	return () => {
		if (restored) return;
		restored = true;
		target.startRun = originals.startRun;
		target.completeRun = originals.completeRun;
		target.fetchNatureMinutes = originals.fetchNatureMinutes;
	};
}

// #endregion

// #endregion

// #region Trailmarks

// #region Trailmarks constants

export const PREVIEW_TRAILMARK_ID = 'marketing_preview_trailmark';
// a note authored from outside as an answer to a daily prompt (the 'from outside' variant)
export const PREVIEW_PROMPT_ID = 'marketing_preview_prompt';
// a public, recognizable spot so the mock geo reads as plausible on the card
export const PREVIEW_GEO: TrailmarkGeo = {
	lat: 41.8827,
	lng: -87.6233,
	place_label: 'Millennium Park'
};

// mirror of the store cap; kept local so this file stays pinia-free and unit-testable
export const PREVIEW_MAX_NOTE = 240;

function clampCount(value: number | undefined, min = 0, max = 100000): number {
	const n = Number(value);
	if (!Number.isFinite(n)) return min;
	return Math.max(min, Math.min(max, Math.round(n)));
}

// #endregion

// #region Trailmarks form <-> trailmark

export interface TrailmarkForm {
	note: string;
	authorUsername: string;
	placeLabel: string;
	lat: number;
	lng: number;
	// when true the note is authored as the current viewer (shows the "Your Note" affordance)
	isMine: boolean;
	// private appreciation tally, only meaningful on a note you authored
	thanksForAuthor: number;
	// when true a not-mine note is shown already-thanked
	thankedByMe: boolean;
	// sets prompt_id so the composer/card render the 'from outside' prompt-answer variant
	fromOutside: boolean;
	// preview-only: drives the "X Away" distance badge on the card
	distanceMeters: number;
	// minutes ago the note was left (drives the relative-time label)
	minutesAgo: number;
}

export function emptyTrailmarkForm(): TrailmarkForm {
	return {
		note: 'You made it here. Take a breath and look up — the light is worth it.',
		authorUsername: 'earthwanderer',
		placeLabel: 'Millennium Park',
		lat: PREVIEW_GEO.lat,
		lng: PREVIEW_GEO.lng,
		isMine: false,
		thanksForAuthor: 12,
		thankedByMe: false,
		fromOutside: false,
		distanceMeters: 320,
		minutesAgo: 23
	};
}

function safeCoord(value: number | undefined, fallback: number): number {
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
}

// build a valid Trailmark from the author form; always passes trailmarkSchema (id / note / geo)
export function trailmarkFormToTrailmark(
	form: TrailmarkForm,
	opts: { selfUid: string; now?: number }
): Trailmark {
	const now = opts.now ?? Date.now();
	const username = (form.authorUsername ?? '').trim() || 'earthwanderer';
	const author_uid = form.isMine ? opts.selfUid : `preview_${slug(username, 'author')}`;
	const place = (form.placeLabel ?? '').trim();

	const mark: Trailmark = {
		id: PREVIEW_TRAILMARK_ID,
		author_uid,
		author_username: username,
		geo: {
			lat: safeCoord(form.lat, PREVIEW_GEO.lat),
			lng: safeCoord(form.lng, PREVIEW_GEO.lng),
			...(place ? { place_label: place } : {})
		},
		note: (form.note ?? '').trim() || 'A little light left behind for the next person.',
		created_at: new Date(now - Math.max(0, form.minutesAgo) * 60_000).toISOString()
	};

	// thanks_for_author is only ever returned to the author (never a public tally)
	if (form.isMine) mark.thanks_for_author = clampCount(form.thanksForAuthor);
	// thanked_by_me only applies to a note you did not write
	else if (form.thankedByMe) mark.thanked_by_me = true;

	if (form.fromOutside) mark.prompt_id = PREVIEW_PROMPT_ID;
	return mark;
}

// inverse: seed the author form from an existing Trailmark
export function trailmarkToForm(mark: Partial<Trailmark>, selfUid?: string): TrailmarkForm {
	const base = emptyTrailmarkForm();
	const isMine = !!selfUid && mark.author_uid === selfUid;
	return {
		...base,
		note: mark.note ?? base.note,
		authorUsername: mark.author_username ?? base.authorUsername,
		placeLabel: mark.geo?.place_label ?? '',
		lat: safeCoord(mark.geo?.lat, base.lat),
		lng: safeCoord(mark.geo?.lng, base.lng),
		isMine,
		thanksForAuthor: clampCount(mark.thanks_for_author, base.thanksForAuthor),
		thankedByMe: !!mark.thanked_by_me,
		fromOutside: !!mark.prompt_id
	};
}

// #endregion

// #region Trailmarks presets

export interface TrailmarkStudioPreset {
	name: string;
	icon: string;
	build: () => TrailmarkForm;
}

export const TRAILMARK_STUDIO_PRESETS: TrailmarkStudioPreset[] = [
	{
		name: 'Kind Note Nearby',
		icon: 'mdi:hand-heart-outline',
		build: () => ({
			...emptyTrailmarkForm(),
			note: 'Whoever you are, I hope the walk here was worth it. Sit a minute before you head back.',
			authorUsername: 'quietfern',
			placeLabel: 'The Overlook',
			isMine: false,
			thankedByMe: false,
			distanceMeters: 210,
			minutesAgo: 47
		})
	},
	{
		name: 'Your Own Note',
		icon: 'mdi:map-marker-account-outline',
		build: () => ({
			...emptyTrailmarkForm(),
			note: 'Left this after my morning sit. The heron came back to the same rock again.',
			placeLabel: 'North Pond',
			isMine: true,
			thanksForAuthor: 8,
			distanceMeters: 0,
			minutesAgo: 120
		})
	},
	{
		name: 'From Outside (Prompt)',
		icon: 'mdi:comment-quote-outline',
		build: () => ({
			...emptyTrailmarkForm(),
			note: "Today's prompt, answered from the trailhead: the thing I changed was slowing down.",
			authorUsername: 'trailanswer',
			placeLabel: 'Ridgeline Trailhead',
			isMine: false,
			fromOutside: true,
			distanceMeters: 640,
			minutesAgo: 15
		})
	}
];

// #endregion

// #region Trailmarks preview created-note builder (feeds the write-locked createTrailmark stub)

// build the trailmark a preview "post" would have created, without any network call. a unique
// id keeps it distinct from the authored mock so both can live in the store side by side.
export function buildPreviewCreatedTrailmark(
	input: TrailmarkCreateInput,
	opts: { selfUid: string; selfUsername: string; now?: number }
): Trailmark {
	const now = opts.now ?? Date.now();
	const mark: Trailmark = {
		id: `${PREVIEW_TRAILMARK_ID}_${Math.round(now)}`,
		author_uid: opts.selfUid,
		author_username: opts.selfUsername || 'you',
		geo: input.geo,
		note: input.note,
		created_at: new Date(now).toISOString(),
		thanks_for_author: 0
	};
	if (input.prompt_id) mark.prompt_id = input.prompt_id;
	return mark;
}

// #endregion

// #region Trailmarks write-lock

export interface TrailmarkWriteMethods {
	createTrailmark: (...args: any[]) => any;
	thankTrailmark: (...args: any[]) => any;
}

// swap the trailmark store's two network-writing actions for preview-safe stubs and return a
// one-shot restore, so the composer's Post and the card's Thank never reach mantle2
export function installTrailmarkWriteLock(
	target: TrailmarkWriteMethods,
	overrides: Partial<TrailmarkWriteMethods>
): () => void {
	const originals: TrailmarkWriteMethods = {
		createTrailmark: target.createTrailmark,
		thankTrailmark: target.thankTrailmark
	};

	if (overrides.createTrailmark) target.createTrailmark = overrides.createTrailmark;
	if (overrides.thankTrailmark) target.thankTrailmark = overrides.thankTrailmark;

	let restored = false;
	return () => {
		if (restored) return;
		restored = true;
		target.createTrailmark = originals.createTrailmark;
		target.thankTrailmark = originals.thankTrailmark;
	};
}

// #endregion

// #endregion
