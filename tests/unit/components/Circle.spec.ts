import { mountSuspended } from '@nuxt/test-utils/runtime';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Expedition_ from '~/components/circle/Expedition.vue';
import Kudos from '~/components/circle/Kudos.vue';
import Panel from '~/components/circle/Panel.vue';
import Ring from '~/components/circle/Ring.vue';
import type { Expedition } from '~/shared/types/circles';

vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return {
		...actual,
		makeAPIRequest: vi.fn().mockResolvedValue({ success: false, message: 'no' }),
		makeClientAPIRequest: vi.fn().mockResolvedValue({ success: false, message: 'no' })
	};
});

import { makeClientAPIRequest } from 'utils';

function expedition(partial: Partial<Expedition> = {}): Expedition {
	return {
		id: 'exp1',
		owner_uid: 'owner',
		title: 'Weekend Woods',
		goal: 'nature_minutes',
		target: 600,
		progress: 300,
		contributors: [
			{ uid: 'a', username: 'Ana', contribution: 200 },
			{ uid: 'b', username: 'Bo', contribution: 100 }
		],
		status: 'active',
		starts_at: new Date().toISOString(),
		ends_at: new Date(Date.now() + 604_800_000).toISOString(),
		...partial
	};
}

beforeEach(() => {
	setActivePinia(createPinia());
	vi.clearAllMocks();
});

describe('CircleRing', () => {
	it('renders the combined percent and contribution segments', async () => {
		const wrapper = await mountSuspended(Ring, { props: { expedition: expedition() } });
		expect(wrapper.text()).toContain('50%');
		expect(wrapper.text()).toContain('Nature Minutes');
		// one arc per contributor plus the track circle
		expect(wrapper.findAll('circle').length).toBe(3);
	});

	it('draws no segments before any progress', async () => {
		const wrapper = await mountSuspended(Ring, {
			props: { expedition: expedition({ progress: 0, contributors: [] }) }
		});
		expect(wrapper.text()).toContain('0%');
		expect(wrapper.findAll('circle').length).toBe(1);
	});
});

describe('CircleKudos', () => {
	it('renders the fixed phrase set as one-tap buttons', async () => {
		const wrapper = await mountSuspended(Kudos, {
			props: { toUid: 'friend', contextType: 'quest', contextRef: 'q1', username: 'Ana' }
		});
		expect(wrapper.text()).toContain('Send Kudos');
		expect(wrapper.text()).toContain('Go You');
		expect(wrapper.text()).toContain('Trailblazer');
	});

	it('sends the chosen phrase without exposing any tally', async () => {
		vi.mocked(makeClientAPIRequest).mockResolvedValue({ success: true } as any);
		const wrapper = await mountSuspended(Kudos, {
			props: { toUid: 'friend', contextType: 'quest', contextRef: 'q1', username: 'Ana' }
		});

		await wrapper.findAll('button')[0]!.trigger('click');
		await new Promise((r) => setTimeout(r, 0));

		// kudos posts direct to the recipient's mantle2 endpoint (to_uid is in the path, not the body)
		expect(makeClientAPIRequest).toHaveBeenCalledWith(
			'/v2/users/friend/kudos',
			null,
			expect.objectContaining({
				method: 'POST',
				body: expect.objectContaining({ context_type: 'quest' })
			})
		);
		// no number is rendered anywhere in the kudos surface
		expect(wrapper.text()).not.toMatch(/\d+\s*(kudos|likes|cheers)/i);
	});
});

describe('CircleExpedition', () => {
	it('shows the active expedition with contribution, never a rank number', async () => {
		const wrapper = await mountSuspended(Expedition_, {
			props: { expedition: expedition(), currentUid: 'a' }
		});
		expect(wrapper.text()).toContain('Weekend Woods');
		expect(wrapper.text()).toContain('Ana');
		expect(wrapper.text()).toContain('Bo');
		expect(wrapper.text()).toContain('(You)');
		// framed as the circle-vs-challenge, never member-vs-member
		expect(wrapper.text()).not.toMatch(/#\s*1|rank|leaderboard/i);
	});

	it('shows a skeleton (not the start form) while the expedition fetch is unsettled', async () => {
		// regression: before the fetch settles, Panel passes loading=true so the start form
		// never flashes for a circle that actually has an active expedition
		const wrapper = await mountSuspended(Expedition_, {
			props: { expedition: null, canStart: true, currentUid: 'a', circleSize: 3, loading: true }
		});
		expect(wrapper.find('[data-testid="expedition-loading"]').exists()).toBe(true);
		expect(wrapper.text()).not.toContain('Start an Expedition');
		expect(wrapper.text()).not.toContain('Invite Friends to Start');
	});

	it('offers the start form when the circle has members but no expedition', async () => {
		const wrapper = await mountSuspended(Expedition_, {
			// circleSize > 1 => the circle has at least one other person
			props: { expedition: null, canStart: true, currentUid: 'a', circleSize: 3 }
		});
		expect(wrapper.text()).toContain('Start an Expedition');
		expect(wrapper.text()).toContain('Start Expedition');
	});

	it('gates the start behind an invite prompt when the circle is empty', async () => {
		const wrapper = await mountSuspended(Expedition_, {
			// no circleSize + no fetched members => a shared goal needs people first
			props: { expedition: null, canStart: true, currentUid: 'a' }
		});
		expect(wrapper.text()).toContain('Invite Friends to Start');
		expect(wrapper.text()).not.toContain('Start Expedition');
	});

	it('nudges when the default target is very high for a small circle', async () => {
		// default target 600, circleSize 1 nature -> ambitiousAt 360 -> ambitious nudge
		const wrapper = await mountSuspended(Expedition_, {
			props: { expedition: null, canStart: true, currentUid: 'a', circleSize: 1 }
		});
		expect(wrapper.text()).toContain('This Looks Ambitious!');
	});

	it('encourages a higher goal when the target is low for a big circle', async () => {
		// default target 600 < circleSize 30 * 30 = 900 -> low nudge
		const wrapper = await mountSuspended(Expedition_, {
			props: { expedition: null, canStart: true, currentUid: 'a', circleSize: 30 }
		});
		expect(wrapper.text()).toContain('You Can Do Better!');
	});

	it('stays quiet when the target sits in a healthy band', async () => {
		// circleSize 5 nature: healthy band [150, 1800) contains the default 600
		const wrapper = await mountSuspended(Expedition_, {
			props: { expedition: null, canStart: true, currentUid: 'a', circleSize: 5 }
		});
		expect(wrapper.text()).not.toContain('This Looks Ambitious!');
		expect(wrapper.text()).not.toContain('You Can Do Better!');
	});
});

describe('CirclePanel', () => {
	it('renders the header and the signed-out prompt without a user', async () => {
		const wrapper = await mountSuspended(Panel);
		// panel now leads with the shared-garden framing
		expect(wrapper.text()).toContain('My Shared Garden');
		expect(wrapper.text()).toContain('Sign In');
	});
});
