// #region types

// our extended geolocation-permission union: the three real Permissions API states
// plus two we synthesize when the api can't tell us (no navigator, no Permissions API)
export type GeoPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported' | 'unknown';

export type GeoPermissionColor = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface GeoPermissionView {
	state: GeoPermissionState;
	label: string; // Title Case status label
	description: string; // sentence-case helper line
	icon: string;
	color: GeoPermissionColor;
	// derived flags the ui gates on
	ready: boolean; // access is granted
	blocked: boolean; // access is denied
	canRetry: boolean; // offer a re-check / try-again affordance
}

// #region normalize

// map a raw PermissionState (or anything) into our union; guards odd/missing values
export function normalizeGeoPermission(state: string | null | undefined): GeoPermissionState {
	switch (state) {
		case 'granted':
		case 'denied':
		case 'prompt':
			return state;
		default:
			return 'unknown';
	}
}

// #region view

const VIEWS: Record<GeoPermissionState, Omit<GeoPermissionView, 'state'>> = {
	granted: {
		label: 'Location Ready',
		description: 'Location access is on. We can show trailmarks around you.',
		icon: 'mdi:crosshairs-gps',
		color: 'success',
		ready: true,
		blocked: false,
		canRetry: false
	},
	denied: {
		label: 'Location is Blocked',
		description:
			'Location is blocked for this site. Allow it in your browser, then re-check to see nearby notes.',
		icon: 'mdi:map-marker-off-outline',
		color: 'warning',
		ready: false,
		blocked: true,
		canRetry: true
	},
	prompt: {
		label: 'Location Not Set',
		description: 'We will ask for your location. Allow it to see the trailmarks nearby.',
		icon: 'mdi:crosshairs-question',
		color: 'info',
		ready: false,
		blocked: false,
		canRetry: true
	},
	unsupported: {
		label: 'Location Unavailable',
		description: 'This browser does not support location, so nearby notes are unavailable.',
		icon: 'mdi:map-marker-alert-outline',
		color: 'neutral',
		ready: false,
		blocked: false,
		canRetry: false
	},
	unknown: {
		label: 'Checking Location',
		description: 'Checking your location access.',
		icon: 'mdi:crosshairs',
		color: 'neutral',
		ready: false,
		blocked: false,
		canRetry: true
	}
};

// derive the display view for a permission state
export function geoPermissionView(state: GeoPermissionState): GeoPermissionView {
	return { state, ...VIEWS[state] };
}

// #region position (the single web geolocation seam; sky owns native via useMGeolocation)

// whether the geolocation api is present in this browser
export function isGeolocationSupported(): boolean {
	return typeof navigator !== 'undefined' && 'geolocation' in navigator && !!navigator.geolocation;
}

// running inside the Capacitor native shell (native uses its own geolocation, not this)
export function isNativePlatform(): boolean {
	if (typeof window === 'undefined') return false;
	const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
	return cap?.isNativePlatform?.() === true;
}

// promise wrapper around navigator.geolocation.getCurrentPosition; rejects when the api
// is missing so every caller shares one support check + one code path
export function getCurrentPosition(options?: PositionOptions): Promise<GeolocationPosition> {
	return new Promise((resolve, reject) => {
		if (!isGeolocationSupported()) {
			reject(new Error('Geolocation is not supported by this browser.'));
			return;
		}
		navigator.geolocation.getCurrentPosition(resolve, reject, options);
	});
}

// #endregion
