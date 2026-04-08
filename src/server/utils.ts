import { H3Event } from 'h3';
import { InternetArchiveSearch } from '~/shared/types/activity';

export async function ensureAdministrator(event: H3Event) {
	const config = useRuntimeConfig();
	const token = getRequestHeader(event, 'Authorization')?.replace('Bearer ', '');
	if (!token) {
		throw createError({
			statusCode: 401,
			statusMessage: 'Unauthorized'
		});
	}

	try {
		const user = await $fetch<User>(`${config.public.apiBaseUrl}/v2/users/current`, {
			headers: {
				Authorization: `Bearer ${token}`,
				'User-Agent': 'The Earth App/Web (https://earth-app.com)'
			}
		});

		if (!user.id) {
			throw createError({
				statusCode: 401,
				statusMessage: 'Unauthorized'
			});
		}

		if (!user || user.account.account_type !== 'ADMINISTRATOR') {
			throw createError({
				statusCode: 403,
				statusMessage: 'Forbidden: You must be an administrator to access this resource'
			});
		}

		return user;
	} catch (error) {
		throw createError({
			statusCode: 401,
			statusMessage: 'Unauthorized'
		});
	}
}

export async function ensureLoggedIn(event: { headers: Headers }) {
	const config = useRuntimeConfig();
	const token = event.headers.get('Authorization')?.replace('Bearer ', '');
	if (!token) {
		throw createError({
			statusCode: 401,
			statusMessage: 'Unauthorized'
		});
	}

	try {
		const user = await $fetch<User>(`${config.public.apiBaseUrl}/v2/users/current`, {
			headers: {
				Authorization: `Bearer ${token}`,
				'User-Agent': 'The Earth App/Web (https://earth-app.com)'
			}
		});

		return user;
	} catch (error) {
		throw createError({
			statusCode: 403,
			statusMessage: 'Forbidden: You must be logged in to access this resource'
		});
	}
}

export async function ensureValidActivity(activityId: string) {
	const config = useRuntimeConfig();

	try {
		const activity = await $fetch<{ id: string }>(
			`${config.public.apiBaseUrl}/v2/activities/${activityId}`,
			{
				headers: {
					'User-Agent': 'The Earth App/Web (https://earth-app.com)'
				}
			}
		);

		if (!activity || activity.id !== activityId) {
			throw createError({
				statusCode: 404,
				statusMessage: 'Activity not found'
			});
		}

		return activity;
	} catch (error) {
		throw createError({
			statusCode: 500,
			statusMessage: `Failed to fetch activity: ${error instanceof Error ? error.message : 'Unknown error'}`
		});
	}
}

// oauth
export async function exchangeCodeForToken(provider: OAuthProvider, code: string): Promise<string> {
	const config = useRuntimeConfig();

	switch (provider) {
		case 'google':
			const google = await $fetch<{ access_token: string }>('https://oauth2.googleapis.com/token', {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					code,
					client_id: config.public.googleClientId,
					client_secret: config.googleClientSecret,
					redirect_uri: 'https://app.earth-app.com/api/auth/callback',
					grant_type: 'authorization_code'
				})
			});

			return google.access_token;
		case 'microsoft':
			const ms = await $fetch<{ access_token: string }>(
				'https://login.microsoftonline.com/common/oauth2/v2.0/token',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
					body: new URLSearchParams({
						code,
						client_id: config.public.microsoftClientId,
						client_secret: config.microsoftClientSecret,
						redirect_uri: 'https://app.earth-app.com/api/auth/callback',
						grant_type: 'authorization_code',
						scope: 'openid email profile'
					})
				}
			);

			return ms.access_token;
		case 'discord':
			const discord = await $fetch<{ access_token: string }>(
				'https://discord.com/api/oauth2/token',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
					body: new URLSearchParams({
						code,
						client_id: config.public.discordClientId,
						client_secret: config.discordClientSecret,
						redirect_uri: 'https://app.earth-app.com/api/auth/callback',
						grant_type: 'authorization_code'
					})
				}
			);

			return discord.access_token;
		case 'github':
			const github = await $fetch<{ access_token: string }>(
				'https://github.com/login/oauth/access_token',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
					body: JSON.stringify({
						code,
						client_id: config.public.githubClientId,
						client_secret: config.githubClientSecret,
						redirect_uri: 'https://app.earth-app.com/api/auth/callback'
					})
				}
			);

			return github.access_token;
		case 'facebook':
			const fb = await $fetch<{ access_token: string }>(
				'https://graph.facebook.com/v18.0/oauth/access_token',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
					body: new URLSearchParams({
						code,
						client_id: config.public.facebookClientId,
						client_secret: config.facebookClientSecret,
						redirect_uri: 'https://app.earth-app.com/api/auth/callback'
					})
				}
			);

			return fb.access_token;
		default:
			throw new Error(`Unknown provider: ${provider}`);
	}
}

export function parseUserAgent(ua: string): {
	make: string;
	model: string;
	os: string;
	version?: string;
} {
	if (!ua) return { make: 'unknown', model: 'unknown', os: 'unknown' };

	// iOS / iPadOS
	const iosMatch = ua.match(/\((\w+);\s*CPU(?:\s+iPhone)?\s+OS\s+([\d_]+)/);
	if (iosMatch) {
		const device = iosMatch[1] ?? 'iPhone'; // "iPhone" or "iPad"
		const osRaw = iosMatch[2] ?? '';
		const osVersion = osRaw.replace(/_/g, '.');
		const version = osVersion || undefined;
		return { make: 'apple', model: device, os: 'ios', version };
	}

	// Android
	const androidMatch = ua.match(/Android\s+([\d.]+);\s*([^)]+)\)/);
	if (androidMatch) {
		const verRaw = androidMatch[1] ?? '';
		const version = verRaw || undefined;
		const modelRaw = (androidMatch[2] ?? '').trim() || 'Android';

		let make = 'android';

		// Samsung  — SM-*, SGH-*, GT-*, SCH-* prefixes or explicit "Samsung"
		if (/samsung/i.test(modelRaw) || /^(SM|SGH|GT|SCH)-/i.test(modelRaw)) {
			make = 'samsung';
		}

		// Google Pixel
		else if (/pixel/i.test(modelRaw) || /google/i.test(modelRaw)) {
			make = 'google';
		}

		// OnePlus
		else if (/oneplus|le\s*x/i.test(modelRaw)) {
			make = 'oneplus';
		}

		// Huawei
		else if (/huawei|honor/i.test(modelRaw)) {
			make = 'huawei';
		}

		// Xiaomi / Redmi / POCO
		else if (/xiaomi|redmi|poco|mi\s/i.test(modelRaw)) {
			make = 'xiaomi';
		}

		// LG
		else if (/lg[-\s]/i.test(modelRaw)) {
			make = 'lg';
		}

		// Motorola
		else if (/motorola|moto\s/i.test(modelRaw)) {
			make = 'motorola';
		}

		// Sony
		else if (/sony|xperia/i.test(modelRaw)) {
			make = 'sony';
		}

		// Nokia
		else if (/nokia/i.test(modelRaw)) {
			make = 'nokia';
		}

		return { make, model: modelRaw, os: 'android', version };
	}

	// macOS
	const macMatch = ua.match(/Macintosh.*Mac OS X ([\d_]+)/);
	if (macMatch) {
		const verRaw = macMatch[1] ?? '';
		const version = verRaw ? verRaw.replace(/_/g, '.') : undefined;
		return { make: 'apple', model: 'Mac', os: 'macos', version };
	}

	// Windows
	const winMatch = ua.match(/Windows NT ([\d.]+)/);
	if (winMatch) {
		const ntMap: Record<string, string> = {
			'10.0': '10/11',
			'6.3': '8.1',
			'6.2': '8',
			'6.1': '7'
		};
		const key = winMatch[1] ?? '';
		const mapped = ntMap[key] ?? key;
		const version = mapped || undefined;
		return { make: 'microsoft', model: 'PC', os: 'windows', version };
	}

	// Linux desktop
	if (/Linux/i.test(ua) && !/Android/i.test(ua)) {
		const version = ua.match(/Linux\s([\d.]+)/)?.[1] ?? undefined;
		return { make: 'linux', model: 'Desktop', os: 'linux', version };
	}

	return { make: 'unknown', model: 'unknown', os: 'unknown' };
}

type IAFormat =
	| 'pdf'
	| 'txt'
	| 'epub'
	| 'png'
	| 'jpg'
	| 'gif'
	| 'webp'
	| 'tiff'
	| 'bmp'
	| 'mp3'
	| 'ogg'
	| 'flac'
	| 'm4a'
	| 'wav'
	| 'aac'
	| 'mp4'
	| 'avi'
	| 'm4v'
	| 'mkv'
	| 'mov'
	| 'flv'
	| 'webm'
	| 'audio'
	| 'image'
	| 'video'
	| 'unknown';

export function detectFileFormat(filename: string, format: string): IAFormat {
	const ext = filename.toLowerCase().split('.').pop() ?? '';
	const fmt = format.toLowerCase();
	const combined = `${filename.toLowerCase()}-${fmt}`;

	// Check extension first (most reliable) - return specific formats when possible
	// Audio specific formats
	if (['mp3', 'ogg', 'flac', 'm4a', 'wav', 'aac'].includes(ext)) return ext as IAFormat;
	if (['wma'].includes(ext)) return 'audio';

	// Image specific formats
	if (['png', 'gif', 'webp', 'tiff', 'bmp'].includes(ext)) return ext as IAFormat;
	if (['jpg', 'jpeg'].includes(ext)) return 'jpg';

	// Video specific formats
	if (['mp4', 'avi', 'm4v', 'mkv', 'mov', 'flv', 'webm'].includes(ext)) return ext as IAFormat;
	if (['mpeg', 'wmv'].includes(ext)) return 'video';

	// Document/text specific formats
	if (['pdf', 'epub'].includes(ext)) return ext as IAFormat;
	if (['txt', 'html', 'xml', 'doc', 'docx'].includes(ext)) return 'txt';

	// Fallback to format field detection - prefer specific formats
	if (combined.includes('mp3')) return 'mp3';
	if (combined.includes('ogg') || combined.includes('vorbis')) return 'ogg';
	if (combined.includes('flac')) return 'flac';
	if (combined.includes('m4a')) return 'm4a';
	if (combined.includes('wav')) return 'wav';
	if (combined.includes('aac')) return 'aac';
	if (combined.includes('wma')) return 'audio';
	if (combined.includes('audio')) return 'audio';

	if (combined.includes('png')) return 'png';
	if (combined.includes('jpg') || combined.includes('jpeg')) return 'jpg';
	if (combined.includes('gif')) return 'gif';
	if (combined.includes('webp')) return 'webp';
	if (combined.includes('tiff')) return 'tiff';
	if (combined.includes('bmp')) return 'bmp';
	if (combined.includes('image')) return 'image';

	if (combined.includes('mp4')) return 'mp4';
	if (combined.includes('avi')) return 'avi';
	if (combined.includes('m4v')) return 'm4v';
	if (combined.includes('mkv')) return 'mkv';
	if (combined.includes('mov')) return 'mov';
	if (combined.includes('flv')) return 'flv';
	if (combined.includes('webm')) return 'webm';
	if (combined.includes('video') || combined.includes('mpeg') || combined.includes('wmv'))
		return 'video';

	if (combined.includes('pdf')) return 'pdf';
	if (combined.includes('epub')) return 'epub';
	if (combined.includes('txt') || combined.includes('html') || combined.includes('xml'))
		return 'txt';

	return 'unknown';
}

export function isFilePubliclyAccessible(filePrivate: boolean | string | undefined): boolean {
	return filePrivate != 'true' && filePrivate != true;
}

export async function fetchWithRetry<T>(
	url: string,
	options: Parameters<typeof $fetch>[1] = {},
	config: {
		maxRetries?: number;
		baseWait?: number; // milliseconds
		maxWait?: number;
	} = {}
): Promise<T> {
	const { maxRetries = 3, baseWait = 1000, maxWait = 32000 } = config;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			const result = await $fetch<T>(url, options);
			return result as T;
		} catch (error: any) {
			// check if error is rate-limit related
			const isRateLimited = error.status === 429 || error.status === 503;

			if (!isRateLimited || attempt === maxRetries) {
				throw error;
			}

			let waitMs: number;
			if (error.response?.headers?.['retry-after']) {
				const retryAfter = error.response.headers['retry-after'];
				// could be seconds or HTTP date
				const seconds = parseInt(retryAfter, 10);
				waitMs = isNaN(seconds) ? 30000 : seconds * 1000;
			} else {
				// wait_time = random(0, min(base_wait * 2^attempt, max_wait))
				const maxBackoff = Math.min(baseWait * Math.pow(2, attempt), maxWait);
				waitMs = Math.random() * maxBackoff;
			}

			console.warn(
				`Rate limited (${error.status}). Retry ${attempt + 1}/${maxRetries} after ${waitMs}ms`
			);

			await new Promise((resolve) => setTimeout(resolve, waitMs));
		}
	}

	throw new Error(`Failed after ${maxRetries} retries`);
}

export function constructIASearch(
	queries: string,
	languages: string[] = ['en', 'eng', 'English'],
	page: number = 1,
	mediatypes: InternetArchiveSearch['response']['docs'][number]['mediatype'][] = [
		'audio',
		'image',
		'texts',
		'movies'
	],
	fields: string[] = ['identifier', 'creator', 'date', 'title', 'description', 'mediatype'],
	reduceProprietarySearch: boolean = true // reduces searching for access-restricted-items which are not publicly accessible
) {
	const queries0 = `(${queries
		.split(',')
		.map((q) => `(${q.trim()})`)
		.join(' OR ')})`;
	const languages0 = `(${languages.map((l) => `language:(${l})`).join(' OR ')})`;
	const mediatypes0 = `(${mediatypes.map((m) => `mediatype:(${m})`).join(' OR ')})`;

	let q = `(${queries0} OR title:${queries0} OR description:${queries0}) AND ${languages0} AND ${mediatypes0}`;

	if (reduceProprietarySearch) {
		q += ' AND NOT collection:(inlibrary OR printdisabled OR lendinglibrary)';
	}

	const params = new URLSearchParams({
		q,
		fl: fields.join(','),
		page: page.toString()
	});

	return `https://archive.org/advancedsearch.php?${params.toString()}&rows=20&output=json`;
}
