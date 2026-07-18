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
		expect(wrapper.find('canvas').attributes('aria-label')?.toLowerCase()).toContain(
			'circle garden'
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
});
