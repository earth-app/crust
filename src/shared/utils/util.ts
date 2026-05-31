import { DateTime } from 'luxon';
import type { SortingOption } from '../types/global';
import type { User } from '../types/user';
import { DEFAULT_FULL_NAME } from '../types/user';

const requestQueue = new Map<string, Promise<any>>();

// LRU cache for API responses to prevent memory leaks. Disabled in test mode
// so that mock overrides (which can change response shape between tests) are
// always honored; otherwise the long-lived dev server's module-level cache
// would return stale data after a warmup or earlier test.
const MAX_CACHE_SIZE = 100;
const apiCache = new Map<string, any>();
const isApiCacheDisabled = (): boolean => {
	if (typeof process === 'undefined') return false;
	const env = process.env || {};
	return (
		env.NODE_ENV === 'test' || env.NUXT_DISABLE_API_CACHE === '1' || env.DISABLE_API_CACHE === '1'
	);
};

/**
 * TEST-ONLY: empty the in-process API cache so the dev server doesn't bleed
 * default mock data from a warmup or earlier test into the current test.
 * Used by `src/server/api/__test__/reset.post.ts`; do not call from app code.
 */
export function apiCache_TEST_ONLY_CLEAR(): void {
	apiCache.clear();
	requestQueue.clear();
}

export function invalidateAPICache(key: string): void {
	apiCache.delete(key);
}

const evictOldestCacheEntry = () => {
	if (apiCache.size >= MAX_CACHE_SIZE) {
		const firstKey = apiCache.keys().next().value;
		if (firstKey) apiCache.delete(firstKey);
	}
};

export async function makeRequest<T>(
	key: string | null,
	url: string,
	token: string | null | undefined = null,
	options: any = {}
): Promise<{ success: boolean; data?: T; message?: string }> {
	try {
		const allowMessageResponse = options.allowMessageResponse === true;
		const requestOptions = { ...options };
		delete requestOptions.allowMessageResponse;

		// Check client-side cache first
		if (!isApiCacheDisabled() && key && apiCache.has(key)) {
			return {
				success: true,
				data: apiCache.get(key)
			};
		}

		const queueKey = key ? `${url}::${key}` : url;

		const existingRequest = requestQueue.get(queueKey);
		if (existingRequest) {
			return existingRequest;
		}

		// create new request promise and add to queue
		const requestPromise = (async () => {
			try {
				const isBinaryRequest =
					url.includes('profile_photo') || requestOptions.responseType === 'blob';
				const authHeaders: Record<string, string> = {};
				if (token) {
					authHeaders['Authorization'] = `Bearer ${token}`;
				}

				if (isBinaryRequest) {
					const blob = await $fetch<Blob>(url, {
						headers: {
							...authHeaders,
							...(requestOptions.headers ?? {})
						},
						...requestOptions
					});

					return {
						success: true,
						data: blob as T
					};
				}

				// Handle regular JSON requests
				const data = await $fetch<T>(url, {
					headers: {
						...authHeaders,
						...(requestOptions.headers ?? {})
					},
					ignoreResponseError: true,
					...requestOptions
				}).catch((error) => {
					// Silently handle 404s - don't log or report
					const errorStr = error.toString();
					if (errorStr.includes('404')) {
						throw {
							is404: true,
							toString: () => '404'
						};
					}

					throw {
						message: `Error fetching ${key} from ${url}: ${error}`,
						error,
						toString: () => error.toString()
					};
				});

				// handle '204 No Content' as success with no data
				if (!data || data === null || data === undefined) {
					if (
						options.method === 'POST' ||
						options.method === 'DELETE' ||
						options.method === 'PATCH'
					) {
						return {
							success: true
						};
					}

					// 404 - return silently without message
					return {
						success: false
					};
				}

				if (typeof data === 'object' && 'message' in data && !allowMessageResponse) {
					return {
						success: false,
						data: data as any,
						message: (data as any).message || `Error fetching ${key} from ${url}`
					};
				}

				// Update LRU cache with fetched data
				if (!isApiCacheDisabled() && key) {
					evictOldestCacheEntry();
					apiCache.set(key, data as T);
				}

				return {
					success: true,
					data: data as T
				};
			} finally {
				// Clean up queue when request completes (success or failure)
				requestQueue.delete(queueKey);
			}
		})();

		// Store in queue before returning
		requestQueue.set(queueKey, requestPromise);
		return requestPromise;
	} catch (error: any) {
		if (error.is404 || error.toString().includes('404')) {
			return {
				success: false
			};
		}

		const value: string = error.toString();
		const data = error.data as { code: number; message: string } | undefined;

		if (value.includes('400')) {
			return {
				success: false,
				message: `Bad request: [400] ${data?.message || 'The request was invalid.'}`
			};
		}

		if (value.includes('429')) {
			return {
				success: false,
				message: `Rate limit exceeded. Please try again later.`
			};
		}

		if (value.includes('401') || value.includes('403')) {
			return {
				success: false,
				message: `Not authorized. Please check your credentials.`
			};
		}

		console.error(`Failed to fetch ${key || url}:`, error);

		return {
			success: false,
			message: 'An error occurred while fetching data.'
		};
	}
}

export async function makeAPIRequest<T>(
	key: string | null,
	url: string,
	token: string | null | undefined = null,
	options: any = {}
): Promise<{ success: boolean; data?: T; message?: string }> {
	const config = useRuntimeConfig();
	return await makeRequest<T>(key, `${config.public.apiBaseUrl}${url}`, token, options);
}

export async function makeClientAPIRequest<T>(
	url: string,
	token: string | null | undefined = null,
	options: any = {}
): Promise<{ success: boolean; data?: T; message?: string }> {
	const config = useRuntimeConfig();
	return await makeRequest<T>(null, `${config.public.apiBaseUrl}${url}`, token, options);
}

export async function makeServerRequest<T>(
	key: string | null,
	suburl: string,
	token: string | null | undefined = null,
	options: any = {}
) {
	try {
		const headers: Record<string, string> = {
			Accept: 'application/json'
		};

		if (token) {
			headers['Authorization'] = `Bearer ${token}`;
		}

		if (options.body && (options.method === 'POST' || options.method === 'PATCH')) {
			headers['Content-Type'] = 'application/json';
		}

		const data = await $fetch<T>(suburl, {
			...options,
			headers: {
				...headers,
				...(options.headers ?? {})
			}
		});

		return {
			success: true,
			data
		};
	} catch (error: any) {
		if (error.status !== 404 && error.statusCode !== 404) {
			console.error(`Failed to fetch ${key}:`, error);
		}

		return {
			success: false,
			message:
				error.data?.message || error.message || 'An error occurred while fetching server data.'
		};
	}
}

export async function paginatedAPIRequest<T>(
	url: string,
	token: string | null | undefined = null,
	options: any = {},
	limit: number = -1,
	search: string = '',
	sort: SortingOption = 'desc'
) {
	if (limit === 0) return { success: true, data: [] };

	const allItems: T[] = [];
	let currentPage = 1;
	const maxPages = 100;
	const encodedSearch = encodeURIComponent(search);

	while (currentPage <= maxPages) {
		const pageSize = limit > 0 ? Math.min(100, Math.max(limit - (currentPage - 1) * 100, 0)) : 100;

		if (pageSize === 0) {
			break;
		}

		const pageKey = `paginated-${url.replace(/\//g, '-')}-page${currentPage}-pageSize${pageSize}-limit${limit}-search${encodedSearch}-sort${sort}`;
		const res = await makeAPIRequest<{ items: T[]; total: number }>(
			pageKey,
			`${url}?page=${currentPage}&limit=${pageSize}&search=${encodedSearch}&sort=${sort}`,
			token,
			options
		);

		if (!valid(res) || !res.data || !Array.isArray(res.data.items)) {
			return {
				success: false,
				message: res.message || 'Failed to fetch paginated data.'
			};
		}

		allItems.push(...res.data.items);

		// Stop if we've reached the limit or got fewer items than requested
		if (res.data.items.length < pageSize || (limit > 0 && allItems.length >= limit)) {
			break;
		}

		currentPage++;
	}

	return { success: true, data: limit > 0 ? allItems.slice(0, limit) : allItems };
}

// Non-request related

export function toTitleCase(str: string): string {
	if (!str) return '';

	const smallWords = new Set([
		'a',
		'an',
		'and',
		'as',
		'at',
		'but',
		'by',
		'for',
		'if',
		'in',
		'is',
		'nor',
		'of',
		'on',
		'or',
		'the',
		'to',
		'with'
	]);

	const words = str.split(/\s+/);

	return words
		.map((word, index) => {
			const leadingMatch = word.match(/^[\s"'`«\[\(]*/);
			const leading = leadingMatch ? leadingMatch[0] : '';

			const trailingMatch = word.match(/[\s"'`»\]\).,;:!?-–-]*$/);
			const trailing = trailingMatch ? trailingMatch[0] : '';

			const core = word.slice(leading.length, word.length - trailing.length || word.length);

			// return empty if core is empty
			if (!core) return word;

			// always capitalize first and last word
			const isFirstWord = index === 0;
			const isLastWord = index === words.length - 1;
			const shouldCapitalize = isFirstWord || isLastWord || !smallWords.has(core.toLowerCase());

			const capitalizedCore = shouldCapitalize
				? core.charAt(0).toUpperCase() + core.slice(1).toLowerCase()
				: core.toLowerCase();

			return leading + capitalizedCore + trailing;
		})
		.join(' ');
}

export function capitalizeFully(str?: string): string {
	if (!str) return '';

	const parts = str.split(' ');
	return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ');
}

export function trimString(str?: string, maxLength?: number): string {
	if (!maxLength || maxLength <= 0) return str || '';
	if (!str) return '';
	if (str.length <= maxLength) return str;

	return str.slice(0, maxLength - 3) + '...';
}

export function withSuffix(num?: number): string {
	if (!num) return '0';
	if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
	if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
	if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
	return num.toString();
}

export function comma(num?: number): string {
	if (!num) return '0';
	return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function parseLooseDate(input?: string): DateTime | string {
	if (!input) return '';

	const formats = [
		'yyyy', // 2025
		'LL yyyy', // 06 2024
		'LLL yyyy', // Jun 2024
		'LLLL yyyy' // July 2025
	];

	for (const fmt of formats) {
		const dt = DateTime.fromFormat(input, fmt, { zone: 'utc', locale: 'en' });
		if (dt.isValid) {
			return dt;
		}
	}

	return input;
}

// User helpers

export function getUserDisplayName(
	user:
		| Pick<User, 'full_name' | 'username'>
		| { full_name?: string; username?: string }
		| null
		| undefined,
	opts?: { at?: boolean; anonymous?: string }
): string {
	if (!user) return opts?.anonymous ?? 'anonymous';

	const at = opts?.at ?? false;
	const anonymous = opts?.anonymous ?? 'anonymous';

	const full = user?.full_name && user.full_name !== DEFAULT_FULL_NAME ? user.full_name : undefined;
	if (full) return full;

	const base = user?.username ?? anonymous;
	return at ? `@${base}` : base;
}

export function realFullName(fullName?: string): string | undefined {
	if (!fullName) return undefined;
	return fullName !== DEFAULT_FULL_NAME ? fullName : undefined;
}

export function checkPropertyExists(obj: any | null | undefined, prop: string): boolean {
	if (!obj) return false;
	if (typeof obj !== 'object') return false;

	return prop in obj;
}

export function checkMessageInResponse(response: any): response is { message: string } {
	return checkPropertyExists(response, 'message') && typeof response.message === 'string';
}

type ValidResponse<T = any> = {
	success: true;
	data: NonNullable<T>;
	message?: never;
};

export const QUEST_DELAY_REDUCTION_BY_RANK: Record<string, number> = {
	FREE: 0,
	PRO: 0.1,
	WRITER: 0.25,
	ORGANIZER: 0.5,
	ADMINISTRATOR: 1
};

export function getQuestDelayReduction(accountType?: string | null): number {
	if (!accountType) return 0;
	return QUEST_DELAY_REDUCTION_BY_RANK[accountType.toUpperCase()] ?? 0;
}

export function getEffectiveQuestStepDelay(
	delaySeconds: number,
	accountType?: string | null
): number {
	if (!delaySeconds || delaySeconds <= 0) return 0;
	const reduction = getQuestDelayReduction(accountType);
	if (reduction >= 1) return 0;
	return Math.round(delaySeconds * (1 - reduction));
}

export function valid<T>(
	res?: {
		success?: boolean;
		data?: T;
		message?: string;
	},
	checkMessage: boolean = true
): res is ValidResponse<T> {
	if (!res) return false;
	if (res.success) return true;
	if (checkMessage && checkMessageInResponse(res)) return false;
	if (res.data !== undefined) return true;

	return false;
}
