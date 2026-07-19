import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick, ref } from 'vue';
import TrailPreview from '~/components/admin/marketing/trail/Preview.vue';
import TrailmarkStudio from '~/components/admin/marketing/TrailmarkStudio.vue';
import TrailStudio from '~/components/admin/marketing/TrailStudio.vue';
import {
	buildPreviewCreatedTrailmark,
	buildPreviewJournalEntry,
	buildPreviewRun,
	creditPreviewNatureMinutes,
	emptyTrailForm,
	emptyTrailmarkForm,
	installTrailmarkWriteLock,
	installTrailWriteLock,
	mockNatureMinutes,
	PREVIEW_PROMPT_ID,
	PREVIEW_TRAIL_ID,
	PREVIEW_TRAILMARK_ID,
	randomTrailForm,
	TRAIL_STUDIO_PRESETS,
	trailFormToTrail,
	TRAILMARK_STUDIO_PRESETS,
	trailmarkFormToTrailmark,
	trailmarkToForm,
	trailToForm,
	type TrailmarkWriteMethods,
	type TrailWriteMethods
} from '~/shared/utils/marketing';
import { trailmarkSchema, trailSchema } from '~/shared/utils/schemas';
import { useTrailmarkStore } from '~/stores/trailmark';
import { useTrailsStore } from '~/stores/trails';

// keep the studios hermetic: SceneBar / pull-live must not hit the network
vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return {
		...actual,
		makeServerRequest: vi.fn().mockResolvedValue({ success: true, data: [] }),
		makeAPIRequest: vi.fn().mockResolvedValue({ success: false, message: 'no' }),
		makeClientAPIRequest: vi.fn().mockResolvedValue({ success: false, message: 'no' }),
		invalidateAPICache: vi.fn()
	};
});

mockNuxtImport('useAuth', () => {
	return () => ({
		user: ref({ id: 'admin-1', username: 'admin', account: { account_type: 'ADMINISTRATOR' } })
	});
});

beforeEach(() => {
	setActivePinia(createPinia());
	vi.clearAllMocks();
});

// #region trail pure helpers

describe('marketingTrails factory', () => {
	it('builds a schema-valid Trail from an empty form (all required fields defaulted)', () => {
		const trail = trailFormToTrail(emptyTrailForm());
		expect(trailSchema.safeParse(trail).success).toBe(true);
		expect(trail.id).toBe(PREVIEW_TRAIL_ID);
		expect(trail.title).toBe('Untitled Trail');
		expect(trail.practice).toBe('sit_spot');
		expect(trail.curiosity.length).toBeGreaterThan(0);
		expect(trail.reveal.length).toBeGreaterThan(0);
	});

	it('carries premium / seasonal flags only when set and clamps the duration', () => {
		const trail = trailFormToTrail({
			...emptyTrailForm(),
			title: 'Deep Sit',
			duration: 999,
			premium: true,
			seasonal: true
		});
		expect(trail.premium).toBe(true);
		expect(trail.seasonal).toBe(true);
		expect(trail.duration).toBeLessThanOrEqual(180);

		const plain = trailFormToTrail(emptyTrailForm());
		expect(plain.premium).toBeUndefined();
		expect(plain.seasonal).toBeUndefined();
	});

	it('round-trips a Trail through trailToForm without losing fields', () => {
		const trail = trailFormToTrail({
			...emptyTrailForm(),
			title: 'Ridge Watch',
			theme: 'reflective',
			practice: 'sky_watch',
			rarity: 'rare',
			premium: true
		});
		const form = trailToForm(trail);
		expect(form.title).toBe('Ridge Watch');
		expect(form.theme).toBe('reflective');
		expect(form.practice).toBe('sky_watch');
		expect(form.rarity).toBe('rare');
		expect(form.premium).toBe(true);
		expect(trailFormToTrail(form).title).toBe('Ridge Watch');
	});

	it('every preset produces a schema-valid, distinct trail', () => {
		const titles = new Set<string>();
		for (const preset of TRAIL_STUDIO_PRESETS) {
			const trail = trailFormToTrail(preset.build());
			expect(trailSchema.safeParse(trail).success).toBe(true);
			titles.add(trail.title);
		}
		expect(titles.size).toBe(TRAIL_STUDIO_PRESETS.length);
	});

	it('randomTrailForm is deterministic under an injected rng', () => {
		const seq = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.15];
		let i = 0;
		const rng = () => seq[i++ % seq.length]!;
		const a = randomTrailForm(rng);
		i = 0;
		const b = randomTrailForm(rng);
		expect(a).toEqual(b);
		expect(trailSchema.safeParse(trailFormToTrail(a)).success).toBe(true);
	});
});

describe('marketingTrails nature-minutes + run stubs', () => {
	it('mockNatureMinutes clamps and seeds a trail source when minutes > 0', () => {
		const nm = mockNatureMinutes({ minutes: 45, best: 10, now: 0 });
		expect(nm.minutes).toBe(45);
		// best never drops below the current minutes
		expect(nm.best).toBe(45);
		expect(nm.sources).toHaveLength(1);
		expect(nm.sources[0]!.kind).toBe('trail');

		const empty = mockNatureMinutes({ minutes: 0 });
		expect(empty.sources).toHaveLength(0);
	});

	it('creditPreviewNatureMinutes adds minutes and lifts the personal best', () => {
		const base = mockNatureMinutes({ minutes: 20, best: 50, now: 0 });
		const next = creditPreviewNatureMinutes(base, 40, 1000);
		expect(next.minutes).toBe(60);
		expect(next.best).toBe(60);
		expect(next.sources.length).toBe(base.sources.length + 1);
	});

	it('buildPreviewRun / buildPreviewJournalEntry produce usable preview state', () => {
		const run = buildPreviewRun('t1', { when: 'after coffee' }, 0);
		expect(run.trailId).toBe('t1');
		expect(run.completed).toBe(false);
		expect(run.pledge?.when).toBe('after coffee');

		const entry = buildPreviewJournalEntry(
			{ title: 'Sit', practice: 'sit_spot' },
			't1',
			{ at: '2026-01-01T00:00:00Z' },
			15,
			0
		);
		expect(entry.title).toBe('Sit');
		expect(entry.presenceMinutes).toBe(15);
	});

	it('installTrailWriteLock swaps and restores the three write actions', () => {
		const orig = {
			startRun: vi.fn(),
			completeRun: vi.fn(),
			fetchNatureMinutes: vi.fn()
		};
		const target: TrailWriteMethods = { ...orig };
		const stub = vi.fn();
		const restore = installTrailWriteLock(target, {
			startRun: stub,
			completeRun: stub,
			fetchNatureMinutes: stub
		});
		expect(target.startRun).toBe(stub);
		expect(target.completeRun).toBe(stub);
		restore();
		expect(target.startRun).toBe(orig.startRun);
		expect(target.fetchNatureMinutes).toBe(orig.fetchNatureMinutes);
		// idempotent restore
		restore();
		expect(target.startRun).toBe(orig.startRun);
	});
});

// #region trailmark pure helpers

describe('marketingTrailmarks factory', () => {
	it('builds a schema-valid mine / not-mine / from-outside trailmark', () => {
		const mine = trailmarkFormToTrailmark(
			{ ...emptyTrailmarkForm(), isMine: true, thanksForAuthor: 5 },
			{ selfUid: 'admin-1', now: 0 }
		);
		expect(trailmarkSchema.safeParse(mine).success).toBe(true);
		expect(mine.author_uid).toBe('admin-1');
		expect(mine.thanks_for_author).toBe(5);
		expect(mine.thanked_by_me).toBeUndefined();

		const other = trailmarkFormToTrailmark(
			{ ...emptyTrailmarkForm(), isMine: false, thankedByMe: true },
			{ selfUid: 'admin-1', now: 0 }
		);
		expect(other.author_uid).not.toBe('admin-1');
		expect(other.thanked_by_me).toBe(true);
		expect(other.thanks_for_author).toBeUndefined();

		const outside = trailmarkFormToTrailmark(
			{ ...emptyTrailmarkForm(), fromOutside: true },
			{ selfUid: 'admin-1', now: 0 }
		);
		expect(outside.prompt_id).toBe(PREVIEW_PROMPT_ID);
	});

	it('round-trips through trailmarkToForm', () => {
		const mark = trailmarkFormToTrailmark(
			{ ...emptyTrailmarkForm(), isMine: true, placeLabel: 'North Pond' },
			{ selfUid: 'admin-1', now: 0 }
		);
		const form = trailmarkToForm(mark, 'admin-1');
		expect(form.isMine).toBe(true);
		expect(form.placeLabel).toBe('North Pond');
	});

	it('every preset is schema-valid and the from-outside preset links a prompt', () => {
		let sawPrompt = false;
		for (const preset of TRAILMARK_STUDIO_PRESETS) {
			const mark = trailmarkFormToTrailmark(preset.build(), { selfUid: 'admin-1', now: 0 });
			expect(trailmarkSchema.safeParse(mark).success).toBe(true);
			if (mark.prompt_id) sawPrompt = true;
		}
		expect(sawPrompt).toBe(true);
	});

	it('buildPreviewCreatedTrailmark echoes the input under a unique id', () => {
		const created = buildPreviewCreatedTrailmark(
			{ geo: { lat: 1, lng: 2 }, note: 'hello', prompt_id: 'p1' },
			{ selfUid: 'admin-1', selfUsername: 'admin', now: 123 }
		);
		expect(trailmarkSchema.safeParse(created).success).toBe(true);
		expect(created.id).toContain(PREVIEW_TRAILMARK_ID);
		expect(created.id).not.toBe(PREVIEW_TRAILMARK_ID);
		expect(created.author_uid).toBe('admin-1');
		expect(created.note).toBe('hello');
		expect(created.prompt_id).toBe('p1');
	});

	it('installTrailmarkWriteLock swaps and restores the two write actions', () => {
		const orig = { createTrailmark: vi.fn(), thankTrailmark: vi.fn() };
		const target: TrailmarkWriteMethods = { ...orig };
		const stub = vi.fn();
		const restore = installTrailmarkWriteLock(target, {
			createTrailmark: stub,
			thankTrailmark: stub
		});
		expect(target.createTrailmark).toBe(stub);
		restore();
		expect(target.createTrailmark).toBe(orig.createTrailmark);
		expect(target.thankTrailmark).toBe(orig.thankTrailmark);
	});
});

// #region panels

const trailStudioStubs = {
	AdminMarketingTrailPreview: true,
	AdminMarketingPeopleSceneBar: true,
	AdminMarketingPeoplePresent: true,
	TrailNatureRing: true
};

describe('AdminMarketingTrailStudio', () => {
	it('renders the author controls and seeds the trails store with the mock trail', async () => {
		const wrapper = await mountSuspended(TrailStudio, { global: { stubs: trailStudioStubs } });
		expect(wrapper.text()).toContain('Trail Studio');
		// the first preset drives the initial preview
		const store = useTrailsStore();
		expect(store.get(PREVIEW_TRAIL_ID)?.title).toBe(TRAIL_STUDIO_PRESETS[0]!.build().title);
		// the real TrailCard renders the mock trail title
		expect(wrapper.find('h3').exists()).toBe(true);
	});

	it('re-seeds the store when a preset is applied', async () => {
		const wrapper = await mountSuspended(TrailStudio, { global: { stubs: trailStudioStubs } });
		const store = useTrailsStore();
		const skyBtn = wrapper.findAll('button').find((b) => b.text().trim() === 'Sky Watch');
		await skyBtn!.trigger('click');
		await nextTick();
		expect(store.get(PREVIEW_TRAIL_ID)?.title).toBe('Give the Sky an Hour');
	});

	it('renders just the card in display-only mode', async () => {
		const scene = {
			id: 's1',
			name: 'Trail Demo',
			kind: 'trail' as const,
			source: 'manual' as const,
			payload: { ...emptyTrailForm(), title: 'Headless Trail' },
			created_by: 'admin',
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		};
		const wrapper = await mountSuspended(TrailStudio, {
			props: { scene, displayOnly: true },
			global: { stubs: trailStudioStubs }
		});
		expect(wrapper.text()).not.toContain('Trail Studio');
		expect(wrapper.text()).toContain('Headless Trail');
	});
});

describe('AdminMarketingTrailPreview harness', () => {
	const RunnerStub = defineComponent({
		name: 'TrailRunner',
		props: { open: Boolean, trail: Object, preview: Boolean },
		emits: ['update:open', 'begin', 'complete'],
		template: `<div class="runner"><button class="rclose" @click="$emit('update:open', false)">x</button></div>`
	});

	function mountPreview() {
		return mountSuspended(TrailPreview, {
			props: { trail: trailFormToTrail(TRAIL_STUDIO_PRESETS[0]!.build()) },
			global: { stubs: { TrailRunner: RunnerStub, AdminMarketingExportBar: true } }
		});
	}

	it('installs the trails write-lock for the full flow and restores it on close', async () => {
		const wrapper = await mountPreview();
		const store = useTrailsStore();

		const fullBtn = wrapper.findAll('button').find((b) => b.text().includes('Record Full Flow'));
		await fullBtn!.trigger('click');
		await nextTick();

		// while the harness is armed, fetchNatureMinutes is a seeded local stub (no network)
		const armed = await store.fetchNatureMinutes('admin-1');
		expect(armed.success).toBe(true);
		expect(store.natureMinutes).toBeTruthy();
		// the write-locked start never persists
		const run = await store.startRun(trailFormToTrail(TRAIL_STUDIO_PRESETS[0]!.build()));
		expect(run.completed).toBe(false);

		// closing the runner tears the harness down and restores the real store action
		await wrapper.find('.rclose').trigger('click');
		await nextTick();
		const after = await store.fetchNatureMinutes('admin-1');
		expect(after.success).toBe(false);

		wrapper.unmount();
	});
});

describe('AdminMarketingTrailmarkStudio', () => {
	const stubs = {
		TrailmarkComposer: true,
		AdminMarketingPeopleSceneBar: true,
		AdminMarketingPeoplePresent: true
	};

	it('renders the author controls and the real card with the mock note', async () => {
		const wrapper = await mountSuspended(TrailmarkStudio, { global: { stubs } });
		expect(wrapper.text()).toContain('Trailmark Studio');
		expect(wrapper.text()).toContain('look up');
		// unmount so this instance's write-lock restores and never stacks under the next mount
		wrapper.unmount();
	});

	it('write-locks the store so posting and thanking never reach the network', async () => {
		const wrapper = await mountSuspended(TrailmarkStudio, { global: { stubs } });
		const store = useTrailmarkStore();

		// the composer's Post would call this; the lock keeps it local
		const res = await store.createTrailmark({ geo: { lat: 1, lng: 2 }, note: 'preview note' });
		expect(res.success).toBe(true);
		expect(res.data!.id).toContain(PREVIEW_TRAILMARK_ID);
		expect(store.mine).toContain(res.data!.id);

		// seed a not-mine mark and thank it locally
		store.upsert({
			id: 'other-1',
			author_uid: 'someone',
			author_username: 'someone',
			geo: { lat: 1, lng: 2 },
			note: 'kind note',
			created_at: new Date().toISOString()
		});
		const thanked = await store.thankTrailmark('other-1');
		expect(thanked.success).toBe(true);
		expect(store.get('other-1')?.thanked_by_me).toBe(true);

		// the network layer was never touched
		const utils = await import('utils');
		expect(utils.makeClientAPIRequest).not.toHaveBeenCalled();

		wrapper.unmount();
		// after unmount the real store action is restored (no longer the preview stub)
		const restored = await store.createTrailmark({ geo: { lat: 1, lng: 2 }, note: 'x' });
		expect(restored.success).toBe(false);
	});
});
