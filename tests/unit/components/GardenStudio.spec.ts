import { mountSuspended } from '@nuxt/test-utils/runtime';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GardenStudio from '~/components/admin/marketing/GardenStudio.vue';
import type { MarketingScene } from '~/shared/types/marketing';
import type { GardenSceneState } from '~/shared/utils/circles';
import { emptyGardenScene } from '~/shared/utils/circles';

// keep the studio hermetic: scene load on mount must not hit the network
vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return {
		...actual,
		makeServerRequest: vi.fn().mockResolvedValue({ success: true, data: [] })
	};
});

const gardenScene = (payload: GardenSceneState): MarketingScene<GardenSceneState> => ({
	id: 'scene-garden',
	name: 'Spring Meadow Demo',
	kind: 'garden' as MarketingScene['kind'],
	source: 'manual',
	payload,
	created_by: 'admin',
	created_at: '2024-01-01T00:00:00Z',
	updated_at: '2024-01-01T00:00:00Z'
});

beforeEach(() => {
	setActivePinia(createPinia());
	vi.clearAllMocks();
});

describe('AdminMarketingGardenStudio', () => {
	it('renders the editor controls and presets in author mode', async () => {
		const wrapper = await mountSuspended(GardenStudio);
		expect(wrapper.text()).toContain('Garden Studio');
		expect(wrapper.text()).toContain('Spring Meadow');
		expect(wrapper.text()).toContain('Randomize');
		expect(wrapper.find('canvas').exists()).toBe(true);
	});

	it('renders just the garden from a scene in display-only mode', async () => {
		const payload: GardenSceneState = { ...emptyGardenScene(), title: 'Night Sky Demo' };
		const wrapper = await mountSuspended(GardenStudio, {
			props: { scene: gardenScene(payload), displayOnly: true }
		});
		expect(wrapper.find('canvas').exists()).toBe(true);
		// author-only chrome is hidden in display-only mode
		expect(wrapper.text()).not.toContain('Garden Studio');
	});
});
