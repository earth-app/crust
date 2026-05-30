export type SiteTourStepActionType =
	| 'click'
	| 'focus'
	| 'scroll'
	| 'wait'
	| 'set-value'
	| 'dispatch-event';

export type SiteTourStepAction = {
	type: SiteTourStepActionType;
	target?: string;
	value?: string;
	event?: string;
	delay?: number;
};

export type SiteTourStepPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center' | 'auto';

export type SiteTourStepCTA = {
	label: string;
	icon?: string;
	color?: string;
	advance?: boolean;
	closeOnSuccess?: boolean;
	handler: () => unknown | Promise<unknown>;
};

export type SiteTourStep = {
	id?: string;
	title: string;
	description: string;
	footer?: string;
	url?: string;
	anonymous?: boolean;
	prerendered?: boolean;

	icon?: string;
	image?: string;
	placement?: SiteTourStepPlacement;
	dim?: boolean;
	pulse?: boolean;
	interactive?: boolean;
	highlightPadding?: number;
	radius?: number;

	waitFor?: string;
	waitTimeout?: number;
	delay?: number;

	actions?: SiteTourStepAction[];
	cta?: SiteTourStepCTA;
	condition?: () => boolean;

	onEnter?: () => void | Promise<void>;
	onExit?: () => void | Promise<void>;
};

export type SiteTour = {
	id: string;
	name: string;
	steps: SiteTourStep[];
	dim?: boolean;
	pulse?: boolean;
	allowSkip?: boolean;
	persist?: boolean;
	onComplete?: () => void;
	onSkip?: () => void;
};

const activeTourId = ref<string | null>(null);
const activeStepIndex = ref<number>(0);
const tours = ref<Map<string, SiteTour>>(new Map());

const STORAGE_KEY = 'earth_app_completed_tours';

const completedTours = ref<Set<string>>(new Set());

function loadCompletedTours() {
	if (!import.meta.client) return;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return;
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) {
			completedTours.value = new Set(parsed);
		}
	} catch {
		// ignore storage errors
	}
}

function persistCompletedTours() {
	if (!import.meta.client) return;
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(completedTours.value)));
	} catch {
		// ignore storage errors
	}
}

let _completedLoaded = false;
function ensureCompletedLoaded() {
	if (_completedLoaded) return;
	_completedLoaded = true;
	loadCompletedTours();
}

export const useSiteTour = () => {
	ensureCompletedLoaded();

	const registerTour = (tour: SiteTour) => {
		tours.value.set(tour.id, tour);
	};

	const unregisterTour = (tourId: string) => {
		tours.value.delete(tourId);
		if (activeTourId.value === tourId) {
			activeTourId.value = null;
			activeStepIndex.value = 0;
		}
	};

	const startTour = (tourId: string, startStep = 0) => {
		const tour = tours.value.get(tourId);
		if (!tour) {
			console.warn(`Tour with id "${tourId}" not found.`);
			return;
		}

		activeStepIndex.value = Math.max(0, Math.min(startStep, tour.steps.length - 1));
		activeTourId.value = tourId;

		const name = tour.name || 'Unknown Tour';
		console.log(`Starting tour: ${name}`);
	};

	const startTourIfNew = (tourId: string, startStep = 0) => {
		if (hasCompleted(tourId)) return false;
		startTour(tourId, startStep);
		return true;
	};

	const stopTour = (options: { completed?: boolean } = {}) => {
		const tourId = activeTourId.value;
		const tour = tourId ? tours.value.get(tourId) : null;

		if (tour && options.completed) {
			markCompleted(tour.id);
			tour.onComplete?.();
		} else if (tour) {
			tour.onSkip?.();
		}

		activeTourId.value = null;
		activeStepIndex.value = 0;
	};

	const goToStep = (stepIndex: number) => {
		const tour = getActiveTour();
		if (!tour) return;
		activeStepIndex.value = Math.max(0, Math.min(stepIndex, tour.steps.length - 1));
	};

	const getActiveTour = () => {
		if (activeTourId.value) {
			return tours.value.get(activeTourId.value) || null;
		}
		return null;
	};

	const isActiveTour = (tourId: string) => {
		return activeTourId.value === tourId;
	};

	const hasCompleted = (tourId: string): boolean => {
		ensureCompletedLoaded();
		return completedTours.value.has(tourId);
	};

	const markCompleted = (tourId: string) => {
		completedTours.value.add(tourId);
		persistCompletedTours();
	};

	const clearCompleted = (tourId?: string) => {
		if (tourId) {
			completedTours.value.delete(tourId);
		} else {
			completedTours.value.clear();
		}
		persistCompletedTours();
	};

	return {
		activeTourId: readonly(activeTourId),
		activeStepIndex: readonly(activeStepIndex),
		registerTour,
		unregisterTour,
		startTour,
		startTourIfNew,
		stopTour,
		goToStep,
		getActiveTour,
		isActiveTour,
		hasCompleted,
		markCompleted,
		clearCompleted
	};
};
