import { H3Event } from 'h3';

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
