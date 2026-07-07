import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useAuth, useUser } from '~/composables/useUser';
import { useUserStore } from '~/stores/user';

// the moderation gate uses the test-build signature hook, so no model mocking is needed here
function setTestBuild(on: boolean) {
	(useRuntimeConfig().public as any).testBuild = on;
}

describe('useUser().updateQuest content-safety gate', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		setTestBuild(true);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		setTestBuild(false);
	});

	it('blocks an explicit image submission before it reaches the store', async () => {
		const store = useUserStore();
		const spy = vi.spyOn(store, 'updateQuest');

		const { updateQuest } = useUser('123');
		const res = await updateQuest(
			{
				type: 'take_photo_classification',
				index: 0,
				dataUrl: 'data:image/png;base64,EARTHAPP_MOD_NSFW_PAYLOAD'
			},
			0,
			0
		);

		expect(res.validated).toBe(false);
		expect(res.message).toMatch(/explicit content/i);
		expect(spy).not.toHaveBeenCalled();
	});

	it('allows a clean submission through to the store', async () => {
		const store = useUserStore();
		const spy = vi
			.spyOn(store, 'updateQuest')
			.mockResolvedValue({ message: 'ok', completed: false, validated: true });

		const { updateQuest } = useUser('123');
		const res = await updateQuest({ type: 'order_items', index: 0 }, 0, 0);

		expect(res.validated).toBe(true);
		expect(spy).toHaveBeenCalledTimes(1);
	});
});

describe('useUser() quest fetch identifier-change guard', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('drops a fetchUserQuest result whose identifier changed mid-flight', async () => {
		const store = useUserStore();
		const id = ref('alice');
		let resolveFetch!: (v: any) => void;
		const spy = vi
			.spyOn(store, 'fetchUserQuest')
			.mockReturnValue(new Promise((r) => (resolveFetch = r)) as any);

		const { fetchUserQuest } = useUser(id);
		const p = fetchUserQuest();
		// rapid user switch before the in-flight fetch resolves
		id.value = 'bob';
		resolveFetch({ questId: 'q-alice', quest: { id: 'q-alice' } });

		expect(await p).toBeNull();
		expect(spy).toHaveBeenCalledWith('alice', false);
	});

	it('returns the fetchUserQuest result when the identifier is unchanged', async () => {
		const store = useUserStore();
		const id = ref('alice');
		const quest = { questId: 'q1', quest: { id: 'q1' } };
		vi.spyOn(store, 'fetchUserQuest').mockResolvedValue(quest as any);

		const { fetchUserQuest } = useUser(id);
		expect(await fetchUserQuest()).toEqual(quest);
	});

	it('drops a fetchQuestHistory result whose identifier changed mid-flight', async () => {
		const store = useUserStore();
		const id = ref('alice');
		let resolveFetch!: (v: any) => void;
		vi.spyOn(store, 'fetchQuestHistory').mockReturnValue(
			new Promise((r) => (resolveFetch = r)) as any
		);

		const { fetchQuestHistory } = useUser(id);
		const p = fetchQuestHistory();
		id.value = 'bob';
		resolveFetch(new Map([['q1', { questId: 'q1' }]]));

		const res = await p;
		// stale result dropped -> empty map for the now-current identifier
		expect(res.size).toBe(0);
	});
});

describe('useUser() badges reactivity + fresh fetch', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('badges is empty until the id resolves, then reflects the resolved user list', () => {
		const store = useUserStore();
		const id = ref<string | undefined>(undefined);
		const { badges } = useUser(id);

		// list already cached under alice, but there is no resolved id yet -> empty
		store.badges.set('alice', [{ id: 'b1', granted: true } as any]);
		expect(badges.value).toEqual([]);

		// id resolves late -> the computed re-tracks and surfaces alice's badges
		id.value = 'alice';
		expect(badges.value).toEqual([{ id: 'b1', granted: true }]);
	});

	it('reacts when the store map is populated after the id is already set', () => {
		const store = useUserStore();
		const { badges } = useUser('alice');
		expect(badges.value).toEqual([]);

		// a late fetch writes into the reactive map -> computed updates, no remount
		store.badges.set('alice', [{ id: 'b2', granted: true } as any]);
		expect(badges.value).toEqual([{ id: 'b2', granted: true }]);
	});

	it('fetchBadges(true) threads force through to the store', async () => {
		const store = useUserStore();
		const spy = vi.spyOn(store, 'fetchBadges').mockResolvedValue([]);

		const { fetchBadges } = useUser('alice');
		await fetchBadges(true);

		expect(spy).toHaveBeenCalledWith('alice', true);
	});

	it('fetchBadges() defaults force to false', async () => {
		const store = useUserStore();
		const spy = vi.spyOn(store, 'fetchBadges').mockResolvedValue([]);

		const { fetchBadges } = useUser('alice');
		await fetchBadges();

		expect(spy).toHaveBeenCalledWith('alice', false);
	});
});

describe('useAuth().fetchCurrentJourney missing-id guard', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it('returns a non-success result (never a fake count:0) when the id is empty', async () => {
		const serverRequest = vi.fn();
		const { fetchCurrentJourney } = useAuth(serverRequest as any);

		const res = await fetchCurrentJourney('article', '');

		expect(res.success).toBe(false);
		expect((res as any).data?.count).toBeUndefined();
		// short-circuits before any network call
		expect(serverRequest).not.toHaveBeenCalled();
	});

	it('hits the server (and can return a real count) once an id is present', async () => {
		const serverRequest = vi.fn().mockResolvedValue({ success: true, data: { count: 7 } });
		const { fetchCurrentJourney } = useAuth(serverRequest as any);

		const res = await fetchCurrentJourney('article', 'user-1');

		expect(serverRequest).toHaveBeenCalledTimes(1);
		expect(res.success).toBe(true);
		expect((res as any).data.count).toBe(7);
	});
});
