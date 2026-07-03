import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import MoodSpark from '~/components/widgets/MoodSpark.vue';

const snapshot = ref<any>({ counts: {}, total: 0, updated_at: 0 });
const hasVoted = ref(false);
const voteMock = vi.fn(async (_topic: string, emoji: string) => {
	snapshot.value = {
		counts: { [emoji]: 1 },
		total: 1,
		updated_at: Date.now()
	};
	return { success: true as const, snapshot: snapshot.value };
});

mockNuxtImport('useMood', () => {
	return () => ({
		snapshot,
		isLoading: ref(false),
		hasVoted,
		vote: voteMock,
		fetchSnapshot: vi.fn(async () => {}),
		EMOJIS: ['😍', '😊', '🤔', '😐', '😟', '😤'] as const
	});
});

mockNuxtImport('useToast', () => {
	return () => ({ add: vi.fn() });
});

describe('MoodSpark results view', () => {
	beforeEach(() => {
		snapshot.value = { counts: {}, total: 0, updated_at: 0 };
		hasVoted.value = false;
		voteMock.mockClear();
	});

	it('shows the emoji grid before voting', async () => {
		const wrapper = await mountSuspended(MoodSpark, { props: { topic: 'today' } });
		expect(wrapper.text()).toContain('Love');
		expect(wrapper.text()).not.toMatch(/voice(s)? today/i);
	});

	it('flips to results after a vote even when hasVoted never re-fires', async () => {
		const wrapper = await mountSuspended(MoodSpark, { props: { topic: 'today' } });

		// click the first emoji vote button
		await wrapper.get('button[aria-label="Vote Love"]').trigger('click');
		await wrapper.vm.$nextTick();
		await wrapper.vm.$nextTick();

		expect(voteMock).toHaveBeenCalledTimes(1);
		// hasVoted stayed false, but showResults folds in myVote -> results render
		expect(hasVoted.value).toBe(false);
		expect(wrapper.text()).toMatch(/voice(s)? today/i);
		expect(wrapper.find('button[aria-label="Vote Love"]').exists()).toBe(false);
	});
});
