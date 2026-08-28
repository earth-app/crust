import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Composer from '~/components/user/plan/Composer.vue';

const SENTENCE = 'If I close this app, then I will walk one loop around the block.';

const menu = vi.fn();
const form = vi.fn();
const status = vi.fn();
const rehearsed = vi.fn();

mockNuxtImport('usePlan', () => () => ({ menu, form, status, rehearsed }));

const MENU = {
	goal: 'spend more time outside',
	cues: [
		{ id: 'juncture_0', kind: 'juncture', text: 'I close this app' },
		{
			id: 'time_place_0',
			kind: 'time_place',
			text: 'I am walking past Sycamore Park after school',
			place: 'Sycamore Park'
		}
	],
	responses: [
		{ id: 'response_0', text: 'walk one loop around the block' },
		{ id: 'activity_hiking', text: 'head outside for hiking', activity_id: 'hiking' }
	]
};

const stubs = { URadioGroup: true, USkeleton: true };

beforeEach(() => {
	menu.mockReset();
	form.mockReset();
	status.mockReset();
	rehearsed.mockReset();
	status.mockResolvedValue({ success: true, data: { active: false } });
	menu.mockResolvedValue({ success: true, data: MENU });
	form.mockResolvedValue({ success: true, data: { sentence: SENTENCE, expires_at: Date.now() } });
	rehearsed.mockResolvedValue({ success: true, data: { rehearsed: true } });
});

async function mount() {
	return mountSuspended(Composer, { props: { places: ['Sycamore Park'] }, global: { stubs } });
}

describe('User plan composer', () => {
	it('offers to make a plan when none is running', async () => {
		const wrapper = await mount();

		expect(wrapper.text()).toContain('Make One Plan');
		expect(wrapper.find('#plan-start').exists()).toBe(true);
		expect(wrapper.find('#plan-active').exists()).toBe(false);
	});

	// the record holds ids only, so there is nothing for this state to render even if it wanted to
	it('shows a running plan without reprinting it', async () => {
		status.mockResolvedValue({
			success: true,
			data: { active: true, expires_at: Date.now() + 3 * 24 * 60 * 60 * 1000, rehearsed: true }
		});

		const wrapper = await mount();

		expect(wrapper.find('#plan-active').exists()).toBe(true);
		expect(wrapper.text()).toContain('One Plan Running');
		expect(wrapper.text()).not.toContain('walk one loop');
		expect(wrapper.find('#plan-start').exists()).toBe(false);
	});

	it('loads the menu with the places it was given', async () => {
		const wrapper = await mount();
		await wrapper.find('#plan-start').trigger('click');
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(menu).toHaveBeenCalledWith(['Sycamore Park']);
		expect(wrapper.text()).toContain('When');
		expect(wrapper.text()).toContain('Then I Will');
		expect(wrapper.find('#plan-submit').exists()).toBe(true);
	});

	it('tells the user what to fix when there is nothing to plan from', async () => {
		menu.mockResolvedValue({ success: false, message: 'nope' });

		const wrapper = await mount();
		await wrapper.find('#plan-start').trigger('click');
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(wrapper.text()).toContain('Add a few activities first');
		expect(wrapper.find('#plan-submit').exists()).toBe(false);
	});

	it('forms one plan, shows the sentence once, and drops it after the rehearsal', async () => {
		const wrapper = await mount();

		await wrapper.find('#plan-start').trigger('click');
		await new Promise((resolve) => setTimeout(resolve, 0));

		await wrapper.find('#plan-submit').trigger('click');
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(form).toHaveBeenCalledWith('juncture_0', 'response_0');
		expect(wrapper.find('#plan-sentence').text()).toBe(SENTENCE);

		await wrapper.find('#plan-rehearse').trigger('click');
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(rehearsed).toHaveBeenCalledTimes(1);
		expect(wrapper.find('#plan-sentence').exists()).toBe(false);
		expect(wrapper.text()).not.toContain(SENTENCE);
		expect(wrapper.find('#plan-active').exists()).toBe(true);
	});

	it('keeps the plan out of view even if marking the rehearsal fails', async () => {
		rehearsed.mockRejectedValue(new Error('offline'));

		const wrapper = await mount();
		await wrapper.find('#plan-start').trigger('click');
		await new Promise((resolve) => setTimeout(resolve, 0));
		await wrapper.find('#plan-submit').trigger('click');
		await new Promise((resolve) => setTimeout(resolve, 0));

		await wrapper
			.find('#plan-rehearse')
			.trigger('click')
			.catch(() => {});
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(wrapper.text()).not.toContain(SENTENCE);
	});

	it('reports a formation failure without losing the menu', async () => {
		form.mockResolvedValue({ success: false, message: 'already active' });

		const wrapper = await mount();
		await wrapper.find('#plan-start').trigger('click');
		await new Promise((resolve) => setTimeout(resolve, 0));
		await wrapper.find('#plan-submit').trigger('click');
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(wrapper.text()).toContain('could not be saved');
		expect(wrapper.find('#plan-submit').exists()).toBe(true);
	});
});
