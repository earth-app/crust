import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
	ANIMATED_EXPORT_FORMATS,
	availableExportFormats,
	captureCanvasFrames,
	clampDurationMs,
	clampResolutionScale,
	dataUrlToBlob,
	DEFAULT_DURATION_MS,
	DEFAULT_RESOLUTION_SCALE,
	defaultExportFormat,
	encodeAnimatedBlob,
	encodeApng,
	encodeGif,
	EXPORT_FORMATS,
	exportFilename,
	exportFormatMetas,
	frameDelayMs,
	framesForDuration,
	framesToRgbaBuffers,
	GARDEN_EXPORT_FPS,
	isAnimatedFormat,
	loopFramePhases,
	MAX_CAPTURE_FRAMES,
	MAX_DURATION_MS,
	measureNodeSize,
	MIN_DURATION_MS,
	NATURAL_RESOLUTION_PRESETS,
	naturalExportDimensions,
	renderStaticBlob,
	RESOLUTION_BASE_WIDTH,
	RESOLUTION_MAX_EDGE,
	RESOLUTION_PRESETS,
	resolveCanvas,
	resolveExportNode,
	scaledSize,
	STATIC_EXPORT_FORMATS,
	toImageData,
	triggerDownload,
	useMarketingExport,
	type CapturedFrame
} from '~/components/admin/marketing/useMarketingExport';

// shared mock surface for the dynamic-imported heavy libs (kept out of the app bundle;
// here we intercept the exact specifiers useMarketingExport awaits)
const h = vi.hoisted(() => ({
	addFrame: vi.fn(),
	gifRender: vi.fn(),
	upngEncode: vi.fn(() => new ArrayBuffer(8)),
	toPng: vi.fn(async () => 'data:image/png;base64,QUJD'),
	toJpeg: vi.fn(async () => 'data:image/jpeg;base64,QUJD'),
	toSvg: vi.fn(async () => 'data:image/svg+xml,%3Csvg%3E%3C%2Fsvg%3E')
}));

vi.mock('html-to-image', () => ({ toPng: h.toPng, toJpeg: h.toJpeg, toSvg: h.toSvg }));
vi.mock('gif.js', () => {
	class MockGIF {
		handlers: Record<string, (arg?: unknown) => void> = {};
		on(event: string, cb: (arg?: unknown) => void) {
			this.handlers[event] = cb;
		}
		addFrame(...args: unknown[]) {
			h.addFrame(...args);
		}
		render() {
			h.gifRender();
			// mirror gif.js: a progress tick, then the finished blob
			this.handlers.progress?.(0.5);
			this.handlers.finished?.(new Blob(['gif'], { type: 'image/gif' }));
		}
	}
	return { default: MockGIF };
});
vi.mock('gif.js/dist/gif.worker.js?raw', () => ({ default: 'self.onmessage=function(){}' }));
vi.mock('upng-js', () => ({ default: { encode: h.upngEncode } }));

const frame = (w = 2, h = 2): CapturedFrame => ({
	width: w,
	height: h,
	data: new Uint8ClampedArray(w * h * 4)
});

beforeAll(() => {
	globalThis.URL.createObjectURL = vi.fn(() => 'blob:worker');
	globalThis.URL.revokeObjectURL = vi.fn();
});

describe('export format selection (static vs animated)', () => {
	it('offers only static formats when the asset cannot animate', () => {
		expect(availableExportFormats(false)).toEqual(STATIC_EXPORT_FORMATS);
		expect(availableExportFormats(false)).not.toContain('gif');
		expect(availableExportFormats(false)).not.toContain('apng');
	});

	it('leads with gif + apng once the asset is animated', () => {
		// animated -> motion formats first so the default lands on gif
		expect(availableExportFormats(true)).toEqual([
			...ANIMATED_EXPORT_FORMATS,
			...STATIC_EXPORT_FORMATS
		]);
		expect(availableExportFormats(true)[0]).toBe('gif');
		expect(exportFormatMetas(true)).toHaveLength(5);
		expect(exportFormatMetas(false)).toHaveLength(3);
	});

	it('defaults to gif for animated assets and png for static', () => {
		expect(defaultExportFormat(true)).toBe('gif');
		expect(defaultExportFormat(false)).toBe('png');
		// the default is always inside the offered set for that mode
		expect(availableExportFormats(true)).toContain(defaultExportFormat(true));
		expect(availableExportFormats(false)).toContain(defaultExportFormat(false));
	});

	it('flags gif/apng as animated and svg/png/jpg as static', () => {
		expect(isAnimatedFormat('gif')).toBe(true);
		expect(isAnimatedFormat('apng')).toBe(true);
		expect(isAnimatedFormat('png')).toBe(false);
		expect(isAnimatedFormat('svg')).toBe(false);
		expect(isAnimatedFormat('jpg')).toBe(false);
	});
});

describe('animation length (duration -> frame count)', () => {
	it('clamps a chosen duration into the 2s..15s window', () => {
		expect(MAX_DURATION_MS).toBe(15000);
		expect(clampDurationMs(4000)).toBe(4000);
		expect(clampDurationMs(15000)).toBe(15000);
		expect(clampDurationMs(500)).toBe(MIN_DURATION_MS);
		expect(clampDurationMs(99_000)).toBe(MAX_DURATION_MS);
		expect(clampDurationMs(Number.NaN)).toBe(DEFAULT_DURATION_MS);
	});

	it('spans the duration at the given fps and caps the frame count', () => {
		expect(framesForDuration(4000, 12)).toBe(48);
		expect(framesForDuration(2000, 10)).toBe(20);
		// 15s * 12fps = 180 frames, right at the raised cap
		expect(MAX_CAPTURE_FRAMES).toBe(180);
		expect(framesForDuration(15_000, 12)).toBe(MAX_CAPTURE_FRAMES);
		// a would-be over-cap capture is clamped, never unbounded
		expect(framesForDuration(15_000, 30)).toBe(MAX_CAPTURE_FRAMES);
		expect(framesForDuration(4000, 0)).toBeGreaterThanOrEqual(1);
	});

	it('lets a duration override the raw frame count in captureCanvasFrames', async () => {
		const wait = vi.fn(async () => {});
		const scratchCtx = {
			clearRect: vi.fn(),
			drawImage: vi.fn(),
			getImageData: (_x: number, _y: number, w: number, hgt: number) => ({
				data: new Uint8ClampedArray(w * hgt * 4),
				width: w,
				height: hgt
			})
		};
		const scratch = { width: 0, height: 0, getContext: () => scratchCtx };
		const source = { width: 100, height: 100 } as unknown as HTMLCanvasElement;

		const frames = await captureCanvasFrames(
			source,
			{ frames: 4, fps: 10, durationMs: 3000, maxDimension: 640 },
			{ wait, createCanvas: () => scratch as unknown as HTMLCanvasElement }
		);
		// 3s * 10fps = 30 frames, ignoring the frames:4 hint
		expect(frames).toHaveLength(30);
		expect(wait).toHaveBeenCalledTimes(29);
	});
});

describe('exportFilename', () => {
	it('slugifies the base and appends the format extension', () => {
		expect(exportFilename('Spring Meadow Demo!', 'png')).toBe('spring-meadow-demo.png');
		expect(exportFilename('Circle Garden', 'gif')).toBe('circle-garden.gif');
	});

	it('uses .png for apng and falls back for empty names', () => {
		expect(exportFilename('Nature Quest', 'apng')).toBe('nature-quest.png');
		expect(exportFilename('   ', 'svg')).toBe('export.svg');
		expect(exportFilename('***', 'jpg')).toBe('export.jpg');
	});
});

describe('node + canvas resolution', () => {
	it('prefers an explicit node, then a getter, then null', () => {
		const el = document.createElement('div');
		expect(resolveExportNode({ node: el })).toBe(el);
		expect(resolveExportNode({ getNode: () => el })).toBe(el);
		expect(resolveExportNode({})).toBeNull();
	});

	it('resolves the motion canvas from prop, selector, or a bare canvas node', () => {
		const canvas = document.createElement('canvas');
		expect(resolveCanvas(null, { canvas })).toBe(canvas);

		const wrap = document.createElement('div');
		const inner = document.createElement('canvas');
		wrap.appendChild(inner);
		expect(resolveCanvas(wrap, { canvasSelector: 'canvas' })).toBe(inner);

		expect(resolveCanvas(canvas, {})).toBe(canvas);
		expect(resolveCanvas(document.createElement('div'), {})).toBeNull();
	});
});

describe('scaledSize + frameDelayMs', () => {
	it('downscales to the largest dimension and keeps small sizes intact', () => {
		expect(scaledSize(1280, 720, 640)).toEqual({ width: 640, height: 360 });
		expect(scaledSize(320, 200, 640)).toEqual({ width: 320, height: 200 });
		expect(scaledSize(0, 0, 640)).toEqual({ width: 1, height: 1 });
	});

	it('derives the per-frame delay from fps', () => {
		expect(frameDelayMs(10)).toBe(100);
		expect(frameDelayMs(12)).toBe(83);
		expect(frameDelayMs()).toBe(83);
	});
});

describe('captureCanvasFrames (frame-capture plumbing)', () => {
	it('grabs N downscaled RGBA frames, waiting between each', async () => {
		const onProgress = vi.fn();
		const wait = vi.fn(async () => {});
		const scratchCtx = {
			clearRect: vi.fn(),
			drawImage: vi.fn(),
			getImageData: (_x: number, _y: number, w: number, hgt: number) => ({
				data: new Uint8ClampedArray(w * hgt * 4),
				width: w,
				height: hgt
			})
		};
		const scratch = { width: 0, height: 0, getContext: () => scratchCtx };
		const source = { width: 1280, height: 720 } as unknown as HTMLCanvasElement;

		const frames = await captureCanvasFrames(
			source,
			{ frames: 4, fps: 10, maxDimension: 640, onProgress },
			{ wait, createCanvas: () => scratch as unknown as HTMLCanvasElement }
		);

		expect(frames).toHaveLength(4);
		expect(frames[0]).toMatchObject({ width: 640, height: 360 });
		expect(frames[0]!.data.length).toBe(640 * 360 * 4);
		expect(scratchCtx.drawImage).toHaveBeenCalledTimes(4);
		expect(onProgress).toHaveBeenCalledTimes(4);
		// waits only between frames, never after the last
		expect(wait).toHaveBeenCalledTimes(3);
	});
});

describe('data + frame conversion helpers', () => {
	it('decodes base64 and utf8 data urls into typed blobs', () => {
		const png = dataUrlToBlob('data:image/png;base64,QUJD');
		expect(png.type).toBe('image/png');
		expect(png.size).toBe(3);
		const svg = dataUrlToBlob('data:image/svg+xml,%3Csvg%3E%3C%2Fsvg%3E');
		expect(svg.type).toBe('image/svg+xml');
		expect(svg.size).toBeGreaterThan(0);
	});

	it('packs frames into tight RGBA buffers for apng', () => {
		const buffers = framesToRgbaBuffers([frame(2, 2), frame(2, 2)]);
		expect(buffers).toHaveLength(2);
		expect(buffers[0]!.byteLength).toBe(2 * 2 * 4);
	});
});

describe('static rendering (html-to-image dispatch)', () => {
	it('routes svg/png/jpg to the matching html-to-image call', async () => {
		const node = document.createElement('div');
		expect((await renderStaticBlob(node, 'svg')).type).toBe('image/svg+xml');
		expect(h.toSvg).toHaveBeenCalled();
		expect((await renderStaticBlob(node, 'png')).type).toBe('image/png');
		expect(h.toPng).toHaveBeenCalled();
		expect((await renderStaticBlob(node, 'jpg')).type).toBe('image/jpeg');
		expect(h.toJpeg).toHaveBeenCalled();
	});
});

describe('animated encoding (gif.js / upng-js dispatch)', () => {
	it('encodes a gif via gif.js addFrame + render', async () => {
		h.addFrame.mockClear();
		const blob = await encodeGif([frame(), frame(), frame()], { fps: 12 });
		expect(blob.type).toBe('image/gif');
		expect(h.addFrame).toHaveBeenCalledTimes(3);
	});

	// ROOT CAUSE regression: gif.js addFrame rejects a plain {width,height,data} look-alike
	// with `throw new Error("Invalid image")`; captured frames must be re-wrapped as real
	// ImageData or the GIF never encodes (and so never downloads)
	it('wraps captured frames as real ImageData before handing them to gif.js', async () => {
		expect(toImageData(frame(3, 2))).toBeInstanceOf(ImageData);

		h.addFrame.mockClear();
		await encodeGif([frame(2, 2)], { fps: 12 });
		const passed = h.addFrame.mock.calls[0]![0];
		// a plain object would fail gif.js's `image instanceof ImageData` check
		expect(passed).toBeInstanceOf(ImageData);
	});

	it('reports encode progress from the gif.js progress event', async () => {
		const onProgress = vi.fn();
		await encodeGif([frame()], { fps: 12, onProgress });
		expect(onProgress).toHaveBeenCalledWith(0.5);
	});

	it('encodes an apng via upng-js encode with per-frame delays', async () => {
		h.upngEncode.mockClear();
		const blob = await encodeApng([frame(4, 4), frame(4, 4)], { fps: 10 });
		expect(blob.type).toBe('image/png');
		expect(h.upngEncode).toHaveBeenCalledTimes(1);
		const args = h.upngEncode.mock.calls[0]!;
		expect(args[1]).toBe(4); // width
		expect(args[2]).toBe(4); // height
		expect(args[3]).toBe(0); // lossless cnum
		expect(args[4]).toEqual([100, 100]); // delays
	});

	it('dispatches encodeAnimatedBlob to the right encoder', async () => {
		h.addFrame.mockClear();
		h.upngEncode.mockClear();
		expect((await encodeAnimatedBlob([frame()], 'gif')).type).toBe('image/gif');
		expect(h.addFrame).toHaveBeenCalled();
		expect((await encodeAnimatedBlob([frame()], 'apng')).type).toBe('image/png');
		expect(h.upngEncode).toHaveBeenCalled();
	});
});

describe('triggerDownload', () => {
	it('creates an anchor, clicks it, and revokes the url', () => {
		const anchor = { href: '', download: '', rel: '', click: vi.fn(), remove: vi.fn() };
		const doc = {
			createElement: vi.fn(() => anchor),
			body: { appendChild: vi.fn() }
		} as unknown as Document;
		const revokeUrl = vi.fn();
		triggerDownload(new Blob(['x']), 'scene.png', { doc, createUrl: () => 'blob:x', revokeUrl });
		expect(anchor.href).toBe('blob:x');
		expect(anchor.download).toBe('scene.png');
		expect(anchor.click).toHaveBeenCalledTimes(1);
		expect(anchor.remove).toHaveBeenCalledTimes(1);
	});
});

describe('useMarketingExport composable', () => {
	it('exposes format metas gated on the animated flag', () => {
		const { formatsFor } = useMarketingExport();
		expect(formatsFor(false).map((m) => m.format)).toEqual(STATIC_EXPORT_FORMATS);
		expect(formatsFor(true).map((m) => m.format)).toContain('gif');
	});

	it('exports a static node end-to-end and reports success', async () => {
		const { exportAsset, exporting } = useMarketingExport();
		const node = document.createElement('div');
		const res = await exportAsset({ format: 'png', node, filename: 'card' });
		expect(res.success).toBe(true);
		expect(exporting.value).toBe(false);
	});

	it('fails cleanly when an animated export has no canvas', async () => {
		const { exportAsset } = useMarketingExport();
		const res = await exportAsset({ format: 'gif', node: document.createElement('div') });
		expect(res.success).toBe(false);
		expect(res.error).toMatch(/canvas/i);
	});

	it('fails cleanly when a static export has no node', async () => {
		const { exportAsset } = useMarketingExport();
		const res = await exportAsset({ format: 'png' });
		expect(res.success).toBe(false);
		expect(res.error).toMatch(/element/i);
	});

	it('uses a staticOverride (crisp self-render) instead of html-to-image for static formats', async () => {
		const { exportAsset } = useMarketingExport();
		const overrideBlob = new Blob(['crisp'], { type: 'image/png' });
		const staticOverride = vi.fn(async () => overrideBlob);
		const renderStatic = vi.fn(async () => new Blob(['node-capture'], { type: 'image/png' }));
		const download = vi.fn();

		// no node needed: the self-rendering source produces the blob at the given pixel ratio
		const res = await exportAsset(
			{ format: 'png', pixelRatio: 4.5, staticOverride },
			{ renderStatic, download }
		);

		expect(res.success).toBe(true);
		expect(staticOverride).toHaveBeenCalledWith('png', 4.5);
		expect(renderStatic).not.toHaveBeenCalled();
		expect(download.mock.calls[0]![0]).toBe(overrideBlob);
	});
});

describe('GIF export auto-download (regression)', () => {
	// the bug: a finished GIF encode never reached triggerDownload the way apng/png did.
	// drive the whole animated path with a mocked encoder and assert the download fires.
	it('routes a finished GIF blob through the shared download path', async () => {
		const { exportAsset, exporting, progress, phase } = useMarketingExport();
		const download = vi.fn();
		const gifBlob = new Blob(['gif-bytes'], { type: 'image/gif' });
		const canvas = document.createElement('canvas');

		const res = await exportAsset(
			{ format: 'gif', canvas, filename: 'Circle Garden', durationMs: 3000 },
			{
				captureFrames: async () => [frame(4, 4), frame(4, 4)],
				encodeAnimated: async () => gifBlob,
				download
			}
		);

		expect(res.success).toBe(true);
		expect(download).toHaveBeenCalledTimes(1);
		expect(download.mock.calls[0]![0]).toBe(gifBlob);
		expect(download.mock.calls[0]![1]).toBe('circle-garden.gif');
		// state settles back to idle-but-complete
		expect(exporting.value).toBe(false);
		expect(progress.value).toBe(1);
		expect(phase.value).toBe('done');
	});

	it('drives progress through capture -> encode -> done with a live frame counter', async () => {
		const { exportAsset, progress, phase, frame: frameRef, frameTotal } = useMarketingExport();
		const seen: { phase: string; progress: number }[] = [];
		const canvas = document.createElement('canvas');

		await exportAsset(
			{ format: 'gif', canvas, durationMs: 3000, fps: 10 },
			{
				// 3s * 10fps = 30 frames; emit a mid-capture tick so the bar advances
				captureFrames: async (_c, opts) => {
					opts?.onProgress?.(0.5);
					seen.push({ phase: phase.value, progress: progress.value });
					return [frame(), frame()];
				},
				encodeAnimated: async (_f, _fmt, opts) => {
					opts?.onProgress?.(0.5);
					seen.push({ phase: phase.value, progress: progress.value });
					return new Blob(['g'], { type: 'image/gif' });
				},
				download: vi.fn()
			}
		);

		// capture spans 0..0.6 (0.5 -> 0.3), encode spans 0.6..1 (0.5 -> 0.8)
		expect(seen[0]).toMatchObject({ phase: 'capturing', progress: 0.3 });
		expect(seen[1]).toMatchObject({ phase: 'encoding' });
		expect(seen[1]!.progress).toBeCloseTo(0.8, 5);
		expect(frameTotal.value).toBe(30);
		expect(frameRef.value).toBe(15);
		expect(progress.value).toBe(1);
	});

	it('reports a static export through the rendering phase', async () => {
		const { exportAsset, phase } = useMarketingExport();
		const download = vi.fn();
		const node = document.createElement('div');
		const res = await exportAsset(
			{ format: 'png', node, filename: 'card' },
			{ renderStatic: async () => new Blob(['png'], { type: 'image/png' }), download }
		);
		expect(res.success).toBe(true);
		expect(download).toHaveBeenCalledTimes(1);
		expect(phase.value).toBe('done');
	});
});

describe('export resolution (garden: fixed 640x350 box)', () => {
	it('defaults to the original size and offers presets up to 3K', () => {
		expect(DEFAULT_RESOLUTION_SCALE).toBe(1);
		expect(RESOLUTION_PRESETS[0]).toMatchObject({ width: 640, height: 350, scale: 1 });
		const top = RESOLUTION_PRESETS[RESOLUTION_PRESETS.length - 1]!;
		expect(top).toMatchObject({ width: 2880, height: 1575, scale: 4.5 });
		// every preset keeps the ~640x350 aspect ratio
		for (const p of RESOLUTION_PRESETS) {
			expect(p.width / p.height).toBeCloseTo(640 / 350, 2);
		}
	});

	it('ties every garden preset to the 640x350 base times its scale', () => {
		// this is exactly what GardenStudio still feeds Garden.exportBlob(format, scale)
		for (const p of RESOLUTION_PRESETS) {
			expect(p.width).toBe(Math.round(RESOLUTION_BASE_WIDTH * p.scale));
			expect(p.height).toBe(Math.round(350 * p.scale));
		}
	});

	it('clamps a requested scale into the original..3K range', () => {
		expect(clampResolutionScale(1)).toBe(1);
		expect(clampResolutionScale(0.2)).toBe(1);
		expect(clampResolutionScale(10)).toBe(4.5);
		expect(clampResolutionScale(3)).toBe(3);
		expect(clampResolutionScale(Number.NaN)).toBe(DEFAULT_RESOLUTION_SCALE);
	});
});

describe('export resolution (DOM panels: natural per-panel aspect)', () => {
	it('offers Original + longest-edge targets up to 3K, not the garden box', () => {
		expect(NATURAL_RESOLUTION_PRESETS[0]).toMatchObject({ label: 'Original', target: null });
		const top = NATURAL_RESOLUTION_PRESETS[NATURAL_RESOLUTION_PRESETS.length - 1]!;
		expect(top.target).toBe(2880);
		expect(RESOLUTION_MAX_EDGE).toBe(2880);
		// none of the natural presets carry the garden's 640x350 dimensions
		for (const p of NATURAL_RESOLUTION_PRESETS) {
			expect(p).not.toHaveProperty('width');
			expect(p).not.toHaveProperty('height');
		}
	});

	it('keeps the node at its natural size (1x) for Original, never the 640x350 box', () => {
		// a portrait content card: Original must export it at its own 400x600, not 640x350
		const dims = naturalExportDimensions({ width: 400, height: 600 }, null);
		expect(dims.pixelRatio).toBe(1);
		expect(dims).toMatchObject({ width: 400, height: 600, maxDimension: 600 });
		// aspect preserved (no letterbox / transparent padding), and not the garden aspect
		expect(dims.width / dims.height).toBeCloseTo(400 / 600, 5);
		expect(dims.width).not.toBe(640);
		expect(dims.height).not.toBe(350);
	});

	it('scales the longest edge up toward the target while preserving aspect', () => {
		// 900x500 landscape card -> 2K target (1920 longest edge): pixelRatio 1920/900
		const dims = naturalExportDimensions({ width: 900, height: 500 }, 1920);
		expect(dims.pixelRatio).toBeCloseTo(1920 / 900, 5);
		expect(dims.width).toBe(1920);
		expect(dims.height).toBe(Math.round(500 * (1920 / 900)));
		// same aspect as the source node (900/500), computed from natural size not the 640 base
		expect(dims.width / dims.height).toBeCloseTo(900 / 500, 2);
	});

	it('picks the pixelRatio off the LONGEST edge for a portrait node', () => {
		// 400x600 portrait -> HD (1280): the 600 height is the longest edge that must reach 1280
		const dims = naturalExportDimensions({ width: 400, height: 600 }, 1280);
		expect(dims.pixelRatio).toBeCloseTo(1280 / 600, 5);
		expect(dims.height).toBe(1280);
		expect(dims.maxDimension).toBe(1280);
	});

	it('never downscales a node already larger than the target', () => {
		// 3000x1000 node with an HD target: keep 1x (never shrink a DOM panel)
		const dims = naturalExportDimensions({ width: 3000, height: 1000 }, 1280);
		expect(dims.pixelRatio).toBe(1);
		expect(dims).toMatchObject({ width: 3000, height: 1000 });
	});

	it('caps the upscaled longest edge at ~3K even for a tiny node or huge target', () => {
		const dims = naturalExportDimensions({ width: 100, height: 100 }, 2880);
		expect(dims.maxDimension).toBe(2880);
		expect(dims.width).toBe(2880);
		// a target beyond the cap is still clamped to 3K on the longest edge
		const over = naturalExportDimensions({ width: 100, height: 100 }, 9999);
		expect(over.maxDimension).toBeLessThanOrEqual(RESOLUTION_MAX_EDGE);
		expect(over.maxDimension).toBe(2880);
	});

	it('guards degenerate sizes to at least 1px', () => {
		const dims = naturalExportDimensions({ width: 0, height: 0 }, null);
		expect(dims).toMatchObject({ width: 1, height: 1, pixelRatio: 1 });
	});

	it('measureNodeSize reads a rect / offset box and floors at 1x1', () => {
		expect(measureNodeSize(null)).toEqual({ width: 1, height: 1 });
		const node = {
			getBoundingClientRect: () => ({ width: 480, height: 270 })
		} as unknown as HTMLElement;
		expect(measureNodeSize(node)).toEqual({ width: 480, height: 270 });
		// zero rect falls through to the offset box, then to the 1px floor
		const empty = {
			getBoundingClientRect: () => ({ width: 0, height: 0 }),
			offsetWidth: 0,
			offsetHeight: 0
		} as unknown as HTMLElement;
		expect(measureNodeSize(empty)).toEqual({ width: 1, height: 1 });
	});
});

describe('seamless-loop frame phases (loopFramePhases)', () => {
	it('spaces N phases evenly across [0,1) so the loop wraps with no jump', () => {
		expect(loopFramePhases(4)).toEqual([0, 0.25, 0.5, 0.75]);
		const phases = loopFramePhases(8);
		expect(phases).toHaveLength(8);
		expect(phases[0]).toBe(0);
		// the last phase never reaches 1 (that frame would duplicate frame 0)
		expect(phases[phases.length - 1]).toBeLessThan(1);
		expect(phases[phases.length - 1]).toBe(7 / 8);
		// the gap from the last frame back to 0 equals the inter-frame gap -> seamless
		const step = phases[1]! - phases[0]!;
		expect(1 - phases[phases.length - 1]!).toBeCloseTo(step, 10);
		for (let i = 1; i < phases.length; i += 1) {
			expect(phases[i]! - phases[i - 1]!).toBeCloseTo(step, 10);
		}
	});

	it('always yields at least one phase and floors fractional counts', () => {
		expect(loopFramePhases(1)).toEqual([0]);
		expect(loopFramePhases(0)).toEqual([0]);
		expect(loopFramePhases(-5)).toEqual([0]);
		expect(loopFramePhases(3.9)).toEqual([0, 1 / 3, 2 / 3]);
	});
});

describe('garden export fps', () => {
	it('renders animated frames at a smoother-than-default fps that still fits the cap', () => {
		expect(GARDEN_EXPORT_FPS).toBeGreaterThanOrEqual(20);
		// even a max-length capture stays within the frame cap
		expect(framesForDuration(MAX_DURATION_MS, GARDEN_EXPORT_FPS)).toBeLessThanOrEqual(
			MAX_CAPTURE_FRAMES
		);
	});
});

describe('animated export via a deterministic frame provider', () => {
	// the garden fix: gif/apng render deterministic, seamlessly-looping frames offscreen
	// instead of sampling the live rAF canvas at uneven wall-clock phases
	it('routes an animated export through the provider (no live canvas needed)', async () => {
		const { exportAsset } = useMarketingExport();
		const provider = vi.fn(async () => [frame(4, 4), frame(4, 4)]);
		const captureFrames = vi.fn(async () => [frame()]);
		const encodeAnimated = vi.fn(async () => new Blob(['g'], { type: 'image/gif' }));
		const download = vi.fn();

		// no `canvas`/`node`: the provider fully supplies the frames
		const res = await exportAsset(
			{
				format: 'gif',
				filename: 'Circle Garden',
				durationMs: 4000,
				fps: GARDEN_EXPORT_FPS,
				maxDimension: 640,
				pixelRatio: 2,
				animatedFrameProvider: provider
			},
			{ captureFrames, encodeAnimated, download }
		);

		expect(res.success).toBe(true);
		expect(provider).toHaveBeenCalledTimes(1);
		// the live-sample path is bypassed entirely
		expect(captureFrames).not.toHaveBeenCalled();
		expect(download).toHaveBeenCalledTimes(1);
		expect(download.mock.calls[0]![1]).toBe('circle-garden.gif');

		const reqArg = provider.mock.calls[0]![0] as {
			phases: number[];
			fps: number;
			maxDimension?: number;
			scale?: number;
		};
		// 4s * 20fps = 80 evenly-spaced, seamless-loop phases
		expect(reqArg.phases).toHaveLength(framesForDuration(4000, GARDEN_EXPORT_FPS));
		expect(reqArg.phases).toEqual(loopFramePhases(framesForDuration(4000, GARDEN_EXPORT_FPS)));
		expect(reqArg.fps).toBe(GARDEN_EXPORT_FPS);
		expect(reqArg.maxDimension).toBe(640);
		// pixelRatio (the garden resolution scale) is forwarded as the size hint
		expect(reqArg.scale).toBe(2);
	});

	it('drives the progress bar + frame counter from the provider callback', async () => {
		const { exportAsset, progress, phase, frame: frameRef, frameTotal } = useMarketingExport();
		const res = await exportAsset(
			{
				format: 'gif',
				durationMs: 3000,
				fps: 10,
				animatedFrameProvider: async (req) => {
					// mid-render tick, then the frames
					req.onProgress?.(0.5);
					return [frame(), frame()];
				}
			},
			{ encodeAnimated: async () => new Blob(['g'], { type: 'image/gif' }), download: vi.fn() }
		);

		expect(res.success).toBe(true);
		// 3s * 10fps = 30 frames; a 0.5 tick maps into the 0..0.6 capture share
		expect(frameTotal.value).toBe(30);
		expect(frameRef.value).toBe(15);
		expect(progress.value).toBe(1);
		expect(phase.value).toBe('done');
	});

	it('still fails cleanly for a live-canvas animated export with no canvas + no provider', async () => {
		const { exportAsset } = useMarketingExport();
		const res = await exportAsset({ format: 'gif', node: document.createElement('div') });
		expect(res.success).toBe(false);
		expect(res.error).toMatch(/canvas/i);
	});
});

describe('EXPORT_FORMATS registry', () => {
	it('every format carries a label, extension, mime, and icon', () => {
		for (const meta of Object.values(EXPORT_FORMATS)) {
			expect(meta.label).toBeTruthy();
			expect(meta.extension).toBeTruthy();
			expect(meta.mime).toMatch(/\//);
			expect(meta.icon).toMatch(/^mdi:/);
		}
	});
});
