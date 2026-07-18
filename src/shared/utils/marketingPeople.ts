import type { Activity } from '../types/activity';
import type { AccountType, Badge, Rarity, User, UserNotification } from '../types/user';

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

// #region helpers

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

// #region user

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

// #region notification

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

// #region motd

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

// #region presets

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
