import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it, vi } from 'vitest';
import Garden from '~/components/circle/Garden.vue';
import { deriveMockGarden, emptyGardenScene } from '~/shared/utils/circles';

interface GardenExportFrame {
	width: number;
	height: number;
	data: Uint8ClampedArray;
}
interface GardenVm {
	exportFrames: (req: {
		phases: number[];
		fps: number;
		maxDimension?: number;
		scale?: number;
	}) => Promise<GardenExportFrame[]>;
}

// jsdom canvases have no real 2d context, so stub a permissive one: any unknown method is a
// no-op, gradients return an addColorStop stub, and getImageData returns a correctly-sized
// RGBA buffer. also stub rAF so mounting an animated garden never spins a live render loop.
function stubGardenCanvas(): () => void {
	const proto = HTMLCanvasElement.prototype as unknown as {
		getContext: (id: string) => unknown;
	};
	const originalGetContext = proto.getContext;
	const originalRaf = globalThis.requestAnimationFrame;
	const grad = { addColorStop: () => {} };
	proto.getContext = () =>
		new Proxy(
			{},
			{
				get(target: Record<string, unknown>, prop: string) {
					if (prop === 'getImageData')
						return (_x: number, _y: number, w: number, h: number) => ({
							data: new Uint8ClampedArray(Math.max(1, w) * Math.max(1, h) * 4),
							width: w,
							height: h
						});
					if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => grad;
					if (prop in target) return target[prop];
					return () => {};
				},
				set(target: Record<string, unknown>, prop: string, value: unknown) {
					target[prop] = value;
					return true;
				}
			}
		);
	globalThis.requestAnimationFrame = (() => 0) as typeof globalThis.requestAnimationFrame;
	return () => {
		proto.getContext = originalGetContext;
		globalThis.requestAnimationFrame = originalRaf;
	};
}

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

// the animated gif/apng export renders deterministic, seamlessly-looping frames offscreen via
// exportFrames (mirroring the crisp static exportBlob) instead of sampling the live canvas.
// jsdom has no real 2d context, so these assert the frame plumbing (count + sizing + reduced-
// motion), not pixels.
describe('CircleGarden (deterministic animated export frames)', () => {
	it('renders exactly one frame per requested loop phase, sized to the maxDimension cap', async () => {
		const restore = stubGardenCanvas();
		try {
			const garden = deriveMockGarden({
				...emptyGardenScene(),
				elementCount: 40,
				level: 8,
				animated: true,
				seed: 20260721,
				mix: { tree: 6, flower: 5, water: 4, stone: 2, creature: 4, star: 2 }
			});
			const wrapper = await mountSuspended(Garden, { props: { garden, interactive: true } });
			const vm = wrapper.vm as unknown as GardenVm;

			const phases = [0, 0.25, 0.5, 0.75];
			const frames = await vm.exportFrames({ phases, fps: 20, maxDimension: 200, scale: 1 });

			// one frame per phase (the seamless loop) - never re-sampled at wall-clock time
			expect(frames).toHaveLength(phases.length);
			for (const f of frames) {
				expect(Math.max(f.width, f.height)).toBeLessThanOrEqual(200);
				expect(f.data.length).toBe(f.width * f.height * 4);
			}
			// every frame shares the same output size (a fixed encoder canvas)
			expect(new Set(frames.map((f) => `${f.width}x${f.height}`)).size).toBe(1);
		} finally {
			restore();
		}
	});

	it('collapses to a single settled frame under reduced motion', async () => {
		const restore = stubGardenCanvas();
		const originalMatchMedia = window.matchMedia;
		window.matchMedia = vi.fn().mockReturnValue({
			matches: true,
			addEventListener: () => {},
			removeEventListener: () => {}
		}) as unknown as typeof window.matchMedia;
		try {
			const garden = deriveMockGarden({
				...emptyGardenScene(),
				elementCount: 20,
				animated: true
			});
			const wrapper = await mountSuspended(Garden, { props: { garden } });
			const vm = wrapper.vm as unknown as GardenVm;

			// four phases requested, but reduced motion yields a single static frame
			const frames = await vm.exportFrames({ phases: [0, 0.25, 0.5, 0.75], fps: 20 });
			expect(frames).toHaveLength(1);
		} finally {
			window.matchMedia = originalMatchMedia;
			restore();
		}
	});

	it('exports a single frame for a non-animated (free) garden regardless of phases', async () => {
		const restore = stubGardenCanvas();
		try {
			const garden = deriveMockGarden({
				...emptyGardenScene(),
				elementCount: 16,
				animated: false
			});
			const wrapper = await mountSuspended(Garden, { props: { garden } });
			const vm = wrapper.vm as unknown as GardenVm;

			const frames = await vm.exportFrames({ phases: [0, 0.33, 0.66], fps: 20 });
			expect(frames).toHaveLength(1);
		} finally {
			restore();
		}
	});
});
