import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import JourneyStudio from '~/components/admin/marketing/JourneyStudio.vue';
import Hero from '~/components/user/journey/Hero.vue';
import { journeySequenceFrames } from '~/shared/utils/marketing';

const fetchCurrentJourney = vi.fn(async () => ({
	success: true,
	data: { count: 99, lastWrite: 0 }
}));
const fetchCurrentJourneyRank = vi.fn(async () => ({ success: true, data: { rank: 9 } }));
const fetchUserQuest = vi.fn(async () => ({ success: true, data: null }));

mockNuxtImport('useAuth', () => {
	return () => ({
		user: ref({ id: 'admin-1', username: 'admin', account: { account_type: 'ADMINISTRATOR' } }),
		fetchCurrentJourney,
		fetchCurrentJourneyRank
	});
});

mockNuxtImport('useUser', () => {
	return () => ({ quest: ref(null), fetchUserQuest });
});

const user = { id: 'admin-1', username: 'admin' } as never;

const stubs = {
	UiCountUp: {
		props: ['value'],
		template: '<span class="count-up">{{ value }}</span>'
	},
	UiSparkleBurst: true,
	AdminMarketingSequenceBar: true,
	AdminMarketingExportBar: true
};

describe('Journey hero preview seam', () => {
	it('renders staged counts and ranks without fetching anything', async () => {
		const wrapper = await mountSuspended(Hero, {
			props: {
				user,
				preview: [
					{ type: 'article', count: 12, rank: 1, hoursLeft: 30, isBest: true },
					{ type: 'prompt', count: 3, rank: 0, hoursLeft: 30 },
					{ type: 'event', count: 0, rank: 0, hoursLeft: 30 }
				]
			},
			global: { stubs }
		});

		const counts = wrapper.findAll('.count-up').map((n) => n.text());
		expect(counts).toEqual(['12', '3', '0']);
		expect(wrapper.text()).toContain('#1');
		expect(wrapper.text()).toContain('Your Longest Yet');

		// a staged hero is the studio's business only; it must never reach the network
		expect(fetchCurrentJourney).not.toHaveBeenCalled();
		expect(fetchCurrentJourneyRank).not.toHaveBeenCalled();
		expect(fetchUserQuest).not.toHaveBeenCalled();
	});

	it('shows the expiring-soon state when the window is nearly closed', async () => {
		const wrapper = await mountSuspended(Hero, {
			props: {
				user,
				preview: [{ type: 'article', count: 4, rank: 0, hoursLeft: 3 }]
			},
			global: { stubs }
		});

		expect(wrapper.text()).toContain('Expires Soon');
	});

	it('falls back to the fetched values when no preview is passed', async () => {
		await mountSuspended(Hero, { props: { user }, global: { stubs } });

		expect(fetchCurrentJourney).toHaveBeenCalled();
	});
});

describe('Journey studio', () => {
	it('stages the hero and offers both streak sequences', async () => {
		const wrapper = await mountSuspended(JourneyStudio, { global: { stubs } });

		expect(wrapper.text()).toContain('Streak & Journey Studio');
		// the default form is the "Going Well" state, so the hero shows real numbers immediately
		expect(wrapper.findAll('.count-up').map((n) => n.text())).toEqual(['4', '2', '1']);

		expect(journeySequenceFrames('build').length).toBeGreaterThan(2);
		expect(journeySequenceFrames('save').length).toBeGreaterThan(1);
	});

	it('renders only the hero in display-only mode', async () => {
		const wrapper = await mountSuspended(JourneyStudio, {
			props: { displayOnly: true },
			global: { stubs }
		});

		expect(wrapper.text()).not.toContain('Streak & Journey Studio');
		expect(wrapper.findAll('.count-up').length).toBe(3);
	});
});
