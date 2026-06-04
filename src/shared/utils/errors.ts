// shared error-message extractor: mantle2 returns { code, message } JSON on
// errors; ofetch's FetchError.message is a raw "[400] FetchError: ..." template
// that leaks into toasts when callers naively read .message. centralizing the
// extraction so every toast surface gets the backend's actual reason.

const RAW_HTTP_PREFIX = /^\[\d+\]\s*FetchError/i;
const RAW_HTTP_DID_NOT_FAIL = /did not fail/i;

export function looksLikeRawHttpError(value: string): boolean {
	if (!value) return false;
	return RAW_HTTP_PREFIX.test(value) || RAW_HTTP_DID_NOT_FAIL.test(value);
}

function isString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

function getProp(source: unknown, key: string): unknown {
	if (!source || typeof source !== 'object') return undefined;
	return (source as Record<string, unknown>)[key];
}

export function extractServerMessage(err: unknown, fallback?: string): string {
	const safeFallback = fallback ?? 'Something went wrong. Please try again.';

	if (isString(err)) {
		return looksLikeRawHttpError(err) ? safeFallback : err.trim();
	}

	if (!err || typeof err !== 'object') return safeFallback;

	const data = getProp(err, 'data');

	if (isString(data) && !looksLikeRawHttpError(data)) {
		return data.trim();
	}

	const dataMessage = getProp(data, 'message');
	if (isString(dataMessage) && !looksLikeRawHttpError(dataMessage)) {
		return dataMessage.trim();
	}

	const dataErrorMessage = getProp(getProp(data, 'error'), 'message');
	if (isString(dataErrorMessage) && !looksLikeRawHttpError(dataErrorMessage)) {
		return dataErrorMessage.trim();
	}

	const dataError = getProp(data, 'error');
	if (isString(dataError) && !looksLikeRawHttpError(dataError)) {
		return dataError.trim();
	}

	const statusMessage = getProp(err, 'statusMessage');
	if (isString(statusMessage) && !looksLikeRawHttpError(statusMessage)) {
		return statusMessage.trim();
	}

	const message = getProp(err, 'message');
	if (isString(message) && !looksLikeRawHttpError(message)) {
		return message.trim();
	}

	return safeFallback;
}

export interface ExtractedErrorPayload {
	code?: number;
	message: string;
	reason?: string;
}

// pull the backend's structured fields out of an unknown error so callers can
// switch on reason (EMAIL_VERIFICATION_REQUIRED, REAUTH_REQUIRED, etc) without
// re-implementing the unwrap dance
export function extractErrorPayload(err: unknown, fallback?: string): ExtractedErrorPayload {
	const message = extractServerMessage(err, fallback);
	const data = getProp(err, 'data');

	const rawCode = getProp(data, 'code');
	const code = typeof rawCode === 'number' && Number.isFinite(rawCode) ? rawCode : undefined;

	const rawReason = getProp(data, 'reason');
	const reason = isString(rawReason) ? rawReason : undefined;

	return { code, message, reason };
}
