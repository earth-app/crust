import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import {
	geoPermissionView,
	isGeolocationSupported,
	normalizeGeoPermission,
	type GeoPermissionState
} from '~/shared/utils/geoPermission';

export function useGeoPermission() {
	const state = ref<GeoPermissionState>('unknown');
	const view = computed(() => geoPermissionView(state.value));

	let status: PermissionStatus | null = null;

	const applyStatus = () => {
		if (status) state.value = normalizeGeoPermission(status.state);
	};

	const recheck = async (): Promise<GeoPermissionState> => {
		if (typeof navigator === 'undefined') {
			state.value = 'unknown';
			return state.value;
		}
		if (!isGeolocationSupported()) {
			state.value = 'unsupported';
			return state.value;
		}

		const perms = (navigator as Navigator & { permissions?: Permissions }).permissions;
		if (!perms || typeof perms.query !== 'function') {
			// no Permissions API — we can't read the state; the caller falls back to
			// attempting getCurrentPosition (which itself triggers the browser prompt)
			state.value = 'unknown';
			return state.value;
		}

		try {
			const next = await perms.query({ name: 'geolocation' as PermissionName });
			if (status && status !== next) status.onchange = null;
			status = next;
			status.onchange = applyStatus;
			applyStatus();
		} catch {
			state.value = 'unknown';
		}
		return state.value;
	};

	const onVisible = () => {
		if (typeof document === 'undefined' || document.visibilityState === 'visible') void recheck();
	};

	onMounted(() => {
		void recheck();
		if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
		if (typeof window !== 'undefined') window.addEventListener('focus', onVisible);
	});

	onBeforeUnmount(() => {
		if (status) status.onchange = null;
		status = null;
		if (typeof document !== 'undefined')
			document.removeEventListener('visibilitychange', onVisible);
		if (typeof window !== 'undefined') window.removeEventListener('focus', onVisible);
	});

	return { state, view, recheck };
}
