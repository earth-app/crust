import type { Page } from '@playwright/test';

export interface AvatarState {
	id: string;
	src: string;
	t: number;
}

export const FALLBACK_SRC = /\/(earth-app|favicon)\.png$/;
export const PHOTO_ROUTE = /\/profile_photo(\?|$)/;

const PNG_8X8 = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAEUlEQVR4nGNgaHD4jxePDAUAS79vwTwEAxsAAAAASUVORK5CYII=',
	'base64'
);

/**
 * Record every src an avatar <img> takes, across SPA navigations and full reloads.
 *
 * A single assertion cannot see a flicker - it samples whatever state the element happens to be
 * in. The store publishes through a computed, so the defect is a TRANSITION and only the sequence
 * shows it.
 *
 * An element enrols the first time it points at the photo endpoint, and the src it held just
 * before that is back-filled. Enrolling on the placeholder filenames instead would sweep up the
 * site logo, which is served from those same two files and never changes.
 */
export async function traceAvatars(page: Page, avatarSelector?: string): Promise<void> {
	await page.addInitScript((selector: string | undefined) => {
		const w = window as unknown as {
			__avatarTrace?: { id: string; src: string; t: number }[];
		};
		if (w.__avatarTrace) return;
		w.__avatarTrace = [];

		const lastSrc = new WeakMap<Element, string>();

		const push = (id: string, src: string) => {
			const trace = w.__avatarTrace!;
			for (let i = trace.length - 1; i >= 0; i--) {
				if (trace[i].id === id) {
					if (trace[i].src === src) return;
					break;
				}
			}
			trace.push({ id, src, t: Date.now() });
		};

		// key by WHOSE photo this is, not by the element. navigating remounts the element, and a
		// per-element stream would split "settled on the placeholder" and "back to the photo url"
		// into two short streams with no visible transition between them
		const keyFor = (src: string) => {
			const match = src.match(/^(.*\/profile_photo)(\?|$)/);
			return match ? match[1] : null;
		};

		const record = (el: Element) => {
			if (!(el instanceof HTMLImageElement)) return;
			const src = el.getAttribute('src') ?? '';
			const previous = lastSrc.get(el);
			lastSrc.set(el, src);

			// the photo url is the timing-free signal, but a surface that gates first paint
			// (sky's splash) can settle before the element ever mounts, so a caller-supplied
			// container is the way to enrol an avatar that only ever showed the placeholder
			const inContainer = !!selector && !!el.closest(selector);
			const key = keyFor(src) ?? el.dataset.avatarKey ?? (inContainer ? selector! : null);
			if (!key) return;

			const first = !el.dataset.avatarKey;
			el.dataset.avatarKey = key;
			if (first && previous !== undefined) push(key, previous);

			push(key, src);
		};

		const sweep = (root: ParentNode) => root.querySelectorAll('img').forEach(record);

		const start = () => {
			new MutationObserver((records) => {
				for (const r of records) {
					if (r.type === 'attributes') record(r.target as Element);
					r.addedNodes.forEach((n) => {
						if (n instanceof HTMLImageElement) record(n);
						else if (n instanceof Element) sweep(n);
					});
				}
			}).observe(document, {
				subtree: true,
				childList: true,
				attributes: true,
				attributeFilter: ['src']
			});
			sweep(document);
		};

		// the init script runs at document-start, where documentElement may not exist yet
		if (document.documentElement) start();
		else document.addEventListener('readystatechange', start, { once: true });
	}, avatarSelector);
}

export async function readAvatarTrace(page: Page): Promise<AvatarState[]> {
	return page.evaluate(
		() => (window as unknown as { __avatarTrace?: AvatarState[] }).__avatarTrace ?? []
	);
}

export function avatarStates(trace: AvatarState[], id: string): string[] {
	return trace.filter((entry) => entry.id === id).map((entry) => entry.src);
}

/**
 * Assert no avatar climbed back out of a SETTLED placeholder.
 *
 * The legitimate sequence is `placeholder (auth not resolved yet) -> photo url -> photo or
 * placeholder`, ending in a one-way settle. The flicker is the step after that: once the store has
 * answered "no photo" the element must stay on the placeholder, and anything that republishes
 * "we don't know yet" over that verdict shows up here as a return to the photo url.
 */
export function expectNoPlaceholderWobble(trace: AvatarState[]): void {
	const byElement = new Map<string, AvatarState[]>();
	for (const entry of trace) {
		if (!byElement.has(entry.id)) byElement.set(entry.id, []);
		byElement.get(entry.id)!.push(entry);
	}

	const wobbles: string[] = [];
	for (const [id, states] of byElement) {
		let sawPhoto = false;
		let settledOnPlaceholder = false;

		for (const state of states) {
			const isPlaceholder = FALLBACK_SRC.test(state.src);
			if (!isPlaceholder) {
				if (settledOnPlaceholder) {
					wobbles.push(`img#${id}: ${states.map((s) => s.src).join(' -> ')}`);
					break;
				}
				sawPhoto = true;
			} else if (sawPhoto) {
				settledOnPlaceholder = true;
			}
		}
	}

	if (wobbles.length > 0) {
		throw new Error(`avatar left the placeholder after settling on it:\n${wobbles.join('\n')}`);
	}
}

// a local mock answers before the first paint, so the store settles and the element never shows
// the photo url at all. real latency is what puts the app in the in-flight state the flicker
// lives in, so every handler here holds the response for a beat
const NETWORK_MS = 250;

const hold = () => new Promise((resolve) => setTimeout(resolve, NETWORK_MS));

/** Serve real bytes to <img> loads; fail the first `failFetches` blob fetches. */
export async function servePhoto(page: Page, failFetches = 0, status = 503) {
	const counts = { fetches: 0, images: 0 };

	await page.route(PHOTO_ROUTE, async (route) => {
		if (route.request().resourceType() === 'image') {
			counts.images++;
			return route.fulfill({ status: 200, contentType: 'image/png', body: PNG_8X8 });
		}

		counts.fetches++;
		const failing = counts.fetches <= failFetches;
		await hold();

		if (failing) {
			return route.fulfill({ status, contentType: 'text/plain', body: 'upstream error' });
		}
		return route.fulfill({ status: 200, contentType: 'image/png', body: PNG_8X8 });
	});

	return counts;
}

/** The endpoint says this user has no photo. Counts only the blob fetches, not <img> loads. */
export async function servePhotoMissing(page: Page) {
	const counts = { fetches: 0 };

	await page.route(PHOTO_ROUTE, async (route) => {
		if (route.request().resourceType() !== 'image') counts.fetches++;
		await hold();
		return route.fulfill({
			status: 404,
			contentType: 'application/json',
			body: '{"message":"Profile photo not found","code":404}'
		});
	});

	return counts;
}

export { PNG_8X8 };
