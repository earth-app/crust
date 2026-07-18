import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
	ANIMATED_EXPORT_FORMATS,
	availableExportFormats,
	captureCanvasFrames,
	dataUrlToBlob,
	encodeAnimatedBlob,
	encodeApng,
	encodeGif,
	EXPORT_FORMATS,
	exportFilename,
	exportFormatMetas,
	frameDelayMs,
	framesToRgbaBuffers,
	isAnimatedFormat,
	renderStaticBlob,
	resolveCanvas,
	resolveExportNode,
	scaledSize,
	STATIC_EXPORT_FORMATS,
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

	it('adds gif + apng once the asset is animated', () => {
		expect(availableExportFormats(true)).toEqual([
			...STATIC_EXPORT_FORMATS,
			...ANIMATED_EXPORT_FORMATS
		]);
		expect(exportFormatMetas(true)).toHaveLength(5);
		expect(exportFormatMetas(false)).toHaveLength(3);
	});

	it('flags gif/apng as animated and svg/png/jpg as static', () => {
		expect(isAnimatedFormat('gif')).toBe(true);
		expect(isAnimatedFormat('apng')).toBe(true);
		expect(isAnimatedFormat('png')).toBe(false);
		expect(isAnimatedFormat('svg')).toBe(false);
		expect(isAnimatedFormat('jpg')).toBe(false);
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
