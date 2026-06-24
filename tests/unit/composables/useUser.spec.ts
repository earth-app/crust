import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
