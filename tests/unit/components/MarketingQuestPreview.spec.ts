import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defineComponent, nextTick, ref } from 'vue';
import Preview from '~/components/admin/marketing/quest/Preview.vue';
import { useQuestCelebration } from '~/composables/useUser';
import { PREVIEW_QUEST_ID } from '~/shared/utils/marketing';

mockNuxtImport('useAuth', () => {
	return () => ({ user: ref({ id: 'admin-1', account: { account_type: 'PRO' } }) });
});

// stub the real quest modal with a close control so we can drive an on-its-own modal close
const ModalStub = defineComponent({
	name: 'UserQuestModal',
	props: { open: Boolean, quest: Object, progress: Array, completedAt: Number },
	emits: ['update:open'],
	template: `<div class="quest-modal-stub"><button class="modal-close" @click="$emit('update:open', false)">x</button></div>`
});

const quest = {
	id: PREVIEW_QUEST_ID,
	title: 'Nature Demo',
	description: 'A short demo quest.',
	icon: 'mdi:pine-tree',
	rarity: 'normal',
	steps: [{ type: 'describe_text', description: 'Reflect on today.', parameters: [] }],
	reward: 120
};

async function mountPreview() {
	return mountSuspended(Preview, {
		props: { quest },
		global: {
			stubs: {
				UserQuestModal: ModalStub,
				UserQuestCompletionOverlay: true,
				UserQuestChallengeBanner: true,
				AdminMarketingExportBar: true
			}
		}
	});
}

describe('Quest Studio preview — regression', () => {
	beforeEach(() => useQuestCelebration().closeCelebration());
	afterEach(() => useQuestCelebration().closeCelebration());

	// BUG 2: the preview-controls card must return after ANY modal close (present desync)
	it('keeps the preview-controls card after the modal closes from present mode', async () => {
		const wrapper = await mountPreview();
		expect(wrapper.text()).toContain('Open Quest Modal');

		wrapper.vm.enterPresent();
		await nextTick();
		await nextTick();
		// present mode hides the controls card
		expect(wrapper.text()).not.toContain('Open Quest Modal');

		// close the modal on its own (header X / dismiss), NOT via Exit Present
		await wrapper.find('.modal-close').trigger('click');
		await nextTick();
		await nextTick();

		// fixed: card comes back instead of leaving a blank present shell
		expect(wrapper.text()).toContain('Open Quest Modal');
	});

	// BUG 3: a completion celebration fired from inside the previewed modal must be
	// suppressed (no real app-wide points overlay) while preview is active
	it('suppresses the global completion celebration while previewing', async () => {
		const celebration = useQuestCelebration();
		const wrapper = await mountPreview();

		wrapper.vm.enterPresent();
		await nextTick();

		celebration.triggerCelebration({ questId: quest.id, questTitle: quest.title, points: 120 });
		// the sync-flush guard reverts open before the app overlay can paint
		expect(celebration.open.value).toBe(false);

		// once preview tears down, the real celebration path works again
		await wrapper.find('.modal-close').trigger('click');
		await nextTick();
		celebration.triggerCelebration({ questId: quest.id, points: 120 });
		expect(celebration.open.value).toBe(true);
		celebration.closeCelebration();
	});
});
