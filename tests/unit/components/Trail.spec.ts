import { mountSuspended } from '@nuxt/test-utils/runtime';
import { createPinia, setActivePinia } from 'pinia';
import type { Trail, TrailRarity, TrailReflection } from 'types/trails';
import { makeAPIRequest } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import Browser from '~/components/trail/Browser.vue';
import Card from '~/components/trail/Card.vue';
import Clue from '~/components/trail/Clue.vue';
import Presence from '~/components/trail/Presence.vue';
import Reflect from '~/components/trail/Reflect.vue';
import Reveal from '~/components/trail/Reveal.vue';

vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return {
		...actual,
		makeAPIRequest: vi.fn().mockResolvedValue({ success: false, message: 'no' }),
		makeClientAPIRequest: vi.fn().mockResolvedValue({ success: false, message: 'no' }),
		invalidateAPICache: vi.fn()
	};
});

function trail(id: string, rarity: TrailRarity, title: string, extra: Partial<Trail> = {}): Trail {
	return {
		id,
		title,
		theme: 'nature',
		practice: 'sit_spot',
		description: 'A short walk with a curious clue.',
		icon: 'mdi:leaf',
		rarity,
		curiosity: 'What is older than it looks?',
		duration: 12,
		reflectionPrompt: 'What did you notice out there?',
		reveal: 'Two centuries old.',
		...extra
	};
}

beforeEach(() => {
	setActivePinia(createPinia());
	vi.clearAllMocks();
});

describe('TrailCard', () => {
	it('carries the fill classes that keep the gradient-border ring from bleeding below', async () => {
		// the blue-line bug: the animated border host stretches in the grid but its inner
		// wrapper did not fill, exposing the ring below the content. h-full + *:h-full fix it.
		const amazing = await mountSuspended(Card, {
			props: { trail: trail('a', 'amazing', 'Aurora') }
		});
		expect(amazing.classes()).toContain('h-full');
		expect(amazing.classes()).toContain('*:h-full');

		const normal = await mountSuspended(Card, { props: { trail: trail('b', 'normal', 'Basin') } });
		expect(normal.classes()).toContain('h-full');
		expect(normal.classes()).toContain('*:h-full');
	});

	it('shows the practice label, a duration hint, and a single wonder teaser (no steps/reward)', async () => {
		const wrapper = await mountSuspended(Card, {
			props: { trail: trail('t1', 'normal', 'Basin', { practice: 'sound_map', duration: 8 }) }
		});
		const text = wrapper.text();
		expect(text).toContain('Sound Map');
		expect(text).toContain('~8 min');
		// the awe payoff stays hidden until the practice is done -> curiosity teaser
		expect(text).toContain('Wonder');
		expect(text).not.toMatch(/reward/i);
		expect(text).not.toMatch(/\bstep\b/i);
	});

	it('emits preview and select from the two actions', async () => {
		const wrapper = await mountSuspended(Card, {
			props: { trail: trail('t1', 'rare', 'Ridge Walk') }
		});

		await wrapper.get('button[aria-label="Preview Trail"]').trigger('click');
		expect(wrapper.emitted('preview')?.[0]).toEqual(['t1']);

		const begin = wrapper.findAll('button').find((b) => b.text().includes('Begin Trail'));
		await begin!.trigger('click');
		expect(wrapper.emitted('select')?.[0]).toEqual(['t1']);
	});
});

describe('TrailClue', () => {
	it('shows the curiosity, practice, target, and a live pledge cta', async () => {
		const wrapper = await mountSuspended(Clue, {
			props: {
				curiosity: 'Look up at the tallest thing near you.',
				practice: 'sky_watch',
				targetMinutes: 12
			}
		});
		const text = wrapper.text();
		expect(text).toContain('Look up at the tallest thing near you.');
		expect(text).toContain('Sky Watch');
		expect(text).toContain('~12 min');
		expect(text).toContain('Make My Pledge');
		await wrapper.get('button').trigger('click');
		expect(wrapper.emitted('continue')).toBeTruthy();
	});

	it('shows the read-only begin cta in preview mode', async () => {
		const wrapper = await mountSuspended(Clue, {
			props: { curiosity: 'Look up.', practice: 'sit_spot', targetMinutes: 10, preview: true }
		});
		expect(wrapper.text()).toContain('Begin This Trail');
		expect(wrapper.text()).not.toContain('Make My Pledge');
		await wrapper.get('button').trigger('click');
		expect(wrapper.emitted('continue')).toBeTruthy();
	});
});

describe('TrailBrowser', () => {
	async function mountBrowserWith(trails: Trail[]) {
		vi.mocked(makeAPIRequest).mockResolvedValue({ success: true, data: trails } as never);
		const wrapper = await mountSuspended(Browser);
		await new Promise((r) => setTimeout(r, 0));
		await nextTick();
		return wrapper;
	}

	it('shows the loading skeleton, never the empty state, before the fetch resolves', async () => {
		let resolveFetch!: (v: any) => void;
		vi.mocked(makeAPIRequest).mockReturnValue(new Promise((r) => (resolveFetch = r)) as never);
		const wrapper = await mountSuspended(Browser);
		await nextTick();

		expect(wrapper.text()).not.toContain('No Trails Here Yet');
		expect(wrapper.findAll('h3').length).toBe(0);

		// settle the pending fetch (empty catalog) -> only now is the empty state allowed
		resolveFetch({ success: true, data: [] });
		await new Promise((r) => setTimeout(r, 0));
		await nextTick();
		expect(wrapper.text()).toContain('No Trails Here Yet');
	});

	it('renders cards in rarity-then-alphabetical order', async () => {
		const wrapper = await mountBrowserWith([
			trail('1', 'green', 'Zephyr'),
			trail('2', 'normal', 'Banyan'),
			trail('3', 'amazing', 'Cliffside'),
			trail('4', 'normal', 'Acorn'),
			trail('5', 'rare', 'Meadow')
		]);
		const titles = wrapper.findAll('h3').map((h) => h.text());
		expect(titles).toEqual(['Acorn', 'Banyan', 'Meadow', 'Cliffside', 'Zephyr']);
	});

	it('filters to a single theme when a theme chip is chosen', async () => {
		// disjoint ids from the ordering test above: the app-side store persists across
		// tests in this file, and setTrails skips ids already cached (insert-if-absent)
		const wrapper = await mountBrowserWith([
			trail('f1', 'normal', 'Alpha', { theme: 'reflective' }),
			trail('f2', 'normal', 'Beta', { theme: 'nature' }),
			trail('f3', 'normal', 'Gamma', { theme: 'reflective' })
		]);
		const reflectiveChip = wrapper.findAll('button').find((b) => b.text().trim() === 'Reflective');
		await reflectiveChip!.trigger('click');
		await nextTick();
		const reflectiveTitles = wrapper
			.findAll('h3')
			.map((h) => h.text())
			.filter((t) => t === 'Alpha' || t === 'Gamma');
		expect(reflectiveTitles).toEqual(['Alpha', 'Gamma']);
		// the nature-themed card is filtered out
		expect(wrapper.findAll('h3').map((h) => h.text())).not.toContain('Beta');
	});

	it('offers a Journal button', async () => {
		const wrapper = await mountBrowserWith([]);
		const journalBtn = wrapper.findAll('button').find((b) => b.text().includes('Journal'));
		expect(journalBtn).toBeTruthy();
	});
});

describe('TrailPresence', () => {
	it('renders the practice cue and emits finish with minutes + photoCount', async () => {
		const wrapper = await mountSuspended(Presence, {
			props: { practice: 'photo_series', targetMinutes: 10 }
		});
		expect(wrapper.text()).toContain('Photo Series');
		// no live timer started -> logs the suggested minutes
		const finishBtn = wrapper.findAll('button').find((b) => b.text().includes('Log'));
		await finishBtn!.trigger('click');
		const payload = wrapper.emitted('finish')?.[0]?.[0] as { minutes: number; photoCount: number };
		expect(payload.minutes).toBe(10);
		expect(payload.photoCount).toBe(0);
	});
});

describe('TrailReflect', () => {
	it('renders the reflection prompt and emits save with the private reflection', async () => {
		const wrapper = await mountSuspended(Reflect, {
			props: { reflectionPrompt: 'What did you notice?', practice: 'sit_spot', photoCount: 2 }
		});
		expect(wrapper.text()).toContain('What did you notice?');
		const saveBtn = wrapper.findAll('button').find((b) => b.text().includes('Save Reflection'));
		await saveBtn!.trigger('click');
		const reflection = wrapper.emitted('save')?.[0]?.[0] as TrailReflection;
		expect(reflection.photoCount).toBe(2);
		expect(reflection.sharedToGarden).toBe(true);
		expect(typeof reflection.at).toBe('string');
	});
});

describe('TrailReveal', () => {
	it('renders the awe reveal + personal-best line and emits finish', async () => {
		const wrapper = await mountSuspended(Reveal, {
			props: { reveal: 'That oak is two centuries old.', minutes: 15, personalBest: true }
		});
		const text = wrapper.text();
		expect(text).toContain('That oak is two centuries old.');
		expect(text).toContain('15');
		expect(text).toContain('Your Longest Week Outside Yet');
		const finishBtn = wrapper.findAll('button').find((b) => b.text().includes('Finish'));
		await finishBtn!.trigger('click');
		expect(wrapper.emitted('finish')).toBeTruthy();
	});
});
