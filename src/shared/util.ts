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
			? await useAsyncData<T>(key, () =>
					$fetch<T>(url, {
						headers: {
							Authorization: `Bearer ${token}`
						},
						...options
					})
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
			console.error(`Error fetching ${key}:`, error.value);
			return {
				success: false,
				message: error.value.message || 'An error occurred while fetching data.'
			};
		}

		if (!data.value) {
			return {
				success: false,
				message: 'No data found.'
			};
		}

		return {
			success: true,
			data: data.value as T
		};
	} catch (error) {
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
		const res = await makeAPIRequest<{ items: T[]; total: number }>(
			key,
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
