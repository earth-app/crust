import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useUser } from '~/composables/useUser';
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
