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

export function makeQuestStep(overrides: Record<string, any> = {}): Record<string, any> {
	const type = overrides.type ?? 'describe_text';
	const iconByType: Record<string, string> = {
		describe_text: 'i-lucide-pen-line',
		match_terms: 'i-lucide-link',
		order_items: 'i-lucide-list-ordered',
		article_quiz: 'i-lucide-book-open-check',
		respond_to_prompt: 'i-lucide-message-square',
		attend_event: 'i-lucide-calendar-check',
		article_read_time: 'i-lucide-book-open-text',
		activity_read_time: 'i-lucide-book-open-text'
	};
	return {
		type,
		description: overrides.description ?? `Complete the ${type} step`,
		parameters: overrides.parameters ?? [],
		icon: overrides.icon ?? iconByType[type] ?? 'i-lucide-check',
		...(overrides.reward !== undefined ? { reward: overrides.reward } : {}),
		...(overrides.delay !== undefined ? { delay: overrides.delay } : {}),
		...(overrides.mobile_only !== undefined ? { mobile_only: overrides.mobile_only } : {}),
		...(overrides.tutorial_hint !== undefined ? { tutorial_hint: overrides.tutorial_hint } : {})
	};
}

/**
 * Timeline `Quest` definition (what the modal renders). `steps` is the array of
 * single-or-alternative steps; pass real step objects via makeQuestStep.
 */
export function makeQuestDefinition(overrides: Record<string, any> = {}): Record<string, any> {
	const id = overrides.id ?? `q-${Math.random().toString(36).slice(2, 8)}`;
	return {
		id,
		title: overrides.title ?? 'Test Quest',
		description: overrides.description ?? 'A quest used in e2e tests.',
		icon: overrides.icon ?? 'mdi:trophy',
		rarity: overrides.rarity ?? 'normal',
		steps: overrides.steps ?? [makeQuestStep()],
		reward: overrides.reward ?? 25,
		...(overrides.premium !== undefined ? { premium: overrides.premium } : {}),
		...(overrides.mobile_only !== undefined ? { mobile_only: overrides.mobile_only } : {}),
		...(overrides.permissions !== undefined ? { permissions: overrides.permissions } : {})
	};
}

/**
 * `UserQuestProgress` — the active-quest store entry returned by GET /v2/users/{id}/quest.
 * Override `progress` (array indexed by step) to mark steps complete.
 */
export function makeActiveQuest(overrides: Record<string, any> = {}): Record<string, any> {
	const quest = overrides.quest ?? makeQuestDefinition();
	const progress = overrides.progress ?? [];
	const currentStepIndex = overrides.currentStepIndex ?? progress.length;
	const steps = quest.steps as any[];
	const currentRaw = steps[Math.min(currentStepIndex, steps.length - 1)];
	const currentStep = Array.isArray(currentRaw) ? currentRaw[0] : currentRaw;
	return {
		quest,
		questId: quest.id,
		currentStep,
		currentStepIndex,
		completed: overrides.completed ?? false,
		progress,
		...(overrides.activeReadTime ? { activeReadTime: overrides.activeReadTime } : {}),
		...(overrides.migrated !== undefined ? { migrated: overrides.migrated } : {})
	};
}

export function makeQuestProgressEntry(overrides: Record<string, any> = {}): Record<string, any> {
	return {
		type: overrides.type ?? 'describe_text',
		index: overrides.index ?? 0,
		...(overrides.altIndex !== undefined ? { altIndex: overrides.altIndex } : {}),
		submittedAt: overrides.submittedAt ?? Date.parse(FIXED_NOW),
		...overrides
	};
}

/** Article quiz question (GET /v2/articles/{id}/quiz returns { questions, summary }). */
export function makeQuizQuestion(overrides: Record<string, any> = {}): Record<string, any> {
	const type = overrides.type ?? 'multiple_choice';
	const base: Record<string, any> = {
		question: overrides.question ?? 'What color is the sky on a clear day?',
		type
	};
	if (type === 'order') {
		base.items = overrides.items ?? ['First', 'Second', 'Third'];
		base.options = [];
	} else if (type === 'true_false') {
		base.options = overrides.options ?? [];
	} else {
		base.options = overrides.options ?? ['Blue', 'Green', 'Red', 'Yellow'];
		base.items = [];
	}
	return base;
}

export function makeArticleQuiz(
	overrides: { questions?: any[]; summary?: any } = {}
): Record<string, any> {
	const questions = overrides.questions ?? [makeQuizQuestion()];
	return {
		questions,
		summary: overrides.summary ?? { total: questions.length }
	};
}

/** ArticleQuizScoreResult shape returned after POST /api/article/quiz. */
export function makeQuizScoreResult(overrides: Record<string, any> = {}): Record<string, any> {
	const total = overrides.total ?? 1;
	const score = overrides.score ?? total;
	return {
		score,
		total,
		scorePercent: overrides.scorePercent ?? Math.round((score / Math.max(total, 1)) * 100),
		results: overrides.results ?? [
			{
				correct: score >= total,
				correct_answer_index: 0,
				user_answer_index: 0
			}
		]
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

export function makeReferralStats(overrides: Record<string, any> = {}): Record<string, any> {
	return {
		// code uses Crockford base32 (no I/L/O/U) - keep mocks regex-valid
		code: overrides.code ?? 'ABC234',
		clicks: overrides.clicks ?? 7,
		conversions: overrides.conversions ?? 2,
		converted_ids: overrides.converted_ids ?? ['author-1', 'host-1']
	};
}

export function makeLeaderboardEntry(overrides: Record<string, any> = {}): Record<string, any> {
	const user = overrides.user ?? makeUser({ id: overrides.id ?? 'lb-user-1', username: 'leader' });
	return {
		rank: overrides.rank ?? 1,
		value: overrides.value ?? 1000,
		user
	};
}

export function makeChallenge(overrides: Record<string, any> = {}): Record<string, any> {
	return {
		id: overrides.id ?? 'chal-1',
		quest_id: overrides.quest_id ?? 'q-current',
		quest_title: overrides.quest_title ?? 'Daily Explorer',
		challenger_id: overrides.challenger_id ?? 'author-1',
		challenger_name: overrides.challenger_name ?? '@author',
		recipient_id: overrides.recipient_id ?? 'test-user-1',
		recipient_name: overrides.recipient_name ?? '@testuser',
		status: overrides.status ?? 'pending',
		created_at: overrides.created_at ?? Date.parse(FIXED_NOW),
		...(overrides.accepted_at ? { accepted_at: overrides.accepted_at } : {})
	};
}

// --- wave-2 widget / report / admin fixtures ---

const MOOD_EMOJIS = ['😍', '😊', '🤔', '😐', '😟', '😤'] as const;

/** MoodSnapshot returned by GET/POST /v2/mood/{topic}/{date} ({ counts, total, updated_at }). */
export function makeMoodSnapshot(overrides: Record<string, any> = {}): Record<string, any> {
	const counts: Record<string, number> = { ...(overrides.counts ?? {}) };
	for (const e of MOOD_EMOJIS) if (typeof counts[e] !== 'number') counts[e] = 0;
	const total =
		typeof overrides.total === 'number'
			? overrides.total
			: Object.values(counts).reduce((a, b) => a + b, 0);
	return {
		counts,
		total,
		updated_at: overrides.updated_at ?? Date.parse(FIXED_NOW)
	};
}

/** PollVote returned by POST /v2/users/current/poll (list items come from GET). */
export function makePollVote(overrides: Record<string, any> = {}): Record<string, any> {
	const options = overrides.options ?? ['Alone', 'With Friends', 'With Family'];
	const optionIndex = overrides.option_index ?? 0;
	const counts =
		overrides.counts ?? options.map((_: string, i: number) => (i === optionIndex ? 3 : 1));
	const total = counts.reduce((a: number, b: number) => a + b, 0);
	return {
		poll_id: overrides.poll_id ?? 'q-sample',
		option_index: optionIndex,
		option_text: overrides.option_text ?? options[optionIndex] ?? null,
		question: overrides.question ?? 'Where do you do this most often?',
		options,
		voted_at: overrides.voted_at ?? Date.parse(FIXED_NOW),
		aggregate: overrides.aggregate ?? {
			counts,
			total,
			question: overrides.question ?? 'Where do you do this most often?',
			options,
			updated_at: overrides.updated_at ?? Math.floor(Date.parse(FIXED_NOW) / 1000)
		}
	};
}

/** Report returned by POST /v2/reports ({ report, deduped }). */
export function makeReport(overrides: Record<string, any> = {}): Record<string, any> {
	const id = overrides.id ?? `rpt-${Math.random().toString(36).slice(2, 8)}`;
	return {
		id,
		content_type: overrides.content_type ?? 'prompt',
		content_id: overrides.content_id ?? 'pmt-1',
		reason: overrides.reason ?? 'spam',
		description: overrides.description ?? '',
		reporter_id: overrides.reporter_id ?? null,
		source: overrides.source ?? 'user',
		status: overrides.status ?? 'pending',
		report_count: overrides.report_count ?? 1,
		created_at: overrides.created_at ?? Date.parse(FIXED_NOW),
		updated_at: overrides.updated_at ?? Date.parse(FIXED_NOW),
		...overrides
	};
}

/** Hydrated admin ReportListItem (report + preview + usernames). */
export function makeReportListItem(overrides: Record<string, any> = {}): Record<string, any> {
	return {
		...makeReport(overrides),
		content_preview: overrides.content_preview ?? 'A reported piece of content.',
		reporter_username: overrides.reporter_username ?? 'reporter',
		author_username: overrides.author_username ?? 'author'
	};
}

/** AnalyticsSnapshot returned by GET /v2/admin/analytics?since&until. */
export function makeAnalytics(overrides: Record<string, any> = {}): Record<string, any> {
	return {
		since: overrides.since ?? '2026-05-20T12:00:00.000Z',
		until: overrides.until ?? FIXED_NOW,
		by_country: overrides.by_country ?? [
			{ dimensions: { clientCountryName: 'United States' }, sum: { requests: 4200 } },
			{ dimensions: { clientCountryName: 'Canada' }, sum: { requests: 1100 } }
		],
		by_status: overrides.by_status ?? [
			{ dimensions: { edgeResponseStatus: 200 }, sum: { requests: 5000 } },
			{ dimensions: { edgeResponseStatus: 404 }, sum: { requests: 120 } }
		],
		top_paths: overrides.top_paths ?? [
			{ dimensions: { clientRequestPath: '/' }, sum: { requests: 3000, bytes: 900000 } },
			{ dimensions: { clientRequestPath: '/activities' }, sum: { requests: 800, bytes: 240000 } }
		],
		signup_funnel: overrides.signup_funnel ?? {
			signup_views: 1000,
			signups_completed: 250,
			verifications_completed: 180
		},
		configured: overrides.configured ?? true
	};
}

/** BlacklistEntry returned by GET /v2/admin/blacklist ({ entries: [...] }). */
export function makeBlacklistEntry(overrides: Record<string, any> = {}): Record<string, any> {
	const value = overrides.value ?? 'spammer';
	return {
		kind: overrides.kind ?? 'username',
		value: value.toLowerCase(),
		original_value: overrides.original_value ?? value,
		reason: overrides.reason ?? 'Known abuser',
		added_at: overrides.added_at ?? Date.parse(FIXED_NOW),
		added_by: overrides.added_by ?? 'admin'
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
