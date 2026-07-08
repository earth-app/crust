import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useClientModeration, useReport } from '~/composables/useReport';

const { mockClassify, mockRecognize, nsfwLoad, createWorker } = vi.hoisted(() => {
	const mockClassify = vi.fn();
	const mockRecognize = vi.fn();
	return {
		mockClassify,
		mockRecognize,
		nsfwLoad: vi.fn(async () => ({ classify: mockClassify })),
		createWorker: vi.fn(async () => ({ recognize: mockRecognize }))
	};
});

vi.mock('@tensorflow/tfjs', () => ({
	setBackend: vi.fn(async () => true),
	ready: vi.fn(async () => undefined)
}));
vi.mock('nsfwjs', () => ({ load: nsfwLoad }));
vi.mock('tesseract.js', () => ({ createWorker }));

function setTestBuild(on: boolean) {
	(useRuntimeConfig().public as any).testBuild = on;
}

// network mock for the report endpoints; pure helpers stay real
vi.mock('utils', async (io) => {
	const actual = await io<typeof import('utils')>();
	return { ...actual, makeAPIRequest: vi.fn() };
});

import { makeAPIRequest } from 'utils';

// nsfwjs returns five class probabilities; build a full set with overrides
function preds(over: Partial<Record<'Porn' | 'Hentai' | 'Sexy' | 'Neutral' | 'Drawing', number>>) {
	const base = { Neutral: 0.99, Drawing: 0.01, Porn: 0.0, Hentai: 0.0, Sexy: 0.0, ...over };
	return Object.entries(base).map(([className, probability]) => ({ className, probability }));
}

class FakeImage {
	crossOrigin = '';
	onload: (() => void) | null = null;
	onerror: ((e: unknown) => void) | null = null;
	#src = '';
	set src(v: string) {
		this.#src = v;
		queueMicrotask(() => {
			if (v.includes('IMG_ERROR')) this.onerror?.(new Error('decode failed'));
			else this.onload?.();
		});
	}
	get src() {
		return this.#src;
	}
}

const pngFile = (parts: BlobPart[] = ['imgdata']) =>
	new File(parts, 'submission.png', { type: 'image/png' });

let origCreate: any;
let origRevoke: any;

beforeEach(() => {
	setActivePinia(createPinia());
	vi.clearAllMocks();
	setTestBuild(false);
	useToast().clear(); // shared toast state isn't pinia-scoped; reset between tests

	// default model/OCR verdicts: clean image, no OCR text
	mockClassify.mockResolvedValue(preds({}));
	mockRecognize.mockResolvedValue({ data: { text: '' } });

	vi.stubGlobal('Image', FakeImage as unknown as typeof Image);
	origCreate = (URL as any).createObjectURL;
	origRevoke = (URL as any).revokeObjectURL;
	(URL as any).createObjectURL = vi.fn(() => 'blob:mock');
	(URL as any).revokeObjectURL = vi.fn();
});

afterEach(() => {
	vi.unstubAllGlobals();
	(URL as any).createObjectURL = origCreate;
	(URL as any).revokeObjectURL = origRevoke;
});

describe('useClientModeration › checkText', () => {
	it('allows empty / whitespace-only text without loading the matcher', async () => {
		const { checkText } = useClientModeration();
		expect(await checkText('')).toEqual({ allowed: true });
		expect(await checkText('   \n  ')).toEqual({ allowed: true });
	});

	it('allows ordinary text', async () => {
		const { checkText } = useClientModeration();
		const verdict = await checkText('I went hiking this weekend and saw a beautiful sunset.');
		expect(verdict).toEqual({ allowed: true });
	});

	it('blocks profanity via the real obscenity matcher', async () => {
		const { checkText } = useClientModeration();
		const verdict = await checkText('what the fuck is this garbage');
		expect(verdict).toEqual({
			allowed: false,
			category: 'profanity',
			detail: 'profanity detected'
		});
	});

	it('blocks when more than five urls are present (spam)', async () => {
		const { checkText } = useClientModeration();
		const text =
			'deal https://a.com https://b.com https://c.com https://d.com https://e.com www.f.com';
		expect((await checkText(text)).category).toBe('spam');
	});

	it('blocks absurd token repetition (spam)', async () => {
		const { checkText } = useClientModeration();
		expect((await checkText('buy '.repeat(12).trim())).category).toBe('spam');
	});

	it('blocks a single character repeated absurdly (spam)', async () => {
		const { checkText } = useClientModeration();
		expect((await checkText('noooo' + 'o'.repeat(40))).category).toBe('spam');
	});

	it('blocks long all-caps shouting (spam)', async () => {
		const { checkText } = useClientModeration();
		const shout = 'THIS IS AN ABSOLUTELY ENORMOUS SHOUTING MESSAGE RIGHT HERE';
		expect((await checkText(shout)).category).toBe('spam');
	});
});

describe('useClientModeration › checkImage', () => {
	it('blocks when Porn meets the threshold', async () => {
		mockClassify.mockResolvedValue(preds({ Porn: 0.6, Neutral: 0.2 }));
		const { checkImage } = useClientModeration();
		expect(await checkImage(pngFile())).toEqual({
			allowed: false,
			category: 'nsfw_image',
			detail: 'nsfw image detected'
		});
	});

	it('blocks when Hentai meets the threshold', async () => {
		mockClassify.mockResolvedValue(preds({ Hentai: 0.7, Neutral: 0.2 }));
		const { checkImage } = useClientModeration();
		expect((await checkImage(pngFile())).category).toBe('nsfw_image');
	});

	it('blocks when Sexy meets its (higher) threshold', async () => {
		mockClassify.mockResolvedValue(preds({ Sexy: 0.85, Neutral: 0.1 }));
		const { checkImage } = useClientModeration();
		expect((await checkImage(pngFile())).category).toBe('nsfw_image');
	});

	it('allows a borderline Sexy score below its threshold', async () => {
		mockClassify.mockResolvedValue(preds({ Sexy: 0.8, Neutral: 0.15 }));
		const { checkImage } = useClientModeration();
		expect(await checkImage(pngFile())).toEqual({ allowed: true });
	});

	it('blocks profanity baked into an image via OCR', async () => {
		mockClassify.mockResolvedValue(preds({}));
		mockRecognize.mockResolvedValue({ data: { text: 'you absolute fuck' } });
		const { checkImage } = useClientModeration();
		expect((await checkImage(pngFile())).category).toBe('profanity');
	});

	it('blocks spam text baked into an image via OCR', async () => {
		mockClassify.mockResolvedValue(preds({}));
		mockRecognize.mockResolvedValue({
			data: {
				text: 'https://a.com https://b.com https://c.com https://d.com https://e.com www.f.com'
			}
		});
		const { checkImage } = useClientModeration();
		expect((await checkImage(pngFile())).category).toBe('spam');
	});

	it('allows a clean image (no nsfw signal, no ocr text)', async () => {
		const { checkImage } = useClientModeration();
		expect(await checkImage(pngFile())).toEqual({ allowed: true });
	});

	it('treats a classify failure as non-fatal and still runs OCR', async () => {
		mockClassify.mockRejectedValue(new Error('model exploded'));
		mockRecognize.mockResolvedValue({ data: { text: 'what the fuck' } });
		const { checkImage } = useClientModeration();
		// classify threw, but the OCR fallback still catches the profanity
		expect((await checkImage(pngFile())).category).toBe('profanity');
	});

	it('fails open when classify fails and OCR is clean', async () => {
		mockClassify.mockRejectedValue(new Error('model exploded'));
		const { checkImage } = useClientModeration();
		expect(await checkImage(pngFile())).toEqual({ allowed: true });
	});

	it('fails open when the image cannot be decoded', async () => {
		const { checkImage } = useClientModeration();
		// string input routed straight to <img src>; IMG_ERROR triggers onerror
		expect(await checkImage('https://cdn.example/IMG_ERROR.png')).toEqual({ allowed: true });
		// never reached the model
		expect(mockClassify).not.toHaveBeenCalled();
	});

	it('fails open when image work hangs past the timeout', async () => {
		vi.useFakeTimers();
		mockClassify.mockReturnValue(new Promise(() => {})); // never resolves
		const { checkImage } = useClientModeration();
		const p = checkImage(pngFile());
		await vi.advanceTimersByTimeAsync(8100);
		await expect(p).resolves.toEqual({ allowed: true });
		vi.useRealTimers();
	});
});

describe('useClientModeration › test-build signature hook', () => {
	it('rejects a magic nsfw byte prefix without touching the model', async () => {
		setTestBuild(true);
		const { checkImage } = useClientModeration();
		const verdict = await checkImage(pngFile(['EARTHAPP_MOD_NSFW\x89PNG fake bytes']));
		expect(verdict).toEqual({
			allowed: false,
			category: 'nsfw_image',
			detail: 'nsfw image detected'
		});
		expect(mockClassify).not.toHaveBeenCalled();
	});

	it('maps the profanity and spam signatures too', async () => {
		setTestBuild(true);
		const { checkImage } = useClientModeration();
		expect((await checkImage(pngFile(['EARTHAPP_MOD_PROFANITY here']))).category).toBe('profanity');
		expect((await checkImage(pngFile(['EARTHAPP_MOD_SPAM here']))).category).toBe('spam');
	});

	it('ignores the signature when the test-build flag is off', async () => {
		setTestBuild(false);
		mockClassify.mockResolvedValue(preds({})); // clean
		const { checkImage } = useClientModeration();
		// signature present, but the hook is inert → real (clean) path runs
		expect(await checkImage(pngFile(['EARTHAPP_MOD_NSFW bytes']))).toEqual({ allowed: true });
	});

	it('allows a non-seeded image in test builds without running the model', async () => {
		setTestBuild(true);
		const { checkImage } = useClientModeration();
		// no signature -> test builds must NOT run real nsfwjs (it can't fetch its model under e2e
		// network blocking and would burn the full timeout on every image submit); allow immediately
		expect(await checkImage(pngFile(['just some plain bytes']))).toEqual({ allowed: true });
		expect(mockClassify).not.toHaveBeenCalled();
	});
});

const ok = <T>(data: T) => ({ success: true as const, data });
const fail = (message = 'boom') => ({ success: false as const, message });

describe('useReport', () => {
	it('submitReport posts the normalized body and toasts success', async () => {
		(makeAPIRequest as any).mockResolvedValue(ok({ report: { id: 'r1' }, deduped: false }));
		const { submitReport } = useReport();

		const res = await submitReport('article', 'a1', {
			reason: 'spam',
			description: '  spammy  ',
			parentId: 'p1'
		});

		expect(res.success).toBe(true);
		const [, path, , opts] = (makeAPIRequest as any).mock.calls[0];
		expect(path).toBe('/v2/reports');
		expect(opts.method).toBe('POST');
		expect(opts.body).toEqual({
			content_type: 'article',
			content_id: 'a1',
			reason: 'spam',
			parent_id: 'p1',
			description: 'spammy'
		});
		// real toast state (not mocked) carries the success toast
		expect(useToast().toasts.value.some((t) => t.color === 'success')).toBe(true);
	});

	it('omits parent_id and blank descriptions from the body', async () => {
		(makeAPIRequest as any).mockResolvedValue(ok({}));
		const { submitReport } = useReport();

		await submitReport('user', 'u1', { reason: 'other', description: '   ' });

		const body = (makeAPIRequest as any).mock.calls[0][3].body;
		expect(body).toEqual({ content_type: 'user', content_id: 'u1', reason: 'other' });
		expect(body).not.toHaveProperty('parent_id');
		expect(body).not.toHaveProperty('description');
	});

	it('surfaces an error toast when the submit fails', async () => {
		(makeAPIRequest as any).mockResolvedValue(fail('nope'));
		const { submitReport } = useReport();

		const res = await submitReport('event', 'e1', { reason: 'spam' });

		expect(res.success).toBe(false);
		const errorToast = useToast().toasts.value.find((t) => t.color === 'error');
		expect(errorToast?.description).toBe('nope');
	});

	it('listReports builds the status/page/limit query', async () => {
		(makeAPIRequest as any).mockResolvedValue(ok({}));
		const { listReports } = useReport();

		await listReports('actioned', 2, 10);

		expect((makeAPIRequest as any).mock.calls[0][1]).toBe(
			'/v2/reports?status=actioned&page=2&limit=10'
		);
	});

	it('listReports defaults to pending / page 1 / limit 50', async () => {
		(makeAPIRequest as any).mockResolvedValue(ok({}));
		const { listReports } = useReport();

		await listReports();

		expect((makeAPIRequest as any).mock.calls[0][1]).toBe(
			'/v2/reports?status=pending&page=1&limit=50'
		);
	});

	it('patchReport targets the report id with a PATCH body', async () => {
		(makeAPIRequest as any).mockResolvedValue(ok({}));
		const { patchReport } = useReport();

		await patchReport('r9', { action: 'ban_user', notes: 'repeat offender' });

		const [, path, , opts] = (makeAPIRequest as any).mock.calls[0];
		expect(path).toBe('/v2/reports/r9');
		expect(opts.method).toBe('PATCH');
		expect(opts.body).toEqual({ action: 'ban_user', notes: 'repeat offender' });
	});
});
