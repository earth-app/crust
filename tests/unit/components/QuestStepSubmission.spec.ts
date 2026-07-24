import { mountSuspended } from '@nuxt/test-utils/runtime';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Submission from '~/components/user/quest/step/Submission.vue';

// no network is exercised by the passive branch, but useAuth/useUser resolve the wire
// helpers on mount; stub them so nothing hits a real endpoint
vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return {
		...actual,
		makeAPIRequest: vi.fn().mockResolvedValue({ success: false, message: 'no' }),
		makeClientAPIRequest: vi.fn().mockResolvedValue({ success: false, message: 'no' }),
		makeServerRequest: vi.fn().mockResolvedValue({ success: false, message: 'no' })
	};
});

const quest = {
	id: 'q-nature',
	title: 'Get Outside',
	description: 'A quest that ends in the real world.',
	icon: 'mdi:trophy',
	rarity: 'normal',
	reward: 25,
	steps: []
} as any;

// a fully-unlocked, current, not-yet-completed step so we reach the interactive area
// (not the "start this quest" / "complete previous steps" / "already completed" guards)
function step(type: string, icon: string) {
	return {
		type,
		description: `Complete the ${type} step`,
		parameters: [],
		icon,
		completed: false,
		index: 0,
		isCurrentQuest: true,
		isUnlocked: true
	} as any;
}

beforeEach(() => {
	setActivePinia(createPinia());
	vi.clearAllMocks();
});

// the two v0.6.0 step types are completed OUTSIDE the web submit flow (native / passive
// backend credit), so Submission.vue must render the passive "dedicated interface" branch
// for them - never a capture control, a read-time bar, or a submit-error alert.
describe.each([
	['nature_minutes', 'mdi:leaf-maple'],
	['trailmarker_added', 'mdi:map-marker-check']
])('QuestStepSubmission passive render for %s', (type, icon) => {
	it('renders the passive "dedicated interface" branch, not an interactive control', async () => {
		const wrapper = await mountSuspended(Submission, {
			props: { quest, step: step(type, icon) }
		});
		const text = wrapper.text();

		// the passive fallback copy
		expect(text).toContain('This step is completed through its dedicated interface.');
		// the step description + its type-specific icon still render in the header
		expect(text).toContain(`Complete the ${type} step`);
		expect(wrapper.html()).toContain(icon);
	});

	it('shows no capture, no read-time bar, no submit-error alert, and no lock/complete guard', async () => {
		const wrapper = await mountSuspended(Submission, {
			props: { quest, step: step(type, icon) }
		});
		const text = wrapper.text();

		// not a passive read-time step
		expect(text).not.toContain('Keep reading to complete this step');
		// not gated behind "start the quest" / "complete previous steps" / "already completed"
		expect(text).not.toContain('Start this quest to unlock the step interface.');
		expect(text).not.toContain('Complete previous steps to unlock this step.');
		expect(text).not.toContain('Already completed');
		// no error surface and no interactive submit affordances
		expect(wrapper.find('[data-testid="submit-error"]').exists()).toBe(false);
		expect(wrapper.find('textarea').exists()).toBe(false);
	});
});
