import { useRuntimeConfig } from '#imports';
import { DateTime } from 'luxon';
import type { SortingOption } from './types/global';
import type { User } from './types/user';
import { DEFAULT_FULL_NAME } from './types/user';

export async function makeRequest<T>(
	key: string | null,
	url: string,
	token: string | null | undefined = null,
	options: any = {}
): Promise<{ success: boolean; data?: T | { code: number; message: string }; message?: string }> {
	try {
		// Check if this is a request for binary data (like images)
		const isBinaryRequest = url.includes('profile_photo') || options.responseType === 'blob';

		if (isBinaryRequest) {
			// Handle binary data requests - use $fetch directly for blobs
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

		// Use state for keys
		let cached: ReturnType<typeof useState<T | null | undefined>> | null = null;
		if (key) {
			cached = useState<T | null | undefined>(key, () => undefined);

			if (cached.value) {
				return {
					success: true,
					data: cached.value
				};
			}
		}

		// Handle regular JSON requests
		const data = await $fetch<T>(url, {
			headers: {
				Authorization: `Bearer ${token}`
			},
			ignoreResponseError: true,
			...options
		}).catch((error) => {
			throw {
				message: `Error fetching ${key} from ${url}: ${error}`,
				data,
				error,
				toString: () => error.toString()
			};
		});

		// handle '204 No Content' as success with no data
		if (!data || data === null || data === undefined) {
			if (options.method === 'POST' || options.method === 'DELETE' || options.method === 'PATCH') {
				return {
					success: true
				};
			}

			return {
				success: false,
				data: { code: 404, message: 'Not Found' },
				message: `No data found for ${key} at ${url}`
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
	} catch (error: any) {
		const value: string = error.toString();
		const data = error.data as { code: number; message: string } | undefined;
		if (value.includes('404')) {
			return {
				success: false,
				message: `Resource not found at ${url}`
			};
		}

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
		console.error(`Failed to fetch ${key}:`, error);
		return {
			success: false,
			message: error.message || 'An error occurred while fetching server data.'
		};
	}
}

export async function paginatedAPIRequest<T>(
	key: string | null,
	url: string,
	token: string | null | undefined = null,
	options: any = {},
	limit: number = -1,
	search: string = '',
	sort: SortingOption = 'desc'
) {
	const allItems: T[] = [];
	let currentPage = 1;

	while (true) {
		const res = key
			? await makeAPIRequest<{ items: T[]; total: number }>(
					`${key}-page-${currentPage}`,
					`${url}?page=${currentPage}&limit=100&search=${search}&sort=${sort}`,
					token,
					options
				)
			: await makeClientAPIRequest<{ items: T[]; total: number }>(
					`${url}?page=${currentPage}&limit=100&search=${search}&sort=${sort}`,
					token,
					options
				);

		if (!res.success || !res.data) {
			console.error(`Failed to fetch page ${currentPage}:`, res.message);
			return { success: false, message: res.message || 'Failed to fetch paginated data.' };
		}

		if (!('items' in res.data)) {
			console.error(`Failed to fetch page ${currentPage}:`, res.data.message);
			return { success: false, ...res.data };
		}

		allItems.push(...res.data.items);

		if (res.data.items.length < 100 || (limit !== -1 && allItems.length >= limit)) {
			break;
		}

		currentPage++;
	}

	return { success: true, data: allItems.slice(0, limit) };
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
