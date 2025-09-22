import { useRuntimeConfig } from '#imports';

export async function makeRequest<T>(
	key: string | null,
	url: string,
	token: string | null | undefined = null,
	options: any = {}
): Promise<{ success: boolean; data?: T; message?: string }> {
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

		// Handle regular JSON requests
		const { data, error } = key
			? await useAsyncData<T>(
					key,
					() =>
						$fetch<T>(url, {
							headers: {
								Authorization: `Bearer ${token}`
							},
							...options
						}) as Promise<T>
				)
			: {
					data: {
						value: await $fetch<T>(url, {
							headers: {
								Authorization: `Bearer ${token}`
							},
							...options
						})
					},
					error: { value: undefined }
				};

		if (error.value) {
			throw error.value;
		}

		if (!data.value && options['method'] !== 'DELETE') {
			return {
				success: false,
				message: `No data found for ${key} at ${url}`
			};
		}

		return {
			success: true,
			data: data.value as T
		};
	} catch (error: any) {
		const value: string = error.toString();
		if (value.includes('404')) {
			return {
				success: false,
				message: `Resource not found at ${url}`
			};
		}

		if (value.includes('400')) {
			console.error(`Bad request to ${url}:`, error.value.data);
			return {
				success: false,
				message: `Bad request to ${url}: ${error.value.statusMessage || 'Invalid parameters'}`
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

		console.error(`Failed to fetch ${key}:`, error);
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
			'Content-Type': 'application/json'
		};

		if (token) {
			headers['Authorization'] = `Bearer ${token}`;
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
			message: error.message || 'An error occurred while fetching data.'
		};
	}
}

export async function paginatedAPIRequest<T>(
	key: string | null,
	url: string,
	token: string | null | undefined = null,
	options: any = {},
	limit: number = -1,
	search: string = ''
) {
	const allItems: T[] = [];
	let currentPage = 1;

	while (true) {
		const res = key
			? await makeAPIRequest<{ items: T[]; total: number }>(
					`${key}-page-${currentPage}`,
					`${url}?page=${currentPage}&limit=100&search=${search}`,
					token,
					options
				)
			: await makeClientAPIRequest<{ items: T[]; total: number }>(
					`${url}?page=${currentPage}&limit=100&search=${search}`,
					token,
					options
				);

		if (!res.success || !res.data) {
			console.error(`Failed to fetch page ${currentPage}:`, res.message);
			return { success: false, message: res.message || 'Failed to fetch paginated data.' };
		}

		allItems.push(...res.data.items);

		if (res.data.items.length < 100 || (limit !== -1 && allItems.length >= limit)) {
			break;
		}

		currentPage++;
	}

	return { success: true, data: allItems.slice(0, limit) };
}

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
