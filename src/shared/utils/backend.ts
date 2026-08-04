// #region types

/**
 * Health of mantle2, the backend everything else depends on.
 *
 * - `active` - normal operation
 * - `maintenance` - deliberate downtime, announced by the backend itself
 * - `outage` - unreachable or answering 5xx
 * - `unknown` - not checked yet, or the answer was too ambiguous to act on
 */
export type MantleHealth = 'unknown' | 'active' | 'maintenance' | 'outage';

/** Health of cloud, which carries optional features only; login never depends on it. */
export type CloudHealth = 'unknown' | 'up' | 'down';

/** The `/v2/info` body. Only `status` is load-bearing. */
export type MantleInfo = {
	name?: string;
	description?: string;
	status?: string;
};

// #endregion

// #region classification

export function classifyMantle(status: number, body: unknown): MantleHealth {
	if (status >= 500) return 'outage';

	if (status >= 200 && status < 300) {
		const reported = (body as MantleInfo | null)?.status;
		if (typeof reported !== 'string') return 'unknown';

		const normalized = reported.trim().toLowerCase();
		if (normalized === 'active') return 'active';
		if (normalized === 'maintenance') return 'maintenance';

		// an unrecognised status is not a reason to take the app down
		return 'unknown';
	}

	// 3xx/4xx means the endpoint moved or we asked wrongly, not that the backend is down
	return 'unknown';
}

export function classifyCloud(status: number): CloudHealth {
	if (status >= 200 && status < 300) return 'up';
	if (status >= 500) return 'down';

	// cloud sits behind the same edge as everything else; a 4xx here is our bug, not an outage
	return 'unknown';
}

export function classifyTransportFailure(online: boolean): MantleHealth {
	return online ? 'outage' : 'unknown';
}

// #endregion

// #region policy

export function blocksApp(health: MantleHealth): boolean {
	return health === 'maintenance' || health === 'outage';
}

export function isServerFault(status: number | null | undefined): boolean {
	return typeof status === 'number' && status >= 500;
}

// #endregion

// #region outcome bridge

type RequestOutcomeListener = (status: number) => void;

let outcomeListener: RequestOutcomeListener | null = null;

/**
 * Let the backend store observe request outcomes without `util.ts` importing it. The stores import
 * `util.ts`, so a direct import back would be circular; this keeps the dependency one-way and the
 * classification logic free of pinia.
 *
 * @param listener called with the final http status of every mantle-direct request
 */
export function setRequestOutcomeListener(listener: RequestOutcomeListener | null): void {
	outcomeListener = listener;
}

/**
 * Report a completed mantle-direct request.
 *
 * Deliberately NOT called from `makeServerRequest`: that path proxies to cloud, and a cloud 5xx
 * must degrade optional features rather than blank the entire app.
 *
 * @param status final http status, after retries
 */
export function reportRequestOutcome(status: number): void {
	if (!Number.isFinite(status) || status <= 0) return;
	outcomeListener?.(status);
}

// #endregion

// #region links

/** Where a user is sent when the backend is unreachable. Both are outside the app on purpose. */
export const STATUS_PAGE_URL = 'https://status.earth-app.com';
export const SUPPORT_PAGE_URL = 'https://support.earth-app.com';

// #endregion
