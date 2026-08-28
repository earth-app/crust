import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Card from '~/components/user/memory/Card.vue';

const list = vi.fn();
const fetchQuestHistoryEntry = vi.fn();

mockNuxtImport('useMemories', () => () => ({ list }));
mockNuxtImport('useAuthStore', () => () => ({ currentUser: { id: '42' } }));
mockNuxtImport('useUserStore', () => () => ({ fetchQuestHistoryEntry }));

const PHOTO = 'data:image/jpeg;base64,AAAA';

const QUEST_MEMORY = {
	kind: 'quest',
	id: 'first_light_walk',
	title: 'First Light',
	icon: 'mdi:weather-sunset-up',
	completedAt: Date.UTC(2025, 7, 26),
	yearsAgo: 1,
	photo: true
};

const TRAIL_MEMORY = {
	kind: 'trail',
	id: 'sit_spot_dawn',
	title: 'Dawn Sit Spot',
	completedAt: Date.UTC(2023, 7, 26),
	yearsAgo: 3,
	note: 'the light on the water'
};

beforeEach(() => {
	list.mockReset();
	fetchQuestHistoryEntry.mockReset();
	list.mockResolvedValue({ success: true, data: { memories: [QUEST_MEMORY, TRAIL_MEMORY] } });
	fetchQuestHistoryEntry.mockResolvedValue({
		progress: [[{ type: 'take_photo_validation', submittedAt: 1, data: PHOTO }]]
	});
});

describe('User memory card', () => {
	it('shows what the user did on this day in an earlier year', async () => {
		const wrapper = await mountSuspended(Card);

		expect(wrapper.find('#user-memories').exists()).toBe(true);
		expect(wrapper.text()).toContain('On This Day');
		expect(wrapper.text()).toContain('First Light');
		expect(wrapper.text()).toContain('1 Year Ago Today');
		expect(wrapper.text()).toContain('3 Years Ago Today');
		expect(wrapper.text()).toContain('the light on the water');
	});

	// the photo path is the existing quest history endpoint, asked for once and only when kept
	it('pulls the photo from the quest history entry', async () => {
		const wrapper = await mountSuspended(Card);

		// the lean flag matters: without it the card pays for a base64 copy of every image step
		expect(fetchQuestHistoryEntry).toHaveBeenCalledWith('42', 'first_light_walk', {
			firstImageOnly: true
		});
		expect(wrapper.find('#memory-photo').attributes('src')).toBe(PHOTO);
	});

	it('never asks for a photo when no memory kept one', async () => {
		list.mockResolvedValue({ success: true, data: { memories: [TRAIL_MEMORY] } });

		const wrapper = await mountSuspended(Card);

		expect(fetchQuestHistoryEntry).not.toHaveBeenCalled();
		expect(wrapper.find('#memory-photo').exists()).toBe(false);
		expect(wrapper.text()).toContain('Dawn Sit Spot');
	});

	// no empty state, no invitation to come back next year
	it('renders nothing at all when there is nothing', async () => {
		list.mockResolvedValue({ success: true, data: { memories: [] } });

		const wrapper = await mountSuspended(Card);

		expect(wrapper.find('#user-memories').exists()).toBe(false);
		expect(wrapper.text()).toBe('');
	});

	it('renders nothing when the request fails', async () => {
		list.mockResolvedValue({ success: false, message: 'nope' });

		const wrapper = await mountSuspended(Card);
		expect(wrapper.find('#user-memories').exists()).toBe(false);
	});

	it('renders nothing when the request throws', async () => {
		list.mockRejectedValue(new Error('offline'));

		const wrapper = await mountSuspended(Card);
		expect(wrapper.find('#user-memories').exists()).toBe(false);
	});

	it('still shows the memories when the photo cannot be read', async () => {
		fetchQuestHistoryEntry.mockResolvedValue(null);

		const wrapper = await mountSuspended(Card);

		expect(wrapper.find('#memory-photo').exists()).toBe(false);
		expect(wrapper.text()).toContain('First Light');
	});
});
