import type {
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
	UserQuestProgress
} from '../types/user';

// pure, side-effect-free logic for the admin Marketing quest studio (preview only).
// the builder mock factory, the progress simulator, and the seed/restore + write-lock
// helpers all live here so they can be unit-tested without mounting the real modal.

// #region constants

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

// #region builder types

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

// #region builder factory

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

// #region templates

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

// #region progress simulation

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

// #region seed / restore (pure over plain Maps - the store's reactive Maps satisfy this)

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

// #region write-lock

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

// #region challenge mock

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
