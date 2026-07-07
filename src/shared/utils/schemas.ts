import * as z from 'zod';

export const usernameSchema = z
	.string()
	.regex(/^\S*$/, 'Username cannot contain spaces')
	.min(3, 'Must be at least 3 characters')
	.max(30, 'Must be at most 30 characters')
	.regex(
		/^[a-zA-Z0-9_.-]+$/,
		'Only alphanumeric characters, underscores, dashes, and periods are allowed'
	);

export const passwordSchema = z
	.string()
	.min(8, 'Must be at least 8 characters')
	.max(100, 'Must be at most 100 characters')
	.regex(/^[a-zA-Z0-9!@#$%^&*()_+={}\[\]:;"'<>,.?\/\\|-]+$/, 'Invalid characters in password');

export const emailSchema = z
	.email('Invalid email address')
	.min(5, 'Must be at least 5 characters')
	.max(100, 'Must be at most 100 characters')
	.or(z.literal(''));

export const fullNameSchema = z
	.string()
	.min(1, 'Name cannot be empty')
	.max(100, 'Must be at most 100 characters')
	.regex(/^[a-zA-Z'-]+(\s+[a-zA-Z'-]+)*$/, 'Must be a valid full name (e.g., "John" or "John Doe")')
	.optional();

// MoodSpark

export const MOOD_EMOJIS = ['😍', '😊', '🤔', '😐', '😟', '😤'] as const;
export type MoodEmoji = (typeof MOOD_EMOJIS)[number];

export const moodEmojiSchema = z.enum(MOOD_EMOJIS);

// loose record schema (we know the keys, but JSON parses come in as Record<string,number>)
export const moodCountsSchema = z.record(z.string(), z.number().nonnegative()).transform((raw) => {
	// normalize so missing emojis read as 0 and unknown emojis are dropped
	const counts: Record<MoodEmoji, number> = {
		'😍': 0,
		'😊': 0,
		'🤔': 0,
		'😐': 0,
		'😟': 0,
		'😤': 0
	};
	for (const e of MOOD_EMOJIS) {
		counts[e] = Math.floor(raw[e] ?? 0);
	}
	return counts;
});

export const moodSnapshotSchema = z.object({
	counts: moodCountsSchema,
	total: z.number().nonnegative(),
	updated_at: z.number().nonnegative()
});

export const moodVoteBodySchema = z.object({
	emoji: moodEmojiSchema
});

export type MoodSnapshot = z.infer<typeof moodSnapshotSchema>;
export type MoodVoteBody = z.infer<typeof moodVoteBodySchema>;

// Referral + Leaderboard

export const referralStatsSchema = z.object({
	code: z.string(),
	clicks: z.number().nonnegative(),
	conversions: z.number().nonnegative(),
	converted_ids: z.array(z.string())
});

const leaderboardUserSchema = z
	.object({
		id: z.string().min(1),
		username: z.string()
	})
	.loose();

export const leaderboardEntrySchema = z.object({
	id: z.string().optional(),
	value: z.number().nullable(),
	rank: z.number().optional(),
	user: leaderboardUserSchema
});

export const scopedLeaderboardResponseSchema = z.object({
	scope: z.enum(['global', 'friends', 'circle']),
	type: z.enum(['points', 'article', 'prompt', 'event']),
	items: z.array(leaderboardEntrySchema),
	total: z.number().nonnegative()
});

export type ReferralStatsShape = z.infer<typeof referralStatsSchema>;
export type ScopedLeaderboardResponseShape = z.infer<typeof scopedLeaderboardResponseSchema>;

// Quest co-op challenge

export const challengeStatusSchema = z.enum([
	'pending',
	'active',
	'declined',
	'completed',
	'expired'
]);

export const questChallengeSchema = z.object({
	id: z.string().min(1),
	quest_id: z.string(),
	quest_title: z.string(),
	challenger_id: z.string(),
	challenger_name: z.string(),
	recipient_id: z.string(),
	recipient_name: z.string(),
	status: challengeStatusSchema,
	created_at: z.number(),
	accepted_at: z.number().optional()
});

// loose user shape (mantle2 may serialize a stripped/minimal user); cast to User at the boundary.
const challengeUserSchema = z
	.object({
		id: z.string().min(1),
		username: z.string()
	})
	.loose();

// tolerate nulls on every nested field — a missing challenge just means "no challenge".
export const questChallengeViewSchema = z.object({
	challenge: questChallengeSchema.nullable().default(null),
	other_user: challengeUserSchema.nullable().default(null),
	other_progress: z
		.object({
			current_step: z.number().nonnegative(),
			total_steps: z.number().nonnegative(),
			completed: z.boolean()
		})
		.nullable()
		.default(null)
});

export type QuestChallengeShape = z.infer<typeof questChallengeSchema>;
export type QuestChallengeViewShape = z.infer<typeof questChallengeViewSchema>;

// Article Form

export const articleSchema = z.object({
	title: z
		.string()
		.min(5, 'Title must be at least 5 characters')
		.max(150, 'Title must be at most 150 characters'),
	description: z
		.string()
		.min(5, 'Description must be at least 5 characters')
		.max(512, 'Description must be at most 512 characters'),
	content: z
		.string()
		.min(20, 'Content must be at least 20 characters')
		.max(25000, 'Content must be at most 25000 characters'),
	color_hex: z.string().regex(/^#([0-9A-Fa-f]{3}){1,2}$/, 'Color must be a valid hex code')
});
