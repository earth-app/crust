import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import Garden from '~/components/circle/Garden.vue';
import { deriveMockGarden, emptyGardenScene } from '~/shared/utils/circles';

// canvas has no 2d context under the test dom; the component must mount and settle
// without throwing (all drawing is guarded), which is the SSR/no-context smoke guarantee
describe('CircleGarden (render smoke)', () => {
	it('mounts with a derived garden and exposes an accessible canvas', async () => {
		const garden = deriveMockGarden({ ...emptyGardenScene(), elementCount: 20 });
		const wrapper = await mountSuspended(Garden, {
			props: { garden, caption: 'Grown Together' }
		});

		expect(wrapper.find('canvas').exists()).toBe(true);
		// aria-label now describes the living scene (growth level + element tallies)
		expect(wrapper.find('canvas').attributes('aria-label')?.toLowerCase()).toContain(
			'shared garden'
		);
	});

	it('renders the caption chip when captions are shown', async () => {
		const garden = deriveMockGarden(emptyGardenScene());
		const wrapper = await mountSuspended(Garden, {
			props: { garden, caption: 'Spring Meadow', showCaption: true }
		});
		expect(wrapper.text()).toContain('Spring Meadow');
	});

	it('mounts cleanly for an empty garden', async () => {
		const garden = deriveMockGarden({ ...emptyGardenScene(), elementCount: 0 });
		const wrapper = await mountSuspended(Garden, { props: { garden } });
		expect(wrapper.find('canvas').exists()).toBe(true);
	});

	// mounting runs relayout() -> layoutGarden + buildHitZones, so a rich, water-heavy,
	// grown garden exercises the aquatic-river + far-hill + creature constraints end to end
	it('mounts a grown, water-rich animated garden without throwing', async () => {
		const garden = deriveMockGarden({
			...emptyGardenScene(),
			elementCount: 72,
			level: 11,
			animated: true,
			seed: 20260719,
			mix: { tree: 8, flower: 6, water: 6, stone: 3, creature: 5, star: 2 }
		});
		const wrapper = await mountSuspended(Garden, {
			props: { garden, interactive: true, caption: 'Riverside' }
		});
		expect(wrapper.find('canvas').exists()).toBe(true);
		expect(wrapper.text()).toContain('Riverside');
	});
});
