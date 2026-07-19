import type { Ref } from 'vue';
import { ref } from 'vue';
import type { MarketingResult } from '~/shared/types/marketing';

// #region formats

export type ExportFormat = 'svg' | 'png' | 'jpg' | 'gif' | 'apng';

export interface ExportFormatMeta {
	format: ExportFormat;
	label: string;
	extension: string;
	mime: string;
	// animated formats need a source canvas with motion (gif / apng)
	animated: boolean;
	icon: string;
}

export const EXPORT_FORMATS: Record<ExportFormat, ExportFormatMeta> = {
	svg: {
		format: 'svg',
		label: 'SVG',
		extension: 'svg',
		mime: 'image/svg+xml',
		animated: false,
		icon: 'mdi:svg'
	},
	png: {
		format: 'png',
		label: 'PNG',
		extension: 'png',
		mime: 'image/png',
		animated: false,
		icon: 'mdi:file-png-box'
	},
	jpg: {
		format: 'jpg',
		label: 'JPG',
		extension: 'jpg',
		mime: 'image/jpeg',
		animated: false,
		icon: 'mdi:file-jpg-box'
	},
	gif: {
		format: 'gif',
		label: 'GIF',
		extension: 'gif',
		mime: 'image/gif',
		animated: true,
		icon: 'mdi:file-gif-box'
	},
	apng: {
		format: 'apng',
		label: 'APNG',
		extension: 'png',
		mime: 'image/apng',
		animated: true,
		icon: 'mdi:image-multiple-outline'
	}
};

export const STATIC_EXPORT_FORMATS: ExportFormat[] = ['svg', 'png', 'jpg'];
export const ANIMATED_EXPORT_FORMATS: ExportFormat[] = ['gif', 'apng'];

export function isAnimatedFormat(format: ExportFormat): boolean {
	return EXPORT_FORMATS[format].animated;
}

// static formats are always offered; when the asset can animate, gif/apng lead so the
// motion-preserving choice is the obvious default
export function availableExportFormats(animated: boolean): ExportFormat[] {
	return animated
		? [...ANIMATED_EXPORT_FORMATS, ...STATIC_EXPORT_FORMATS]
		: [...STATIC_EXPORT_FORMATS];
}

// animated assets default to GIF (keeps the motion); static assets default to PNG
export function defaultExportFormat(animated: boolean): ExportFormat {
	return animated ? 'gif' : 'png';
}

export function exportFormatMetas(animated: boolean): ExportFormatMeta[] {
	return availableExportFormats(animated).map((f) => EXPORT_FORMATS[f]);
}

export function exportFilename(base: string, format: ExportFormat): string {
	const safe =
		(base || 'export')
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9-_]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'export';
	return `${safe}.${EXPORT_FORMATS[format].extension}`;
}

// #region options

export interface ExportOptions {
	format: ExportFormat;
	// static target (one of node / getNode is required for svg/png/jpg)
	node?: HTMLElement | null;
	getNode?: () => HTMLElement | null;
	// animated source (one of canvas / canvasSelector resolves the motion canvas)
	canvas?: HTMLCanvasElement | null;
	canvasSelector?: string;
	filename?: string;
	// static tuning
	pixelRatio?: number;
	backgroundColor?: string;
	quality?: number;
	// animated tuning
	frames?: number;
	fps?: number;
	// capture window in ms; when set it overrides `frames` (frames = duration * fps)
	durationMs?: number;
	maxDimension?: number;
	// crisp static override (e.g. a canvas that re-renders itself at the target scale);
	// when set, it produces the static blob instead of html-to-image on the node
	staticOverride?: (format: 'svg' | 'png' | 'jpg', pixelRatio: number) => Promise<Blob> | Blob;
	onProgress?: (ratio: number) => void;
}

export const DEFAULT_FRAMES = 16;
export const DEFAULT_FPS = 12;
export const DEFAULT_MAX_DIMENSION = 640;

// animation-length bounds for animated exports (gif / apng)
export const MIN_DURATION_MS = 2000;
export const MAX_DURATION_MS = 15000;
export const DEFAULT_DURATION_MS = 4000;
// hard cap so a long capture can never balloon the frame buffer (15s * 12fps)
export const MAX_CAPTURE_FRAMES = 180;

// #region export resolution

export interface ResolutionPreset {
	label: string;
	width: number;
	height: number;
	// output scale from the ~640-wide base (drives pixelRatio for static + frame maxDimension)
	scale: number;
}

// the garden preview is a ~640x350 scene; keep that by default, scale up to a 3K poster
export const RESOLUTION_PRESETS: ResolutionPreset[] = [
	{ label: 'Original (640 x 350)', width: 640, height: 350, scale: 1 },
	{ label: 'HD (1280 x 700)', width: 1280, height: 700, scale: 2 },
	{ label: '2K (1920 x 1050)', width: 1920, height: 1050, scale: 3 },
	{ label: '3K (2880 x 1575)', width: 2880, height: 1575, scale: 4.5 }
];
export const DEFAULT_RESOLUTION_SCALE = 1;
export const RESOLUTION_BASE_WIDTH = 640;

// clamp a requested scale into the supported range (original .. 3K)
export function clampResolutionScale(scale: number): number {
	if (!Number.isFinite(scale)) return DEFAULT_RESOLUTION_SCALE;
	return Math.max(1, Math.min(4.5, scale));
}

export function clampDurationMs(ms: number): number {
	if (Number.isNaN(ms)) return DEFAULT_DURATION_MS;
	return Math.max(MIN_DURATION_MS, Math.min(MAX_DURATION_MS, Math.round(ms)));
}

// frame count that spans the requested duration at the given fps, capped
export function framesForDuration(durationMs: number, fps: number): number {
	const f = Math.max(1, fps);
	const count = Math.round((clampDurationMs(durationMs) / 1000) * f);
	return Math.max(1, Math.min(MAX_CAPTURE_FRAMES, count));
}

// #region node / canvas resolution (pure)

export function resolveExportNode(
	opts: Pick<ExportOptions, 'node' | 'getNode'>
): HTMLElement | null {
	return opts.node ?? opts.getNode?.() ?? null;
}

export function resolveCanvas(
	node: HTMLElement | null,
	opts: Pick<ExportOptions, 'canvas' | 'canvasSelector'>
): HTMLCanvasElement | null {
	if (opts.canvas) return opts.canvas;
	if (node) {
		const sel = opts.canvasSelector || 'canvas';
		const found = node.querySelector(sel);
		if (found instanceof HTMLCanvasElement) return found;
	}
	// a bare canvas node is itself the source
	if (node instanceof HTMLCanvasElement) return node;
	return null;
}

// #region frame capture (pure, injectable)

export interface CapturedFrame {
	width: number;
	height: number;
	data: Uint8ClampedArray;
}

export interface FrameCaptureDeps {
	wait?: (ms: number) => Promise<void>;
	createCanvas?: () => HTMLCanvasElement;
}

const defaultWait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// snapshot RGBA pixels from a live (usually animated) canvas across N ticks; downscale to
// maxDimension so gif/apng encoding stays fast. injecting `wait` keeps this unit-testable.
export async function captureCanvasFrames(
	canvas: HTMLCanvasElement,
	opts: Pick<ExportOptions, 'frames' | 'fps' | 'durationMs' | 'maxDimension' | 'onProgress'> = {},
	deps: FrameCaptureDeps = {}
): Promise<CapturedFrame[]> {
	const fps = Math.max(1, opts.fps ?? DEFAULT_FPS);
	// a chosen duration wins over a raw frame count so the capture spans the full window
	const frames =
		opts.durationMs != null
			? framesForDuration(opts.durationMs, fps)
			: Math.max(1, Math.floor(opts.frames ?? DEFAULT_FRAMES));
	const delay = Math.round(1000 / fps);
	const wait = deps.wait ?? defaultWait;

	const { width, height } = scaledSize(
		canvas.width,
		canvas.height,
		opts.maxDimension ?? DEFAULT_MAX_DIMENSION
	);

	// reused scratch canvas so each tick reads a fixed-size RGBA frame
	const scratch = (deps.createCanvas ?? (() => document.createElement('canvas')))();
	scratch.width = width;
	scratch.height = height;
	const ctx = scratch.getContext('2d');

	const out: CapturedFrame[] = [];
	for (let i = 0; i < frames; i += 1) {
		if (ctx) {
			ctx.clearRect(0, 0, width, height);
			ctx.drawImage(canvas, 0, 0, width, height);
			const img = ctx.getImageData(0, 0, width, height);
			out.push({ width, height, data: img.data });
		}
		opts.onProgress?.((i + 1) / frames);
		if (i < frames - 1) await wait(delay);
	}
	return out;
}

export function scaledSize(
	width: number,
	height: number,
	maxDimension: number
): { width: number; height: number } {
	const largest = Math.max(width, height);
	if (!maxDimension || largest <= maxDimension)
		return { width: Math.max(1, width), height: Math.max(1, height) };
	const scale = maxDimension / largest;
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale))
	};
}

export function frameDelayMs(fps?: number): number {
	return Math.round(1000 / Math.max(1, fps ?? DEFAULT_FPS));
}

// #region data helpers (pure)

export function dataUrlToBlob(dataUrl: string): Blob {
	const [meta, payload] = dataUrl.split(',');
	if (!meta || !payload) throw new Error('Invalid data URL.');

	const mime = /data:([^;]+)/.exec(meta)?.[1] || 'application/octet-stream';
	if (/;base64/i.test(meta)) {
		const binary = atob(payload);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
		return new Blob([bytes], { type: mime });
	}
	return new Blob([decodeURIComponent(payload)], { type: mime });
}

// tight RGBA ArrayBuffers for upng-js (one per frame, matching w/h)
export function framesToRgbaBuffers(frames: CapturedFrame[]): ArrayBuffer[] {
	return frames.map((f) => {
		const view = f.data;
		return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
	});
}

// #region encoders (dynamic-imported heavy libs)

export async function renderStaticBlob(
	node: HTMLElement,
	format: 'svg' | 'png' | 'jpg',
	opts: Pick<ExportOptions, 'pixelRatio' | 'backgroundColor' | 'quality'> = {}
): Promise<Blob> {
	const htmlToImage = await import('html-to-image');
	const base = {
		pixelRatio: opts.pixelRatio ?? 2,
		cacheBust: true,
		backgroundColor: opts.backgroundColor
	};
	if (format === 'svg') return dataUrlToBlob(await htmlToImage.toSvg(node, base));
	if (format === 'jpg')
		return dataUrlToBlob(
			await htmlToImage.toJpeg(node, {
				...base,
				backgroundColor: opts.backgroundColor ?? '#ffffff',
				quality: opts.quality ?? 0.95
			})
		);
	return dataUrlToBlob(await htmlToImage.toPng(node, base));
}

export function toImageData(frame: CapturedFrame): ImageData {
	if (typeof ImageData !== 'undefined') {
		return new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height);
	}
	return frame as unknown as ImageData;
}

export async function encodeGif(
	frames: CapturedFrame[],
	opts: Pick<ExportOptions, 'fps' | 'quality' | 'onProgress'> = {}
): Promise<Blob> {
	const { default: GIF } = await import('gif.js');
	// build the worker from source so encoding stays self-contained (no external asset / CSP)
	const workerSource = (await import('gif.js/dist/gif.worker.js?raw')).default as string;
	const workerScript = URL.createObjectURL(
		new Blob([workerSource], { type: 'application/javascript' })
	);
	const first = frames[0];
	if (!first) throw new Error('No frames captured for GIF export.');

	const gif = new GIF({
		workers: 2,
		quality: opts.quality ?? 10,
		workerScript,
		width: first.width,
		height: first.height
	});
	const delay = frameDelayMs(opts.fps);
	for (const frame of frames) {
		// re-wrap as real ImageData so gif.js accepts the frame (see toImageData)
		gif.addFrame(toImageData(frame), { delay, copy: true });
	}

	return await new Promise<Blob>((resolve, reject) => {
		gif.on('progress', (ratio: number) => opts.onProgress?.(ratio));
		gif.on('finished', (blob: Blob) => {
			URL.revokeObjectURL(workerScript);
			resolve(blob);
		});
		gif.on('abort', () => {
			URL.revokeObjectURL(workerScript);
			reject(new Error('GIF encoding aborted.'));
		});
		gif.render();
	});
}

export async function encodeApng(
	frames: CapturedFrame[],
	opts: Pick<ExportOptions, 'fps' | 'onProgress'> = {}
): Promise<Blob> {
	const UPNG = (await import('upng-js')).default;
	const first = frames[0];
	if (!first) throw new Error('No frames captured for APNG export.');
	const buffers = framesToRgbaBuffers(frames);
	const delays = frames.map(() => frameDelayMs(opts.fps));
	// cnum 0 = lossless full-color apng
	const png = UPNG.encode(buffers, first.width, first.height, 0, delays);
	// upng encodes in one synchronous shot; report a single completion tick
	opts.onProgress?.(1);
	return new Blob([png], { type: 'image/png' });
}

export async function encodeAnimatedBlob(
	frames: CapturedFrame[],
	format: 'gif' | 'apng',
	opts: Pick<ExportOptions, 'fps' | 'quality' | 'onProgress'> = {}
): Promise<Blob> {
	return format === 'gif' ? encodeGif(frames, opts) : encodeApng(frames, opts);
}

// #region download (injectable)

export interface DownloadDeps {
	doc?: Document;
	createUrl?: (blob: Blob) => string;
	revokeUrl?: (url: string) => void;
}

export function triggerDownload(blob: Blob, filename: string, deps: DownloadDeps = {}): void {
	const doc = deps.doc ?? document;
	const createUrl = deps.createUrl ?? ((b: Blob) => URL.createObjectURL(b));
	const revokeUrl = deps.revokeUrl ?? ((u: string) => URL.revokeObjectURL(u));
	const url = createUrl(blob);
	const a = doc.createElement('a');
	a.href = url;
	a.download = filename;
	a.rel = 'noopener';
	doc.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => revokeUrl(url), 1000);
}

// #region composable

export type ExportPhase = 'idle' | 'capturing' | 'encoding' | 'rendering' | 'done';

export interface ExportRunDeps {
	captureFrames?: typeof captureCanvasFrames;
	encodeAnimated?: typeof encodeAnimatedBlob;
	renderStatic?: typeof renderStaticBlob;
	download?: typeof triggerDownload;
}

// frame capture is the first 60% of the bar; encoding / rendering fills the rest
const CAPTURE_SHARE = 0.6;

export function useMarketingExport() {
	const exporting: Ref<boolean> = ref(false);
	const progress: Ref<number> = ref(0);
	const phase: Ref<ExportPhase> = ref('idle');
	// current / total captured frames (drives the "Frame N/Total" counter)
	const frame: Ref<number> = ref(0);
	const frameTotal: Ref<number> = ref(0);

	function formatsFor(animated: boolean): ExportFormatMeta[] {
		return exportFormatMetas(animated);
	}

	async function exportAsset(
		opts: ExportOptions,
		deps: ExportRunDeps = {}
	): Promise<MarketingResult<void>> {
		if (!import.meta.client)
			return { success: false, error: 'Export is only available in the browser.' };
		if (exporting.value) return { success: false, error: 'An export is already in progress.' };

		const capture = deps.captureFrames ?? captureCanvasFrames;
		const encodeAnimated = deps.encodeAnimated ?? encodeAnimatedBlob;
		const renderStatic = deps.renderStatic ?? renderStaticBlob;
		const download = deps.download ?? triggerDownload;

		exporting.value = true;
		progress.value = 0;
		frame.value = 0;
		frameTotal.value = 0;
		phase.value = 'idle';
		try {
			const node = resolveExportNode(opts);
			const filename = exportFilename(opts.filename ?? 'marketing-asset', opts.format);

			let blob: Blob;
			if (isAnimatedFormat(opts.format)) {
				const canvas = resolveCanvas(node, opts);
				if (!canvas) throw new Error('No animated canvas was found to export.');
				const fps = Math.max(1, opts.fps ?? DEFAULT_FPS);
				frameTotal.value =
					opts.durationMs != null
						? framesForDuration(opts.durationMs, fps)
						: Math.max(1, Math.floor(opts.frames ?? DEFAULT_FRAMES));

				phase.value = 'capturing';
				const frames = await capture(canvas, {
					frames: opts.frames,
					fps: opts.fps,
					durationMs: opts.durationMs,
					maxDimension: opts.maxDimension,
					onProgress: (r) => {
						progress.value = r * CAPTURE_SHARE;
						frame.value = Math.round(r * frameTotal.value);
						opts.onProgress?.(r);
					}
				});

				phase.value = 'encoding';
				blob = await encodeAnimated(frames, opts.format as 'gif' | 'apng', {
					fps: opts.fps,
					quality: opts.quality,
					// encoding fills the remaining bar after capture
					onProgress: (r) => {
						progress.value = CAPTURE_SHARE + r * (1 - CAPTURE_SHARE);
					}
				});
			} else {
				phase.value = 'rendering';
				progress.value = 0.15;
				const staticFormat = opts.format as 'svg' | 'png' | 'jpg';
				if (opts.staticOverride) {
					// a self-rendering source (the garden canvas) produces the crisp high-res blob
					blob = await opts.staticOverride(staticFormat, opts.pixelRatio ?? 1);
				} else {
					if (!node) throw new Error('No preview element was found to export.');
					blob = await renderStatic(node, staticFormat, {
						pixelRatio: opts.pixelRatio,
						backgroundColor: opts.backgroundColor,
						quality: opts.quality
					});
				}
			}

			progress.value = 1;
			phase.value = 'done';
			download(blob, filename);
			return { success: true };
		} catch (e) {
			phase.value = 'idle';
			return { success: false, error: e instanceof Error ? e.message : 'Export failed.' };
		} finally {
			exporting.value = false;
		}
	}

	return { exporting, progress, phase, frame, frameTotal, formatsFor, exportAsset };
}
