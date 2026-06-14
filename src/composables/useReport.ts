import { useAuthStore } from 'stores/auth';
import type { ContentType, Report, ReportListItem, ReportReason, ReportStatus } from 'types/report';
import { makeAPIRequest } from 'utils';

type SubmitOptions = {
	parentId?: string;
	reason: ReportReason;
	description?: string;
};

type AdminAction = 'dismiss' | 'delete_content' | 'ban_user';

type PatchBody = {
	action: AdminAction;
	notes?: string;
	notify_reporter?: boolean;
	notify_author?: boolean;
};

export function useReport() {
	const authStore = useAuthStore();
	const toast = useToast();

	// anon allowed; sessionToken may be null
	const submitReport = async (contentType: ContentType, contentId: string, opts: SubmitOptions) => {
		const body: Record<string, unknown> = {
			content_type: contentType,
			content_id: contentId,
			reason: opts.reason
		};
		if (opts.parentId) body.parent_id = opts.parentId;
		if (opts.description?.trim()) body.description = opts.description.trim();

		const res = await makeAPIRequest<{ report: Report; deduped: boolean }>(
			null,
			'/v2/reports',
			authStore.sessionToken,
			{ method: 'POST', body }
		);

		if (res.success) {
			toast.add({
				title: 'Report Submitted',
				description: 'Report submitted, thank you!',
				icon: 'mdi:flag-checkered',
				color: 'success',
				duration: 5000
			});
		} else {
			toast.add({
				title: 'Could Not Submit Report',
				description: res.message || 'An error occurred while submitting your report.',
				icon: 'mdi:alert-circle',
				color: 'error',
				duration: 6000
			});
		}

		return res;
	};

	const listReports = async (status: ReportStatus = 'pending', page = 1, limit = 50) => {
		return await makeAPIRequest<{
			reports: ReportListItem[];
			page: number;
			limit: number;
			total?: number;
			cursor?: string;
		}>(null, `/v2/reports?status=${status}&page=${page}&limit=${limit}`, authStore.sessionToken);
	};

	const patchReport = async (id: string, body: PatchBody) => {
		return await makeAPIRequest<
			Report & { enforced_action: 'none' | 'disable_1_month' | 'permanent_ban' }
		>(null, `/v2/reports/${id}`, authStore.sessionToken, { method: 'PATCH', body });
	};

	return { submitReport, listReports, patchReport };
}

export type ModerationVerdict = {
	allowed: boolean;
	category?: 'nsfw_image' | 'profanity' | 'spam';
	detail?: string;
};

// nsfwjs thresholds — match sky so the two stay consistent
const NSFW_PORN_THRESHOLD = 0.6;
const NSFW_HENTAI_THRESHOLD = 0.6;
const NSFW_SEXY_THRESHOLD = 0.85;

// per-check timeout; model/ocr work can hang, so cap it
const CHECK_TIMEOUT_MS = 8000;

// module-scope caches so models/workers load once
let nsfwModel: any = null;
let nsfwModelPromise: Promise<any> | null = null;
let tesseractWorker: any = null;
let tesseractWorkerPromise: Promise<any> | null = null;
let obscenityMatcher: any = null;

const ALLOW: ModerationVerdict = { allowed: true };

// resolves to a fallback verdict if the work takes too long (fail-open)
function withTimeout<T>(work: Promise<T>, fallback: T, ms = CHECK_TIMEOUT_MS): Promise<T> {
	return new Promise<T>((resolve) => {
		let settled = false;
		const timer = setTimeout(() => {
			if (!settled) {
				settled = true;
				resolve(fallback);
			}
		}, ms);
		work
			.then((value) => {
				if (!settled) {
					settled = true;
					clearTimeout(timer);
					resolve(value);
				}
			})
			.catch(() => {
				if (!settled) {
					settled = true;
					clearTimeout(timer);
					resolve(fallback);
				}
			});
	});
}

async function getObscenityMatcher(): Promise<any> {
	if (obscenityMatcher) return obscenityMatcher;
	const { RegExpMatcher, englishDataset, englishRecommendedTransformers } =
		await import('obscenity');
	obscenityMatcher = new RegExpMatcher({
		...englishDataset.build(),
		...englishRecommendedTransformers
	});
	return obscenityMatcher;
}

async function getNsfwModel(): Promise<any> {
	if (nsfwModel) return nsfwModel;
	if (nsfwModelPromise) return nsfwModelPromise;

	nsfwModelPromise = (async () => {
		const tf = await import('@tensorflow/tfjs');
		const nsfwjs = await import('nsfwjs');
		// prefer webgl, fall back gracefully if unavailable
		try {
			await tf.setBackend('webgl');
		} catch {
			try {
				await tf.setBackend('cpu');
			} catch {
				// leave tf on whatever default it picked
			}
		}
		await tf.ready();
		const model = await nsfwjs.load();
		nsfwModel = model;
		return model;
	})();

	try {
		return await nsfwModelPromise;
	} catch {
		// reset so a later check can retry; fail-open this time
		nsfwModelPromise = null;
		return null;
	}
}

async function getTesseractWorker(): Promise<any> {
	if (tesseractWorker) return tesseractWorker;
	if (tesseractWorkerPromise) return tesseractWorkerPromise;

	tesseractWorkerPromise = (async () => {
		// tesseract pulls worker/wasm/traineddata from a cdn by default;
		// if offline/blocked this rejects and we fail-open
		const { createWorker } = await import('tesseract.js');
		const worker = await createWorker('eng');
		tesseractWorker = worker;
		return worker;
	})();

	try {
		return await tesseractWorkerPromise;
	} catch {
		tesseractWorkerPromise = null;
		return null;
	}
}

// light spam heuristics: too many urls, absurd repetition, or long all-caps shouting
function looksLikeSpam(text: string): boolean {
	const urlCount = (text.match(/https?:\/\/|www\./gi) || []).length;
	if (urlCount > 5) return true;

	// absurd repetition: same token repeated many times in a row
	if (/(\b\w+\b)(?:\s+\1){9,}/i.test(text)) return true;
	// same character repeated absurdly
	if (/(.)\1{29,}/.test(text)) return true;

	// long all-caps shouting block
	const letters = text.replace(/[^a-z]/gi, '');
	if (letters.length >= 40) {
		const upper = (text.match(/[A-Z]/g) || []).length;
		if (upper / letters.length > 0.9) return true;
	}

	return false;
}

async function runTextCheck(text: string): Promise<ModerationVerdict> {
	const trimmed = (text || '').trim();
	if (!trimmed) return ALLOW;

	const matcher = await getObscenityMatcher();
	if (matcher && matcher.hasMatch(trimmed)) {
		return { allowed: false, category: 'profanity', detail: 'profanity detected' };
	}

	if (looksLikeSpam(trimmed)) {
		return { allowed: false, category: 'spam', detail: 'spam heuristics matched' };
	}

	return ALLOW;
}

// normalize Blob/File/dataurl into something nsfwjs + tesseract can read
async function toImageElement(input: Blob | File | string): Promise<HTMLImageElement | null> {
	if (typeof document === 'undefined') return null;

	const src = typeof input === 'string' ? input : URL.createObjectURL(input);
	try {
		const img = await new Promise<HTMLImageElement>((resolve, reject) => {
			const el = new Image();
			el.crossOrigin = 'anonymous';
			el.onload = () => resolve(el);
			el.onerror = (e) => reject(e);
			el.src = src;
		});
		return img;
	} catch {
		return null;
	} finally {
		if (typeof input !== 'string') {
			// revoke after a tick so decode can finish
			setTimeout(() => URL.revokeObjectURL(src), 0);
		}
	}
}

async function runImageCheck(input: Blob | File | string): Promise<ModerationVerdict> {
	const img = await toImageElement(input);
	if (!img) return ALLOW;

	// nsfw classification — non-fatal on failure
	try {
		const model = await getNsfwModel();
		if (model) {
			const predictions: Array<{ className: string; probability: number }> =
				await model.classify(img);
			const score = (name: string) =>
				predictions.find((p) => p.className === name)?.probability ?? 0;

			if (
				score('Porn') >= NSFW_PORN_THRESHOLD ||
				score('Hentai') >= NSFW_HENTAI_THRESHOLD ||
				score('Sexy') >= NSFW_SEXY_THRESHOLD
			) {
				return { allowed: false, category: 'nsfw_image', detail: 'nsfw image detected' };
			}
		}
	} catch {
		// model/classify failure is non-fatal
	}

	// ocr the image and run the extracted text through the text check
	// catches profanity/spam baked into images; non-fatal on failure
	try {
		const worker = await getTesseractWorker();
		if (worker) {
			const result = await worker.recognize(img);
			const ocrText: string = result?.data?.text || '';
			if (ocrText.trim()) {
				const textVerdict = await runTextCheck(ocrText);
				if (!textVerdict.allowed) return textVerdict;
			}
		}
	} catch {
		// ocr failure is non-fatal
	}

	return ALLOW;
}

// test-only deterministic hook. the real nsfw model needs a network load and
// actual explicit imagery to trip, neither of which belongs in e2e. instead a
// magic ascii prefix in the first bytes of an upload maps to a prohibited
// verdict so the block path can be driven without shipping explicit material.
// gated on the test-build flag in useClientModeration, so it is inert in prod.
const TEST_SIGNATURES: Array<[string, ModerationVerdict]> = [
	['EARTHAPP_MOD_NSFW', { allowed: false, category: 'nsfw_image', detail: 'nsfw image detected' }],
	[
		'EARTHAPP_MOD_PROFANITY',
		{ allowed: false, category: 'profanity', detail: 'profanity detected' }
	],
	['EARTHAPP_MOD_SPAM', { allowed: false, category: 'spam', detail: 'spam heuristics matched' }]
];

async function testSignatureVerdict(
	input: Blob | File | string
): Promise<ModerationVerdict | null> {
	if (typeof input === 'string') {
		for (const [sig, verdict] of TEST_SIGNATURES) if (input.includes(sig)) return verdict;
		return null;
	}
	try {
		const head = await input.slice(0, 64).text();
		for (const [sig, verdict] of TEST_SIGNATURES) if (head.includes(sig)) return verdict;
	} catch {
		// unreadable input — let the real check decide
	}
	return null;
}

export function useClientModeration() {
	// true only in test builds (see nuxt.config public runtimeConfig); never in prod
	const moderationTestMode = !!useRuntimeConfig().public.testBuild;

	async function checkText(text: string): Promise<ModerationVerdict> {
		// these only run in client event handlers; guard in case a handler ever fires during ssr
		if (!import.meta.client) return ALLOW;
		try {
			return await withTimeout(runTextCheck(text), ALLOW);
		} catch {
			return ALLOW;
		}
	}

	async function checkImage(input: Blob | File | string): Promise<ModerationVerdict> {
		if (!import.meta.client) return ALLOW;
		try {
			// deterministic e2e hook (inert in production) — exercises the block path
			if (moderationTestMode) {
				const seeded = await testSignatureVerdict(input);
				if (seeded) return seeded;
			}
			return await withTimeout(runImageCheck(input), ALLOW);
		} catch {
			return ALLOW;
		}
	}

	return { checkText, checkImage };
}
