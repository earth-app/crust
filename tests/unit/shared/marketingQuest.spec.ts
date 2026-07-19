import { createPinia, setActivePinia } from 'pinia';
import type {
	Quest,
	QuestHistoryEntry,
	QuestProgressEntry,
	QuestStep,
	UserQuestProgress
} from 'types/user';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return {
		...actual,
		makeAPIRequest: vi.fn(),
		makeClientAPIRequest: vi.fn(),
		makeServerRequest: vi.fn()
	};
});

import { makeAPIRequest, makeServerRequest } from 'utils';
import {
	applyPreviewSubmit,
	buildProgress,
	buildQuestSteps,
	clearActiveQuest,
	completedQuestProgress,
	emptyBuilderQuest,
	freshQuestProgress,
	installQuestWriteLock,
	MASTERY_PREVIEW_QUEST_ID,
	mockChallengeView,
	mockProgressEntry,
	newBuilderStep,
	partialQuestProgress,
	PREVIEW_QUEST_ID,
	QUEST_TEMPLATES,
	questTemplate,
	restoreQuestState,
	seedActiveQuest,
	seedCompletedHistory,
	snapshotQuestState,
	toHistoryEntry,
	toPreviewQuest,
	type BuilderStep,
	type QuestStateMaps
} from '~/shared/utils/marketing';
import { useUserStore } from '~/stores/user';

// small helper - a valid preview quest with N single steps
function makeQuest(over: Partial<Quest> = {}): Quest {
	return toPreviewQuest({
		...emptyBuilderQuest(),
		title: 'Test Quest',
		steps: [
			newBuilderStep({ type: 'describe_text', description: 'Write one' }),
			newBuilderStep({ type: 'take_photo_caption', description: 'Snap one' })
		],
		...(over as any)
	});
}

describe('buildQuestSteps', () => {
	it('emits plain steps and strips builder-only fields', () => {
		const steps: BuilderStep[] = [
			newBuilderStep({ type: 'describe_text', description: '  Reflect  ', reward: 20 })
		];
		const out = buildQuestSteps(steps);
		expect(out).toHaveLength(1);
		expect(out[0]).toEqual({
			type: 'describe_text',
			description: 'Reflect',
			parameters: [],
			reward: 20
		});
		// no _id / groupId leak
		expect(out[0]).not.toHaveProperty('_id');
		expect(out[0]).not.toHaveProperty('groupId');
	});

	it('collapses consecutive same-groupId steps into one alt-group array', () => {
		const steps: BuilderStep[] = [
			newBuilderStep({ type: 'match_terms', description: 'A', groupId: 'g1' }),
			newBuilderStep({ type: 'order_items', description: 'B', groupId: 'g1' }),
			newBuilderStep({ type: 'describe_text', description: 'C' })
		];
		const out = buildQuestSteps(steps);
		expect(out).toHaveLength(2);
		expect(Array.isArray(out[0])).toBe(true);
		expect((out[0] as any[]).map((s) => s.type)).toEqual(['match_terms', 'order_items']);
		expect(Array.isArray(out[1])).toBe(false);
	});

	it('collapses a single-member group back to a plain step', () => {
		const out = buildQuestSteps([
			newBuilderStep({ type: 'describe_text', description: 'solo', groupId: 'lonely' })
		]);
		expect(Array.isArray(out[0])).toBe(false);
		expect((out[0] as any).type).toBe('describe_text');
	});

	it('coerces reward/delay and drops zero/empty values', () => {
		const out = buildQuestSteps([
			newBuilderStep({ type: 'describe_text', description: 'x', reward: 0, delay: 3.9 })
		]);
		expect(out[0]).not.toHaveProperty('reward');
		expect((out[0] as any).delay).toBe(3);
	});

	it('forces mobile_only on the always-mobile step types', () => {
		const out = buildQuestSteps([
			newBuilderStep({ type: 'scan_barcode', description: 'scan' }),
			newBuilderStep({ type: 'distance_covered', description: 'walk' })
		]);
		expect((out[0] as any).mobile_only).toBe(true);
		expect((out[1] as any).mobile_only).toBe(true);
	});

	it('keeps a trimmed tutorial_hint and drops an empty one', () => {
		const out = buildQuestSteps([
			newBuilderStep({ type: 'describe_text', description: 'a', tutorial_hint: '  tip  ' }),
			newBuilderStep({ type: 'describe_text', description: 'b', tutorial_hint: '   ' })
		]);
		expect((out[0] as any).tutorial_hint).toBe('tip');
		expect(out[1]).not.toHaveProperty('tutorial_hint');
	});
});

describe('toPreviewQuest', () => {
	it('uses the throwaway preview id by default', () => {
		expect(makeQuest().id).toBe(PREVIEW_QUEST_ID);
	});

	it('uses the badge_mastery id when the mastery flag is set', () => {
		const q = makeQuest({ mastery: true } as any);
		expect(q.id).toBe(MASTERY_PREVIEW_QUEST_ID);
		expect(q.id.startsWith('badge_mastery_')).toBe(true);
	});

	it('only sets premium/mobile_only/permissions when truthy', () => {
		const plain = makeQuest();
		expect(plain).not.toHaveProperty('premium');
		expect(plain).not.toHaveProperty('mobile_only');
		expect(plain).not.toHaveProperty('permissions');

		const rich = makeQuest({ premium: true, mobile_only: true, permissions: ['camera'] } as any);
		expect(rich.premium).toBe(true);
		expect(rich.mobile_only).toBe(true);
		expect(rich.permissions).toEqual(['camera']);
	});

	it('falls back to a default title and coerces the reward', () => {
		const q = toPreviewQuest({
			...emptyBuilderQuest(),
			title: '   ',
			reward: -5 as any,
			steps: []
		});
		expect(q.title).toBe('Untitled Quest');
		expect(q.reward).toBe(0);
	});
});

describe('templates', () => {
	it('ships four curated templates that each build a non-empty quest', () => {
		expect(QUEST_TEMPLATES).toHaveLength(4);
		for (const t of QUEST_TEMPLATES) {
			const quest = toPreviewQuest(t.build());
			expect(quest.steps.length).toBeGreaterThan(0);
			expect(quest.title.length).toBeGreaterThan(0);
		}
	});

	it('the mixed template contains an either/or alt-group', () => {
		const quest = toPreviewQuest(questTemplate('mixed')!);
		expect(quest.steps.some((s) => Array.isArray(s))).toBe(true);
	});

	it('returns null for an unknown template id', () => {
		expect(questTemplate('nope')).toBeNull();
	});
});

describe('mockProgressEntry', () => {
	it('attaches an image data url for photo/draw steps', () => {
		expect(mockProgressEntry('take_photo_location', 0).data).toMatch(/^data:image\/svg/);
		expect(mockProgressEntry('draw_picture', 0).data).toMatch(/^data:image\/svg/);
	});

	it('adds a caption prompt and a describe-text body', () => {
		expect(mockProgressEntry('take_photo_caption', 0).prompt).toBeTruthy();
		expect(mockProgressEntry('describe_text', 0).text).toBeTruthy();
	});

	it('gives article_quiz a score but no scoreKey (avoids a live article fetch)', () => {
		const e = mockProgressEntry('article_quiz', 0);
		expect(e.score).toBeGreaterThan(0);
		expect(e).not.toHaveProperty('scoreKey');
	});

	it('carries index/altIndex/submittedAt through', () => {
		const e = mockProgressEntry('describe_text', 2, 1, 1000);
		expect(e.index).toBe(2);
		expect(e.altIndex).toBe(1);
		expect(e.submittedAt).toBe(1000);
	});
});

describe('progress builders', () => {
	it('buildProgress fills only the first N slots and wraps alt-groups in arrays', () => {
		const quest = toPreviewQuest({
			...emptyBuilderQuest(),
			steps: [
				newBuilderStep({ type: 'describe_text', description: 'a' }),
				newBuilderStep({ type: 'match_terms', description: 'b', groupId: 'g' }),
				newBuilderStep({ type: 'order_items', description: 'c', groupId: 'g' })
			]
		});
		// quest.steps => [single, [alt, alt]]
		const prog = buildProgress(quest, 2, 1000);
		expect(prog).toHaveLength(2);
		expect(Array.isArray(prog[0])).toBe(false);
		expect(Array.isArray(prog[1])).toBe(true);
		expect((prog[1] as QuestProgressEntry[])[0].altIndex).toBe(0);
	});

	it('freshQuestProgress starts empty and not completed', () => {
		const p = freshQuestProgress(makeQuest());
		expect(p.progress).toEqual([]);
		expect(p.currentStepIndex).toBe(0);
		expect(p.completed).toBe(false);
	});

	it('partialQuestProgress marks some steps done without completing the quest', () => {
		const p = partialQuestProgress(makeQuest(), 1, 1000);
		expect(p.progress).toHaveLength(1);
		expect(p.completed).toBe(false);
		expect(p.currentStepIndex).toBe(1);
	});

	it('completedQuestProgress fills every slot and flags completed', () => {
		const quest = makeQuest();
		const p = completedQuestProgress(quest, 1000);
		expect(p.progress).toHaveLength(quest.steps.length);
		expect(p.completed).toBe(true);
		expect(p.currentStepIndex).toBe(quest.steps.length);
	});

	it('toHistoryEntry carries completedAt and full progress', () => {
		const quest = makeQuest();
		const entry = toHistoryEntry(quest, 5000, 1000);
		expect(entry.questId).toBe(quest.id);
		expect(entry.completedAt).toBe(5000);
		expect(entry.progress).toHaveLength(quest.steps.length);
	});
});

describe('applyPreviewSubmit', () => {
	it('advances to the next step and reports validated + not-yet-completed', () => {
		const quest = makeQuest(); // 2 single steps
		const start = freshQuestProgress(quest);
		const { next, result } = applyPreviewSubmit(start, { type: 'describe_text', index: 0 }, 1000);
		expect(result.validated).toBe(true);
		expect(result.completed).toBe(false);
		expect(next.currentStepIndex).toBe(1);
		expect(next.progress[0]).toBeTruthy();
	});

	it('flags the quest completed once the final step lands', () => {
		const quest = makeQuest();
		let state = freshQuestProgress(quest);
		state = applyPreviewSubmit(state, { type: 'describe_text', index: 0 }, 1000).next;
		const last = applyPreviewSubmit(state, { type: 'take_photo_caption', index: 1 }, 2000);
		expect(last.result.completed).toBe(true);
		expect(last.next.completed).toBe(true);
		expect(last.next.currentStepIndex).toBe(quest.steps.length);
	});

	it('records an alt submission under the right altIndex and completes the group', () => {
		const quest = toPreviewQuest({
			...emptyBuilderQuest(),
			steps: [
				newBuilderStep({ type: 'match_terms', description: 'a', groupId: 'g' }),
				newBuilderStep({ type: 'order_items', description: 'b', groupId: 'g' })
			]
		});
		// quest.steps => [[alt0, alt1]]
		const start = freshQuestProgress(quest);
		const { next, result } = applyPreviewSubmit(
			start,
			{ type: 'order_items', index: 0, altIndex: 1 },
			1000
		);
		expect(Array.isArray(next.progress[0])).toBe(true);
		expect((next.progress[0] as QuestProgressEntry[])[0].altIndex).toBe(1);
		expect(result.completed).toBe(true);
	});

	it('does not mutate the input progress array', () => {
		const quest = makeQuest();
		const start = freshQuestProgress(quest);
		applyPreviewSubmit(start, { type: 'describe_text', index: 0 }, 1000);
		expect(start.progress).toEqual([]);
	});
});

describe('snapshot / seed / restore', () => {
	function emptyMaps(): QuestStateMaps {
		return { quest: new Map(), questHistory: new Map() };
	}

	it('restores to nothing when the user had no prior quest state', () => {
		const maps = emptyMaps();
		const snap = snapshotQuestState(maps, 'admin');
		seedActiveQuest(maps, 'admin', freshQuestProgress(makeQuest()));
		seedCompletedHistory(maps, 'admin', toHistoryEntry(makeQuest(), 1, 1));
		expect(maps.quest.has('admin')).toBe(true);
		expect(maps.questHistory.has('admin')).toBe(true);

		restoreQuestState(maps, 'admin', snap);
		expect(maps.quest.has('admin')).toBe(false);
		expect(maps.questHistory.has('admin')).toBe(false);
	});

	it('restores the exact prior active quest + history', () => {
		const maps = emptyMaps();
		const realQuest: UserQuestProgress = freshQuestProgress(makeQuest());
		maps.quest.set('admin', realQuest);
		const realHistory = new Map<string, QuestHistoryEntry>();
		realHistory.set('real', toHistoryEntry(makeQuest(), 42, 1));
		maps.questHistory.set('admin', realHistory);

		const snap = snapshotQuestState(maps, 'admin');
		seedActiveQuest(maps, 'admin', partialQuestProgress(makeQuest(), 1, 1));
		clearActiveQuest(maps, 'admin');
		seedCompletedHistory(maps, 'admin', toHistoryEntry(makeQuest(), 99, 1));

		restoreQuestState(maps, 'admin', snap);
		expect(maps.quest.get('admin')).toBe(realQuest);
		expect(maps.questHistory.get('admin')!.has('real')).toBe(true);
		expect(maps.questHistory.get('admin')!.has(PREVIEW_QUEST_ID)).toBe(false);
	});

	it('snapshots history by value so later seeding cannot corrupt it', () => {
		const maps = emptyMaps();
		maps.questHistory.set('admin', new Map([['real', toHistoryEntry(makeQuest(), 1, 1)]]));
		const snap = snapshotQuestState(maps, 'admin');
		// mutate the live history after snapshotting
		seedCompletedHistory(maps, 'admin', toHistoryEntry(makeQuest(), 2, 1));
		expect(snap.history!.has(PREVIEW_QUEST_ID)).toBe(false);
		expect(snap.history!.size).toBe(1);
	});

	it('never touches an unrelated user', () => {
		const maps = emptyMaps();
		const other = freshQuestProgress(makeQuest());
		maps.quest.set('other', other);
		const snap = snapshotQuestState(maps, 'admin');
		seedActiveQuest(maps, 'admin', freshQuestProgress(makeQuest()));
		restoreQuestState(maps, 'admin', snap);
		expect(maps.quest.get('other')).toBe(other);
	});
});

describe('installQuestWriteLock', () => {
	it('installs stubs and restores the originals on teardown', () => {
		const startQuest = vi.fn(() => 'real-start');
		const updateQuest = vi.fn(() => 'real-update');
		const endQuest = vi.fn(() => 'real-end');
		const target = { startQuest, updateQuest, endQuest };

		const stubUpdate = vi.fn(() => 'stub-update');
		const stubEnd = vi.fn(() => 'stub-end');
		const restore = installQuestWriteLock(target, { updateQuest: stubUpdate, endQuest: stubEnd });

		expect(target.updateQuest()).toBe('stub-update');
		expect(target.endQuest()).toBe('stub-end');
		// start was not overridden, stays real
		expect(target.startQuest()).toBe('real-start');
		expect(updateQuest).not.toHaveBeenCalled();

		restore();
		expect(target.updateQuest).toBe(updateQuest);
		expect(target.endQuest).toBe(endQuest);
	});

	it('is idempotent - a second restore is a no-op', () => {
		const original = vi.fn();
		const target = { startQuest: original, updateQuest: original, endQuest: original };
		const restore = installQuestWriteLock(target, { updateQuest: vi.fn() });
		restore();
		const afterFirst = target.updateQuest;
		restore();
		expect(target.updateQuest).toBe(afterFirst);
	});
});

describe('mockChallengeView', () => {
	it('puts the admin id in the recipient slot for a pending challenge', () => {
		const view = mockChallengeView(makeQuest(), 'admin-id', { status: 'pending' });
		expect(view.challenge!.recipient_id).toBe('admin-id');
		expect(view.challenge!.status).toBe('pending');
		expect(view.other_user!.id).not.toBe('admin-id');
	});

	it('puts the admin id in the challenger slot for an active challenge', () => {
		const view = mockChallengeView(makeQuest(), 'admin-id', { status: 'active' });
		expect(view.challenge!.challenger_id).toBe('admin-id');
		expect(view.other_progress!.total_steps).toBe(makeQuest().steps.length);
	});
});

// integration guard: the whole preview safety story runs against the REAL Pinia user store,
// proving the write-lock + seed/restore never let a network helper fire (this is the crux
// of the "never hits prod / never clobbers the admin's real quest" contract)
describe('preview safety against the live user store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.resetAllMocks();
	});

	it('swaps the three write actions on the live store and restores them', () => {
		const store = useUserStore();
		const originalUpdate = store.updateQuest;
		const originalEnd = store.endQuest;
		const stub = vi.fn(async () => ({ message: '', completed: false, validated: true }));
		const restore = installQuestWriteLock(store, { updateQuest: stub, endQuest: stub });

		expect(store.updateQuest).toBe(stub);
		expect(store.endQuest).toBe(stub);

		restore();
		expect(store.updateQuest).toBe(originalUpdate);
		expect(store.endQuest).toBe(originalEnd);
	});

	it('a seeded active quest short-circuits fetchUserQuest (no network read)', async () => {
		const store = useUserStore();
		const quest = makeQuest();
		seedActiveQuest(
			{ quest: store.quest, questHistory: store.questHistory },
			'admin',
			freshQuestProgress(quest)
		);

		const res = await store.fetchUserQuest('admin', false);
		expect(res?.questId).toBe(quest.id);
		expect(makeAPIRequest).not.toHaveBeenCalled();
	});

	it('the update stub advances progress locally with no server request', async () => {
		const store = useUserStore();
		const quest = makeQuest();
		const maps = { quest: store.quest, questHistory: store.questHistory };
		seedActiveQuest(maps, 'admin', freshQuestProgress(quest));

		const restore = installQuestWriteLock(store, {
			startQuest: async () => ({ message: '' }),
			endQuest: async () => ({ message: '' }),
			updateQuest: async (
				_id: string,
				stepResponse: { type: string; index: number; altIndex?: number }
			) => {
				const cur = store.quest.get('admin')!;
				const { next, result } = applyPreviewSubmit(cur, stepResponse);
				store.quest.set('admin', next);
				return result;
			}
		});

		const out = await store.updateQuest(
			'admin',
			{ type: (quest.steps[0] as QuestStep).type, index: 0 },
			0,
			0
		);

		expect(out.validated).toBe(true);
		expect(makeServerRequest).not.toHaveBeenCalled();
		expect(store.quest.get('admin')!.progress).toHaveLength(1);
		restore();
	});

	it('restores the admin real active quest verbatim after a preview session', () => {
		const store = useUserStore();
		const maps = { quest: store.quest, questHistory: store.questHistory };
		const realQuest = freshQuestProgress(makeQuest());
		store.quest.set('admin', realQuest);

		const snap = snapshotQuestState(maps, 'admin');
		// simulate a full preview: seed in-progress, then a completed replay
		seedActiveQuest(maps, 'admin', partialQuestProgress(makeQuest(), 1));
		clearActiveQuest(maps, 'admin');
		seedCompletedHistory(maps, 'admin', toHistoryEntry(makeQuest(), 1, 1));

		restoreQuestState(maps, 'admin', snap);
		// the reactive store Map proxies values on get, so assert by shape: the restored
		// entry is the admin's original fresh quest (empty progress), not the seeded preview
		const restored = store.quest.get('admin');
		expect(restored?.questId).toBe(realQuest.questId);
		expect(restored?.progress).toHaveLength(0);
		expect(store.questHistory.has('admin')).toBe(false);
	});
});
