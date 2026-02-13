import { DateTime } from 'luxon';
import type { SortingOption } from './types/global';
import type { User } from './types/user';
import { DEFAULT_FULL_NAME } from './types/user';

// Global request queue to prevent duplicate concurrent requests
const requestQueue = new Map<string, Promise<any>>();

export async function makeRequest<T>(
	key: string | null,
	url: string,
	token: string | null | undefined = null,
	options: any = {}
): Promise<{ success: boolean; data?: T | { code: number; message: string }; message?: string }> {
	try {
		// Use state for keys - check cache FIRST for best performance
		let cached: ReturnType<typeof useState<T | null | undefined>> | null = null;
		if (key) {
			cached = useState<T | null | undefined>(key, () => undefined);

			if (cached.value !== undefined && cached.value !== null) {
				return {
					success: true,
					data: cached.value
				};
			}
		}

		const queueKey = key ? `${url}::${key}` : url;

		// Check if this exact request is already in progress
		const existingRequest = requestQueue.get(queueKey);
		if (existingRequest) {
			return existingRequest;
		}

		// Create new request promise and add to queue
		const requestPromise = (async () => {
			try {
				// Check if this is a request for binary data (like images)
				const isBinaryRequest = url.includes('profile_photo') || options.responseType === 'blob';

				if (isBinaryRequest) {
					const headers: Record<string, string> = {};
					if (token) {
						headers['Authorization'] = `Bearer ${token}`;
					}

					const blob = await $fetch<Blob>(url, {
						headers,
						...options
					});

					return {
						success: true,
						data: blob as T
					};
				}

				// Handle regular JSON requests
				const data = await $fetch<T>(url, {
					headers: {
						Authorization: `Bearer ${token}`
					},
					ignoreResponseError: true,
					...options
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
						data,
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

				if (typeof data === 'object' && 'message' in data) {
					return {
						success: false,
						data: data as any,
						message: (data as any).message || `Error fetching ${key} from ${url}`
					};
				}

				// Update cache with fetched data
				if (cached) {
					cached.value = data as T;
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
				message: `Bad request: ${data?.message || 'The request was invalid.'}`,
				data: data || { code: 400, message: 'Bad Request' }
			};
		}

		if (value.includes('429')) {
			return {
				success: false,
				message: `Rate limit exceeded. Please try again later.`,
				data
			};
		}

		if (value.includes('401') || value.includes('403')) {
			return {
				success: false,
				message: `Not authorized. Please check your credentials.`,
				data: data || { code: value.includes('401') ? 401 : 403, message: 'Not authorized' }
			};
		}

		console.error(`Failed to fetch ${key || url}:`, error);

		return {
			success: false,
			message: 'An error occurred while fetching data.',
			data
		};
	}
}

export async function makeAPIRequest<T>(
	key: string | null,
	url: string,
	token: string | null | undefined = null,
	options: any = {}
): Promise<{ success: boolean; data?: T | { code: number; message: string }; message?: string }> {
	const config = useRuntimeConfig();
	return await makeRequest<T>(key, `${config.public.apiBaseUrl}${url}`, token, options);
}

export async function makeClientAPIRequest<T>(
	url: string,
	token: string | null | undefined = null,
	options: any = {}
): Promise<{ success: boolean; data?: T | { code: number; message: string }; message?: string }> {
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
			headers,
			...options
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
			message: error.message || 'An error occurred while fetching server data.'
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
	const allItems: T[] = [];
	let currentPage = 1;
	const maxPages = 100;

	while (currentPage <= maxPages) {
		const pageKey = `paginated-${url.replace(/\//g, '-')}-page${currentPage}-search${search}-sort${sort}`;
		const res = await makeAPIRequest<{ items: T[]; total: number }>(
			pageKey,
			`${url}?page=${currentPage}&limit=100&search=${search}&sort=${sort}`,
			token,
			options
		);

		if (!res.success || !res.data) {
			return { success: false, message: res.message || 'Failed to fetch paginated data.' };
		}

		if (!('items' in res.data)) {
			return { success: false, ...res.data };
		}

		allItems.push(...res.data.items);

		// Stop if we've reached the limit or got fewer items than requested
		if (res.data.items.length < 100 || (limit !== -1 && allItems.length >= limit)) {
			break;
		}

		currentPage++;
	}

	return { success: true, data: limit !== -1 ? allItems.slice(0, limit) : allItems };
}

// Non-request related

export function capitalizeFully(str: string): string {
	if (!str) return '';

	const parts = str.split(' ');
	return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ');
}

export function trimString(str: string, maxLength: number): string {
	if (!str || str.length <= maxLength) return str;

	return str.slice(0, maxLength - 3) + '...';
}

export function withSuffix(num: number): string {
	if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
	if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
	if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
	return num.toString();
}

export function comma(num: number): string {
	return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function parseLooseDate(input: string): DateTime | string {
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
