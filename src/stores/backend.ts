import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
	blocksApp,
	classifyCloud,
	classifyMantle,
	classifyTransportFailure,
	isServerFault,
	type CloudHealth,
	type MantleHealth,
	type MantleInfo
} from '~/shared/utils/backend';

// long enough to survive a cold worker, short enough that a hung backend does not hold the app
const PREFLIGHT_TIMEOUT_MS = 6000;

// while blocked we re-check on our own so a recovered backend lets the user back in without a reload
const RECOVERY_POLL_MS = 30_000;

// a burst of failing requests should cost one confirmation check, not one per request
const CONFIRM_THROTTLE_MS = 5000;

function isOnline(): boolean {
	if (typeof navigator === 'undefined') return true;
	return navigator.onLine !== false;
}

function statusOf(error: unknown): number | undefined {
	const e = error as { status?: number; statusCode?: number; response?: { status?: number } };
	return e?.status ?? e?.statusCode ?? e?.response?.status;
}

/**
 * Backend reachability, checked once before the app is allowed to auto-login or fetch content.
 *
 * Never populated during SSR: these routes are ISR-cached, so a health value baked into the HTML
 * would be served to every later visitor long after it stopped being true.
 */
export const useBackendStore = defineStore('backend', () => {
	// #region state

	const mantle = ref<MantleHealth>('unknown');
	const cloud = ref<CloudHealth>('unknown');
	const checkedAt = ref<number | null>(null);
	const checking = ref(false);

	// dedupes concurrent callers; the plugin and the gate can both ask without racing
	let inflight: Promise<void> | null = null;
	let recoveryTimer: ReturnType<typeof setInterval> | null = null;

	// throttles the confirmation re-check so a burst of failures cannot start a preflight storm
	let lastConfirmAt = 0;

	// #endregion

	// #region getters

	/** mantle is down or deliberately closed, so auto-login and content fetching must not run */
	const isBlocked = computed(() => blocksApp(mantle.value));

	/** cloud-only features are unavailable, but the app is otherwise fully usable */
	const isDegraded = computed(() => cloud.value === 'down');

	/** the preflight has produced an answer; used to hold the first paint rather than flash a gate */
	const hasChecked = computed(() => checkedAt.value !== null);

	// #endregion

	// #region checks

	async function pingMantle(): Promise<void> {
		const base = useRuntimeConfig().public.apiBaseUrl;
		try {
			const res = await $fetch.raw<MantleInfo>(`${base}/v2/info`, {
				method: 'GET',
				timeout: PREFLIGHT_TIMEOUT_MS,
				retry: 0
			});
			mantle.value = classifyMantle(res.status, res._data);
		} catch (error) {
			const status = statusOf(error);
			mantle.value =
				typeof status === 'number'
					? classifyMantle(status, null)
					: classifyTransportFailure(isOnline());
		}
	}

	async function pingCloud(): Promise<void> {
		const base = useRuntimeConfig().public.cloudBaseUrl;
		/* a consumer of this layer may not configure cloud at all (sky reaches it through crust's
		   nitro routes). "cannot check" is not "down" -- pinging undefined would report a permanent
		   outage for a backend that is fine */
		if (!base) {
			cloud.value = 'unknown';
			return;
		}

		try {
			// answers plain text, so only the code matters; parsing it as json would throw
			const res = await $fetch.raw(base, {
				method: 'GET',
				timeout: PREFLIGHT_TIMEOUT_MS,
				retry: 0,
				responseType: 'text'
			});
			cloud.value = classifyCloud(res.status);
		} catch (error) {
			const status = statusOf(error);
			// offline is not a cloud outage; the offline banner already owns that message
			if (typeof status === 'number') cloud.value = classifyCloud(status);
			else cloud.value = isOnline() ? 'down' : 'unknown';
		}
	}

	/**
	 * Check both backends. Concurrent callers share one in-flight run.
	 *
	 * @param force re-check even if an answer already exists
	 */
	async function preflight(force = false): Promise<void> {
		if (!import.meta.client) return;
		if (!force && checkedAt.value !== null) return;
		if (inflight) return inflight;

		checking.value = true;
		inflight = (async () => {
			// cloud never blocks, so a slow cloud must not delay the mantle answer
			await Promise.allSettled([pingMantle(), pingCloud()]);
			checkedAt.value = Date.now();
		})().finally(() => {
			checking.value = false;
			inflight = null;
		});

		return inflight;
	}

	// #endregion

	// #region reporting

	/**
	 * A failed request is a HINT, never a verdict.
	 *
	 * One endpoint answering 5xx does not mean the backend is down -- a single failed create or a
	 * transient fault must fail locally with its own message, not blank the whole app. So this only
	 * asks `/v2/info`, the authority, to re-check; if the backend really is down the preflight sets
	 * the state and the gate appears. Throttled so a burst of failures triggers one check.
	 *
	 * @param status HTTP status from the failed request
	 */
	function reportFailure(status: number | null | undefined): void {
		if (!isServerFault(status)) return;

		const now = Date.now();
		if (now - lastConfirmAt < CONFIRM_THROTTLE_MS) return;
		lastConfirmAt = now;

		void preflight(true);
	}

	function startRecoveryPolling(): void {
		if (!import.meta.client || recoveryTimer) return;
		recoveryTimer = setInterval(() => {
			if (isBlocked.value) void preflight(true);
			else stopRecoveryPolling();
		}, RECOVERY_POLL_MS);
	}

	function stopRecoveryPolling(): void {
		if (!recoveryTimer) return;
		clearInterval(recoveryTimer);
		recoveryTimer = null;
	}

	// #endregion

	return {
		mantle,
		cloud,
		checkedAt,
		checking,
		isBlocked,
		isDegraded,
		hasChecked,
		preflight,
		reportFailure,
		startRecoveryPolling,
		stopRecoveryPolling
	};
});
