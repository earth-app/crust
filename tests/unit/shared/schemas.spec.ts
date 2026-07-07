import {
	articleSchema,
	challengeStatusSchema,
	emailSchema,
	fullNameSchema,
	leaderboardEntrySchema,
	MOOD_EMOJIS,
	moodCountsSchema,
	moodEmojiSchema,
	moodSnapshotSchema,
	moodVoteBodySchema,
	passwordSchema,
	questChallengeSchema,
	questChallengeViewSchema,
	referralStatsSchema,
	scopedLeaderboardResponseSchema,
	usernameSchema
} from 'schemas';
import { describe, expect, it } from 'vitest';

describe('usernameSchema', () => {
	it('accepts a normal username', () => {
		expect(usernameSchema.safeParse('john_doe-1.0').success).toBe(true);
	});

	it('rejects too short', () => {
		expect(usernameSchema.safeParse('ab').success).toBe(false);
	});

	it('rejects too long (31 chars)', () => {
		expect(usernameSchema.safeParse('a'.repeat(31)).success).toBe(false);
	});

	it('accepts exactly the boundary lengths', () => {
		expect(usernameSchema.safeParse('abc').success).toBe(true);
		expect(usernameSchema.safeParse('a'.repeat(30)).success).toBe(true);
	});

	it('rejects illegal characters', () => {
		expect(usernameSchema.safeParse('john doe').success).toBe(false);
		expect(usernameSchema.safeParse('jöhn').success).toBe(false);
		expect(usernameSchema.safeParse('john@x').success).toBe(false);
	});

	it('rejects any whitespace (space, tab, leading/trailing)', () => {
		expect(usernameSchema.safeParse('john doe').success).toBe(false);
		expect(usernameSchema.safeParse('john\tdoe').success).toBe(false);
		expect(usernameSchema.safeParse(' johndoe').success).toBe(false);
		expect(usernameSchema.safeParse('johndoe ').success).toBe(false);
	});

	it('surfaces the "Username cannot contain spaces" message first for a spaced username', () => {
		const res = usernameSchema.safeParse('john doe');
		expect(res.success).toBe(false);
		if (!res.success) {
			expect(res.error.issues[0]?.message).toBe('Username cannot contain spaces');
		}
	});
});

describe('passwordSchema', () => {
	it('accepts a valid password with symbols', () => {
		expect(passwordSchema.safeParse('Abc!@#$%12').success).toBe(true);
	});

	it('rejects shorter than 8', () => {
		expect(passwordSchema.safeParse('Abc!12').success).toBe(false);
	});

	it('rejects longer than 100', () => {
		expect(passwordSchema.safeParse('a'.repeat(101)).success).toBe(false);
	});

	it('rejects disallowed unicode chars', () => {
		expect(passwordSchema.safeParse('pässwörd1').success).toBe(false);
	});
});

describe('emailSchema', () => {
	it('accepts a valid email', () => {
		expect(emailSchema.safeParse('a@b.com').success).toBe(true);
	});

	it('accepts an empty string via the .or(literal(""))', () => {
		expect(emailSchema.safeParse('').success).toBe(true);
	});

	it('rejects malformed addresses', () => {
		expect(emailSchema.safeParse('not-an-email').success).toBe(false);
		expect(emailSchema.safeParse('foo@').success).toBe(false);
	});
});

describe('fullNameSchema', () => {
	it('accepts single and multi-word names', () => {
		expect(fullNameSchema.safeParse('John').success).toBe(true);
		expect(fullNameSchema.safeParse('John Doe').success).toBe(true);
		expect(fullNameSchema.safeParse("O'Brien-Smith").success).toBe(true);
	});

	it('is optional (undefined passes)', () => {
		expect(fullNameSchema.safeParse(undefined).success).toBe(true);
	});

	it('rejects empty string', () => {
		expect(fullNameSchema.safeParse('').success).toBe(false);
	});

	it('rejects names with digits', () => {
		expect(fullNameSchema.safeParse('John3').success).toBe(false);
	});

	it('rejects leading/trailing whitespace pattern', () => {
		expect(fullNameSchema.safeParse(' John').success).toBe(false);
		expect(fullNameSchema.safeParse('John ').success).toBe(false);
	});
});

describe('moodEmojiSchema', () => {
	it('accepts each known emoji', () => {
		for (const e of MOOD_EMOJIS) {
			expect(moodEmojiSchema.safeParse(e).success).toBe(true);
		}
	});

	it('rejects an unknown emoji', () => {
		expect(moodEmojiSchema.safeParse('🤡').success).toBe(false);
	});
});

describe('moodCountsSchema', () => {
	it('normalizes a partial record to all six keys, missing read as 0', () => {
		const parsed = moodCountsSchema.parse({ '😍': 3, '🤔': 1 });
		expect(parsed).toEqual({
			'😍': 3,
			'😊': 0,
			'🤔': 1,
			'😐': 0,
			'😟': 0,
			'😤': 0
		});
	});

	it('floors fractional counts and drops unknown emoji keys', () => {
		const parsed = moodCountsSchema.parse({ '😍': 2.9, '🤡': 100 });
		expect(parsed['😍']).toBe(2);
		expect(Object.keys(parsed).sort()).toEqual([...MOOD_EMOJIS].sort());
	});

	it('rejects a negative count (nonnegative)', () => {
		expect(moodCountsSchema.safeParse({ '😍': -1 }).success).toBe(false);
	});

	it('rejects non-number values', () => {
		expect(moodCountsSchema.safeParse({ '😍': 'x' }).success).toBe(false);
	});
});

describe('moodSnapshotSchema', () => {
	it('accepts a well-formed snapshot', () => {
		const res = moodSnapshotSchema.safeParse({
			counts: { '😍': 1 },
			total: 1,
			updated_at: 123
		});
		expect(res.success).toBe(true);
		if (res.success) expect(res.data.counts['😊']).toBe(0);
	});

	it('rejects negative total', () => {
		expect(moodSnapshotSchema.safeParse({ counts: {}, total: -1, updated_at: 0 }).success).toBe(
			false
		);
	});
});

describe('moodVoteBodySchema', () => {
	it('accepts a known emoji body', () => {
		expect(moodVoteBodySchema.safeParse({ emoji: '😍' }).success).toBe(true);
	});

	it('rejects a bad emoji', () => {
		expect(moodVoteBodySchema.safeParse({ emoji: 'x' }).success).toBe(false);
	});
});

describe('referralStatsSchema', () => {
	it('accepts a full payload', () => {
		expect(
			referralStatsSchema.safeParse({
				code: 'ABC',
				clicks: 5,
				conversions: 2,
				converted_ids: ['a', 'b']
			}).success
		).toBe(true);
	});

	it('rejects negative clicks', () => {
		expect(
			referralStatsSchema.safeParse({
				code: 'ABC',
				clicks: -1,
				conversions: 0,
				converted_ids: []
			}).success
		).toBe(false);
	});

	it('rejects non-string array members', () => {
		expect(
			referralStatsSchema.safeParse({
				code: 'ABC',
				clicks: 0,
				conversions: 0,
				converted_ids: [1, 2]
			}).success
		).toBe(false);
	});
});

describe('leaderboardEntrySchema', () => {
	it('accepts a minimal entry with loose extra user fields', () => {
		const res = leaderboardEntrySchema.safeParse({
			value: 100,
			user: { id: 'u1', username: 'bob', extra: 'kept' }
		});
		expect(res.success).toBe(true);
	});

	it('accepts null value', () => {
		expect(
			leaderboardEntrySchema.safeParse({ value: null, user: { id: 'u1', username: 'b' } }).success
		).toBe(true);
	});

	it('rejects empty user id', () => {
		expect(
			leaderboardEntrySchema.safeParse({ value: 1, user: { id: '', username: 'b' } }).success
		).toBe(false);
	});
});

describe('scopedLeaderboardResponseSchema', () => {
	it('accepts a valid response', () => {
		expect(
			scopedLeaderboardResponseSchema.safeParse({
				scope: 'global',
				type: 'points',
				items: [{ value: 1, user: { id: 'u', username: 'n' } }],
				total: 1
			}).success
		).toBe(true);
	});

	it('rejects an unknown scope', () => {
		expect(
			scopedLeaderboardResponseSchema.safeParse({
				scope: 'world',
				type: 'points',
				items: [],
				total: 0
			}).success
		).toBe(false);
	});

	it('rejects an unknown type', () => {
		expect(
			scopedLeaderboardResponseSchema.safeParse({
				scope: 'global',
				type: 'badges',
				items: [],
				total: 0
			}).success
		).toBe(false);
	});
});

describe('challengeStatusSchema', () => {
	it('accepts every known status', () => {
		for (const s of ['pending', 'active', 'declined', 'completed', 'expired']) {
			expect(challengeStatusSchema.safeParse(s).success).toBe(true);
		}
	});

	it('rejects an unknown status', () => {
		expect(challengeStatusSchema.safeParse('cancelled').success).toBe(false);
	});
});

describe('questChallengeSchema', () => {
	const base = {
		id: 'c1',
		quest_id: 'q1',
		quest_title: 'Quest',
		challenger_id: 'a',
		challenger_name: 'A',
		recipient_id: 'b',
		recipient_name: 'B',
		status: 'pending',
		created_at: 1000
	};

	it('accepts a valid challenge without optional accepted_at', () => {
		expect(questChallengeSchema.safeParse(base).success).toBe(true);
	});

	it('accepts accepted_at when present', () => {
		expect(questChallengeSchema.safeParse({ ...base, accepted_at: 2000 }).success).toBe(true);
	});

	it('rejects an empty id', () => {
		expect(questChallengeSchema.safeParse({ ...base, id: '' }).success).toBe(false);
	});

	it('rejects an invalid status', () => {
		expect(questChallengeSchema.safeParse({ ...base, status: 'nope' }).success).toBe(false);
	});
});

describe('questChallengeViewSchema', () => {
	it('defaults all fields to null on empty object', () => {
		const parsed = questChallengeViewSchema.parse({});
		expect(parsed).toEqual({ challenge: null, other_user: null, other_progress: null });
	});

	it('accepts a populated view', () => {
		const res = questChallengeViewSchema.safeParse({
			challenge: {
				id: 'c1',
				quest_id: 'q',
				quest_title: 't',
				challenger_id: 'a',
				challenger_name: 'A',
				recipient_id: 'b',
				recipient_name: 'B',
				status: 'active',
				created_at: 1
			},
			other_user: { id: 'u', username: 'bob' },
			other_progress: { current_step: 1, total_steps: 5, completed: false }
		});
		expect(res.success).toBe(true);
	});

	it('rejects negative progress steps', () => {
		expect(
			questChallengeViewSchema.safeParse({
				other_progress: { current_step: -1, total_steps: 5, completed: false }
			}).success
		).toBe(false);
	});
});

describe('articleSchema', () => {
	const valid = {
		title: 'A good title',
		description: 'A fine description',
		content: 'x'.repeat(25),
		color_hex: '#aabbcc'
	};

	it('accepts a valid article', () => {
		expect(articleSchema.safeParse(valid).success).toBe(true);
	});

	it('accepts a 3-digit hex color', () => {
		expect(articleSchema.safeParse({ ...valid, color_hex: '#abc' }).success).toBe(true);
	});

	it('rejects a bad hex color', () => {
		expect(articleSchema.safeParse({ ...valid, color_hex: 'red' }).success).toBe(false);
		expect(articleSchema.safeParse({ ...valid, color_hex: '#gggggg' }).success).toBe(false);
	});

	it('rejects a too-short title', () => {
		expect(articleSchema.safeParse({ ...valid, title: 'abc' }).success).toBe(false);
	});

	it('rejects too-short content (< 20)', () => {
		expect(articleSchema.safeParse({ ...valid, content: 'short' }).success).toBe(false);
	});

	it('rejects content over 25000 chars', () => {
		expect(articleSchema.safeParse({ ...valid, content: 'x'.repeat(25001) }).success).toBe(false);
	});
});
